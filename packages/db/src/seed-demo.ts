import { createHash, randomBytes } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

// Rich DEMO DATA seed for the Escritório Demo firm — so every screen looks alive
// (companies, contacts, tasks, recurring templates, deadlines in every status,
// documents + AI classifications, document requests, mapping rules, exceptions,
// support tickets, notifications, audit trail). Uses the service role (bypasses RLS).
// Idempotent: a sentinel company short-circuits a re-run. To reseed, delete the demo
// companies (name starts with the ones below) and run again.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE) {
  throw new Error('seed:demo requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (packages/db/.env)');
}
const FIRM = '11111111-1111-4111-8111-111111111111';
const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

// --- helpers ----------------------------------------------------------------
function checkDigit(base: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    sum += Number(base[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}
function makeCnpj(index: number): string {
  const base = (200000000001 + index * 7).toString().padStart(12, '0').slice(0, 12);
  const d1 = checkDigit(base);
  const d2 = checkDigit(base + d1);
  return `${base}${d1}${d2}`;
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
}
function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3_600_000).toISOString();
}
function tokenHash(): string {
  return createHash('sha256').update(randomBytes(24)).digest('hex');
}
const now = new Date();
const PERIOD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

const COMPANIES = [
  { legalName: 'Padaria Pão Quente Ltda', tradeName: 'Pão Quente', regime: 'simples_nacional', city: 'São Paulo', uf: 'SP', contact: 'Maria Souza' },
  { legalName: 'Auto Peças Veloz ME', tradeName: 'Veloz Peças', regime: 'simples_nacional', city: 'Santos', uf: 'SP', contact: 'João Lima' },
  { legalName: 'Construtora Alicerce S.A.', tradeName: 'Alicerce', regime: 'lucro_real', city: 'Campinas', uf: 'SP', contact: 'Carlos Mendes' },
  { legalName: 'Restaurante Sabor Caseiro Ltda', tradeName: 'Sabor Caseiro', regime: 'simples_nacional', city: 'Guarulhos', uf: 'SP', contact: 'Ana Paula' },
  { legalName: 'Tech Solutions Sistemas Ltda', tradeName: 'Tech Solutions', regime: 'lucro_presumido', city: 'São Paulo', uf: 'SP', contact: 'Rafael Nunes' },
  { legalName: 'Farmácia Vida Saudável Ltda', tradeName: 'Vida Saudável', regime: 'lucro_presumido', city: 'Osasco', uf: 'SP', contact: 'Beatriz Rocha' },
  { legalName: 'Transportadora Rota Certa Ltda', tradeName: 'Rota Certa', regime: 'lucro_real', city: 'Santo André', uf: 'SP', contact: 'Pedro Alves' },
  { legalName: 'Boutique Elegância ME', tradeName: 'Elegância', regime: 'simples_nacional', city: 'São Bernardo do Campo', uf: 'SP', contact: 'Fernanda Dias' },
  { legalName: 'Clínica Bem Estar Ltda', tradeName: 'Bem Estar', regime: 'lucro_presumido', city: 'São Paulo', uf: 'SP', contact: 'Dr. Marcos Reis' },
  { legalName: 'Mercadinho do Bairro', tradeName: 'Mercadinho', regime: 'mei', city: 'Diadema', uf: 'SP', contact: 'Sr. Antônio' },
];

