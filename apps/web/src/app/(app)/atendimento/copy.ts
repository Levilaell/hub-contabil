// UI copy (pt-BR) for Atendimento (support tickets). All strings centralized here
// (no pt-BR in JSX). Domain terms users know (WhatsApp, e-mail) stay as-is.

export const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
export const primaryButtonClass =
  'bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60';
export const secondaryButtonClass =
  'border hover:bg-accent rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60';

export const copy = {
  title: 'Atendimento',
  subtitle: 'Dúvidas dos clientes que chegam pelo WhatsApp e e-mail.',
  filters: 'Filtros',
  statusLabel: 'Situação',
  statusOpenAll: 'Abertos (precisam de atenção)',
  statusOpen: 'Novos',
  statusEscalated: 'Encaminhados a um humano',
  statusPending: 'Aguardando cliente',
  statusResolved: 'Resolvidos',
  statusAll: 'Todos',
  departmentLabel: 'Departamento',
  departmentAll: 'Todos',
  apply: 'Aplicar',
  channels: { whatsapp: 'WhatsApp', imap: 'E-mail' } as Record<string, string>,
  badge: {
    open: 'Novo',
    pending: 'Aguardando cliente',
    escalated: 'Com você',
    resolved: 'Resolvido',
  } as Record<string, string>,
  empty: {
    title: 'Nenhum atendimento aberto',
    description: 'Quando um cliente mandar uma dúvida, ela aparece aqui — tudo em dia ✅',
    filteredTitle: 'Nada nesta visão',
    filteredDescription: 'Ajuste os filtros para ver outros atendimentos.',
  },
  aiTag: 'Respondido pela IA',
  drawer: {
    close: 'Fechar',
    conversation: 'Conversa',
    loading: 'Carregando mensagens…',
    empty: 'Sem mensagens.',
    company: 'Empresa',
    companyLinked: 'Vinculada a uma empresa cadastrada',
    noCompany: 'Contato ainda não vinculado a uma empresa',
    linkCompany: 'Vincular a empresa',
    linkCompanyPick: 'Escolha a empresa…',
    companyLinkedNotice:
      'Empresa vinculada — o contato foi cadastrado nela e a IA passa a usar o contexto certo.',
    contact: 'Contato',
    movedToPending:
      'Resposta enviada. A conversa foi para "Aguardando cliente" e a IA fica em silêncio nela até você usar "Devolver para a IA". Ela sai da fila padrão e volta quando o cliente responder (use o filtro Situação para encontrá-la).',
    department: 'Departamento',
    departmentNone: 'Sem departamento',
    departmentSaved: 'Departamento salvo — os filtros passam a considerar a conversa.',
    handledBy: 'Quem atende',
    handledByAi: 'IA — responde automaticamente quando confiante',
    handledByHuman: 'Atendimento humano — a IA está em silêncio nesta conversa',
    returnToAi: 'Devolver para a IA',
    returnedToAi: 'Conversa devolvida para a IA — ela volta a responder o cliente.',
    outsideWindow:
      '⏳ Janela de 24h do WhatsApp expirada — a resposta só será entregue depois que o cliente mandar uma nova mensagem.',
    replyPlaceholder: 'Escreva sua resposta ao cliente…',
    reply: 'Responder',
    sending: 'Enviando…',
    escalate: 'Assumir (encaminhar p/ humano)',
    resolve: 'Marcar como resolvido',
    reopen: 'Reabrir',
    working: 'Salvando…',
  },
  author: { client: 'Cliente', ai: 'IA', user: 'Você' } as Record<string, string>,
  delivery: { queued: 'enviando…', failed: 'falha no envio', delivered: '' } as Record<
    string,
    string
  >,
} as const;
