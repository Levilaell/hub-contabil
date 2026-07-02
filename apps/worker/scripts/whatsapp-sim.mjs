// Simulador de entrada WhatsApp (Meta Cloud) para TESTE MANUAL.
//
// POSTa um webhook ASSINADO (HMAC-SHA256 com o WHATSAPP_APP_SECRET real) na rota
// real do app — exatamente o que a Meta faz — sem precisar de túnel público. No modo
// documento, sobe um PDF de verdade para a Meta (/{phone_number_id}/media) e usa o
// media id real, então o worker baixa os bytes de graph.facebook.com como num envio real.
//
// Requer: web (localhost:3000) e worker rodando; credenciais válidas nos .env.
//
// Uso:
//   node scripts/whatsapp-sim.mjs text "Olá, minha guia deste mês já saiu?"
//   node scripts/whatsapp-sim.mjs doc                 (gera um PDF mínimo)
//   node scripts/whatsapp-sim.mjs doc /caminho/nota.pdf
//
// Depois: abra /atendimento (texto) ou /documentos (documento) no navegador.

import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const readEnv = (file) => {
  const txt = readFileSync(resolve(here, file), 'utf8');
  return (k) => (new RegExp(`^${k}=(.*)$`, 'm').exec(txt)?.[1] || '').trim();
};
const worker = readEnv('../.env');
const web = readEnv('../../web/.env.local');

const TOKEN = worker('WHATSAPP_ACCESS_TOKEN');
const PHONE = worker('WHATSAPP_PHONE_NUMBER_ID');
const APP_SECRET = web('WHATSAPP_APP_SECRET'); // a rota verifica com o secret do WEB
const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';
const GRAPH = 'https://graph.facebook.com/v21.0';

const mode = process.argv[2] || 'text';
const arg = process.argv[3];

function minimalPdf(text) {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 340 120] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  ];
  const s = `BT /F1 15 Tf 18 60 Td (${text}) Tj ET`;
  objs.push(`<< /Length ${s.length} >>\nstream\n${s}\nendstream`);
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let pdf = '%PDF-1.4\n';
  const off = [];
  objs.forEach((o, i) => {
    off.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  off.forEach((o) => (pdf += String(o).padStart(10, '0') + ' 00000 n \n'));
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

async function uploadMedia(bytes, mime, name) {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('file', new Blob([bytes], { type: mime }), name);
  form.append('type', mime);
  const r = await fetch(`${GRAPH}/${PHONE}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form,
  });
  const b = await r.text();
  if (r.status !== 200) throw new Error(`upload media falhou HTTP ${r.status}: ${b.slice(0, 200)}`);
  return JSON.parse(b).id;
}

async function post(payload) {
  const raw = JSON.stringify(payload);
  const sig = 'sha256=' + createHmac('sha256', APP_SECRET).update(raw, 'utf8').digest('hex');
  const r = await fetch(`${WEB_URL}/api/webhooks/whatsapp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig },
    body: raw,
  });
  return r.status;
}

function envelope(sender, name, message) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15556568634', phone_number_id: PHONE },
              contacts: [{ profile: { name }, wa_id: sender }],
              messages: [message],
            },
          },
        ],
      },
    ],
  };
}

const stamp = Date.now();
const sender = '55139' + String(stamp).slice(-8);
const wamid = 'wamid.SIM' + stamp;

if (mode === 'text') {
  const body = arg || 'Olá! Minha guia deste mês já saiu?';
  const status = await post(
    envelope(sender, 'Cliente Teste', {
      from: sender,
      id: wamid,
      timestamp: String(Math.floor(stamp / 1000)),
      type: 'text',
      text: { body },
    }),
  );
  console.log(`[text] webhook → HTTP ${status} ${status === 200 ? '(aceito)' : '(REJEITADO)'}`);
  console.log(`       remetente: ${sender} | mensagem: "${body}"`);
  console.log('       → abra /atendimento e procure o ticket "Cliente Teste".');
} else if (mode === 'doc') {
  const bytes = arg ? readFileSync(arg) : minimalPdf('Nota Fiscal - Teste Manual WhatsApp');
  const fileName = arg ? arg.split('/').pop() : 'nota-fiscal.pdf';
  console.log(`[doc] subindo "${fileName}" (${bytes.length} bytes) para a Meta...`);
  const mediaId = await uploadMedia(bytes, 'application/pdf', fileName);
  console.log(`      media id real: ${mediaId}`);
  const status = await post(
    envelope(sender, 'Cliente Teste', {
      from: sender,
      id: wamid,
      timestamp: String(Math.floor(stamp / 1000)),
      type: 'document',
      document: { id: mediaId, mime_type: 'application/pdf', filename: fileName },
    }),
  );
  console.log(`      webhook → HTTP ${status} ${status === 200 ? '(aceito)' : '(REJEITADO)'}`);
  console.log('      → o worker baixa da Meta e fila na triagem. Veja em /documentos e /excecoes.');
} else {
  console.log('modo inválido. use: text | doc');
  process.exit(1);
}