async function main(): Promise<void> {
  const sentinelCnpj = makeCnpj(0);
  const { data: existing } = await admin
    .from('companies')
    .select('id')
    .eq('firm_id', FIRM)
    .eq('cnpj', sentinelCnpj)
    .maybeSingle();
  if (existing) {
    console.log('Demo data already seeded (sentinel company exists). Nothing to do.');
    return;
  }

  const { data: users } = await admin.from('users').select('id, role').eq('firm_id', FIRM);
  const owner = (users ?? []).find((u) => u.role === 'owner') ?? (users ?? [])[0];
  const staff = (users ?? []).find((u) => u.role === 'staff') ?? owner;
  const ownerId = owner?.id ?? null;
  const staffId = staff?.id ?? null;

  // 1) Companies + contacts
  const ids: string[] = [];
  for (let i = 0; i < COMPANIES.length; i++) {
    const c = COMPANIES[i]!;
    const { data, error } = await admin
      .from('companies')
      .insert({
        firm_id: FIRM,
        cnpj: makeCnpj(i),
        legal_name: c.legalName,
        trade_name: c.tradeName,
        tax_regime: c.regime,
        city: c.city,
        state: c.uf,
        status: 'active',
      })
      .select('id')
      .single();
    if (error) throw error;
    const id = (data as { id: string }).id;
    ids.push(id);
    await admin.from('contacts').insert({
      firm_id: FIRM,
      company_id: id,
      name: c.contact,
      email: `${c.tradeName.toLowerCase().replace(/[^a-z]/g, '')}@exemplo.com.br`,
      phone: `5513${String(90000000 + i * 111).slice(0, 8)}`,
      preferred_channel: 'email',
      is_primary: true,
    });
  }
  console.log(`Seeded ${ids.length} companies + contacts`);

  // 2) Tasks — spread across departments and statuses
  const depts = ['fiscal', 'contabil', 'dp', 'compliance'];
  const titles: Record<string, string> = {
    fiscal: 'Apuração de impostos',
    contabil: 'Conciliação contábil',
    dp: 'Folha de pagamento',
    compliance: 'Renovar certidões',
  };
  const statuses = ['pending', 'pending', 'in_progress', 'done', 'pending'];
  const tasks = ids.slice(0, 8).flatMap((companyId, i) => {
    const dep = depts[i % depts.length]!;
    return [
      {
        firm_id: FIRM,
        company_id: companyId,
        period: PERIOD,
        department: dep,
        title: `${titles[dep]} — ${PERIOD}`,
        status: statuses[i % statuses.length],
        assignee_id: dep === 'fiscal' ? staffId : ownerId,
        handoff_to: dep === 'fiscal' ? 'contabil' : null,
      },
    ];
  });
  await admin.from('tasks').insert(tasks);
  console.log(`Seeded ${tasks.length} tasks`);

  // 3) Recurring task templates
  await admin.from('recurring_tasks').insert([
    { firm_id: FIRM, title: 'Apuração mensal de impostos', department: 'fiscal', generation_day: 5, target_kind: 'all', target_value: {}, handoff_to: 'contabil', active: true },
    { firm_id: FIRM, title: 'Fechamento da folha', department: 'dp', generation_day: 25, target_kind: 'all', target_value: {}, active: true },
    { firm_id: FIRM, title: 'Conciliação bancária', department: 'contabil', generation_day: 10, target_kind: 'by_regime', target_value: { regimes: ['lucro_real', 'lucro_presumido'] }, active: true },
  ]);
  console.log('Seeded 3 recurring templates');

  // 4) Monitored documents — every status so the farol + Prazos screen are colourful
  const kinds = ['cnd_federal', 'cnd_estadual', 'cnd_municipal', 'cndt', 'fgts_crf', 'alvara', 'certificado_a1'];
  const dueByRow = [addDays(-12), addDays(-3), addDays(8), addDays(20), addDays(90), addDays(200), null];
  const monitored = ids.slice(0, 7).map((companyId, i) => ({
    firm_id: FIRM,
    company_id: companyId,
    doc_kind: kinds[i % kinds.length],
    due_date: dueByRow[i],
    trigger_days: 30,
    status: 'valid', // recomputed on read
  }));
  // a couple more overdue on other companies so "attention" has volume
  monitored.push(
    { firm_id: FIRM, company_id: ids[7]!, doc_kind: 'cndt', due_date: addDays(-1), trigger_days: 30, status: 'valid' },
    { firm_id: FIRM, company_id: ids[8]!, doc_kind: 'alvara', due_date: addDays(5), trigger_days: 30, status: 'valid' },
  );
  await admin.from('monitored_documents').insert(monitored);
  console.log(`Seeded ${monitored.length} monitored documents`);

  // 5) Documents (+ a couple AI classifications)
  const docTypes = ['nfe', 'das', 'nfse', 'payslip', 'bank_statement', 'darf'];
  const docIds: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    const companyId = ids[i]!;
    const type = docTypes[i % docTypes.length]!;
    const hash = createHash('sha256').update(`demo-${i}-${type}`).digest('hex');
    const path = `firm/${FIRM}/company/${companyId}/${PERIOD}/fiscal/${hash.slice(0, 10)}-${type}.pdf`;
    const { data } = await admin
      .from('documents')
      .insert({
        firm_id: FIRM,
        company_id: companyId,
        doc_type: type,
        storage_path: path,
        source: i % 3 === 0 ? 'triage' : 'upload',
        hash,
        file_name: `${type}-${PERIOD}.pdf`,
        size_bytes: 12000 + i * 900,
        period: PERIOD,
        department: 'fiscal',
      })
      .select('id')
      .single();
    if (data) docIds.push((data as { id: string }).id);
  }
  console.log(`Seeded ${docIds.length} documents`);
  // classifications for the triage-sourced ones
  for (let i = 0; i < docIds.length; i += 3) {
    await admin.from('classifications').insert({
      firm_id: FIRM,
      document_id: docIds[i],
      suggested_type: docTypes[i % docTypes.length],
      extracted_cnpj: makeCnpj(i),
      confidence: 0.72 + (i % 3) * 0.08,
      model: 'claude-opus-4-8',
      decided_by: 'ai',
    });
  }
  console.log('Seeded AI classifications');

  // 6) Document requests — varied statuses
  const reqStatuses: { kind: string; status: string; title: string }[] = [
    { kind: 'upload_request', status: 'sent', title: 'Enviar extrato bancário de ' + PERIOD },
    { kind: 'upload_request', status: 'viewed', title: 'Enviar notas de compra' },
    { kind: 'upload_request', status: 'received', title: 'Contrato social atualizado' },
    { kind: 'document_offer', status: 'sent', title: 'Guia DAS disponível' },
    { kind: 'upload_request', status: 'requested', title: 'Comprovante de endereço' },
  ];
  await admin.from('document_requests').insert(
    reqStatuses.map((r, i) => ({
      firm_id: FIRM,
      company_id: ids[i]!,
      kind: r.kind,
      title: r.title,
      description: 'Solicitação de exemplo para demonstração.',
      requested_doc_type: r.kind === 'upload_request' ? 'bank_statement' : null,
      token_hash: tokenHash(),
      expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      status: r.status,
      sent_at: r.status === 'requested' ? null : hoursAgo(24 + i * 6),
      created_by: ownerId,
    })),
  );
  console.log('Seeded 5 document requests');

  // 7) Mapping rules (CFOP)
  await admin.from('mapping_rules').insert([
    { firm_id: FIRM, domain: 'cfop', level: 2, key: { originCfop: '5102' }, value: { entryCfop: '1102' }, origin: 'manual' },
    { firm_id: FIRM, domain: 'cfop', level: 2, key: { originCfop: '6102' }, value: { entryCfop: '2102' }, origin: 'manual' },
    { firm_id: FIRM, domain: 'cfop', level: 1, key: { originCfop: '5102', supplierCnpj: makeCnpj(2) }, value: { entryCfop: '1556' }, origin: 'manual' },
  ]);
  console.log('Seeded 3 mapping rules');

  // 8) Exceptions — a few open, various sources
  await admin.from('exception_queue').insert([
    { firm_id: FIRM, source: 'triage', status: 'open', context: { reason: 'low_confidence', fileName: 'nota-borrada.pdf', confidence: 0.41 }, suggestion: { docType: 'nfe', department: 'fiscal' } },
    { firm_id: FIRM, source: 'triage', status: 'open', context: { reason: 'company_not_found', cnpj: makeCnpj(99), fileName: 'boleto.pdf' }, suggestion: {} },
    { firm_id: FIRM, source: 'rules', status: 'open', context: { reason: 'no_rule', originCfop: '5405', documentId: docIds[0] ?? null }, suggestion: { entryCfop: '' } },
    { firm_id: FIRM, source: 'requests', status: 'open', context: { reason: 'no_contact_email', companyId: ids[9] }, suggestion: { action: 'add_contact_email' } },
  ]);
  console.log('Seeded 4 exceptions');

  // 9) Support tickets + messages
  const tickets: { status: string; name: string; phone: string; ai: boolean }[] = [
    { status: 'open', name: 'Maria Souza', phone: '5513988001122', ai: false },
    { status: 'escalated', name: 'João Lima', phone: '5513988003344', ai: false },
    { status: 'pending', name: 'Rafael Nunes', phone: '5513988005566', ai: true },
    { status: 'resolved', name: 'Ana Paula', phone: '5513988007788', ai: true },
  ];
  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i]!;
    const { data } = await admin
      .from('support_tickets')
      .insert({
        firm_id: FIRM,
        company_id: ids[i]!,
        channel: 'whatsapp',
        contact_identifier: t.phone,
        contact_name: t.name,
        subject: 'Dúvida sobre a guia do mês',
        status: t.status,
        ai_handled: t.ai,
        last_message_at: hoursAgo(i * 5 + 1),
        last_inbound_at: hoursAgo(i * 5 + 1),
      })
      .select('id')
      .single();
    const ticketId = (data as { id: string }).id;
    await admin.from('support_messages').insert([
      { firm_id: FIRM, ticket_id: ticketId, direction: 'inbound', author: 'client', body: 'Bom dia! A guia deste mês já saiu?', delivery: 'delivered', delivered_at: hoursAgo(i * 5 + 2) },
      ...(t.ai
        ? [{ firm_id: FIRM, ticket_id: ticketId, direction: 'outbound', author: 'ai', body: 'Sim! A guia já foi enviada e está em dia.', delivery: 'delivered', delivered_at: hoursAgo(i * 5 + 1) }]
        : []),
    ]);
  }
  console.log(`Seeded ${tickets.length} support tickets`);

  // 10) Notifications (topbar bell — a few unread for the owner)
  await admin.from('notifications').insert([
    { firm_id: FIRM, user_id: ownerId, kind: 'handoff', title: 'Nova tarefa recebida', body: 'Apuração de impostos foi repassada para o Contábil', entity: 'task', entity_id: null },
    { firm_id: FIRM, department: 'compliance', kind: 'deadline', title: 'Certidão vencida', body: 'CND Federal da Construtora Alicerce venceu', entity: 'monitored_document', entity_id: null },
    { firm_id: FIRM, user_id: ownerId, kind: 'alert', title: 'Solicitação sem resposta', body: 'Cliente não abriu o link há 3 dias', entity: 'document_request', entity_id: null },
  ]);
  console.log('Seeded 3 notifications');

  // 11) Audit trail — a realistic spread across entities/actors/time
  const audit = [
    { action: 'company.created', entity: 'company', actor: ownerId, ctx: { legalName: COMPANIES[0]!.legalName }, h: 72 },
    { action: 'companies.imported', entity: 'company', actor: ownerId, ctx: { count: 10 }, h: 71 },
    { action: 'task.created', entity: 'task', actor: staffId, ctx: { department: 'fiscal' }, h: 60 },
    { action: 'task.handed_off', entity: 'task', actor: staffId, ctx: { to_department: 'contabil' }, h: 48 },
    { action: 'document.classified', entity: 'document', actor: null, ctx: { docType: 'nfe', department: 'fiscal' }, h: 40 },
    { action: 'triage.exception', entity: 'document', actor: null, ctx: { reason: 'low_confidence' }, h: 39 },
    { action: 'monitored_document.created', entity: 'monitored_document', actor: ownerId, ctx: { docKind: 'cnd_federal' }, h: 30 },
    { action: 'deadline.recomputed', entity: 'monitored_document', actor: null, ctx: { transitions: 2 }, h: 24 },
    { action: 'request.sent', entity: 'document_request', actor: ownerId, ctx: {}, h: 20 },
    { action: 'support.received', entity: 'support_ticket', actor: null, ctx: { channel: 'whatsapp' }, h: 8 },
    { action: 'support.ai_replied', entity: 'support_ticket', actor: null, ctx: { confidence: 0.9 }, h: 7 },
    { action: 'exception.resolved', entity: 'exception', actor: ownerId, ctx: { note: 'Classificado manualmente' }, h: 5 },
    { action: 'firm.config.updated', entity: 'firm', actor: ownerId, ctx: { deadlineDefaultDays: 30 }, h: 2 },
    { action: 'mapping_rule.created', entity: 'mapping_rule', actor: ownerId, ctx: { domain: 'cfop' }, h: 1 },
  ];
  await admin.from('audit_events').insert(
    audit.map((a) => ({
      firm_id: FIRM,
      actor_id: a.actor,
      action: a.action,
      entity: a.entity,
      entity_id: null,
      context: a.ctx,
      created_at: hoursAgo(a.h),
    })),
  );
  console.log(`Seeded ${audit.length} audit events`);

  console.log('\n✅ Demo seed complete. Open the app to see every screen populated.');
}

main().catch((error: unknown) => {
  console.error('Demo seed failed:', error);
  process.exit(1);
});
