// Request-delivery e-mail templates (T17). Pure — builds the subject/text/HTML
// for the access link. The single place the pt-BR e-mail copy lives, shared by
// the web send action and the worker reminder sweep (core has no IO, so it can't
// import the adapter; callers add `to` and pass the result to sendEmail).

import type { RequestKind } from './request';

export interface RequestEmailInput {
  firmName: string;
  companyName: string;
  title: string;
  description?: string;
  link: string;
  kind: RequestKind;
  /** A nudge for a link already delivered but not yet opened. */
  reminder?: boolean;
}

export interface BuiltEmail {
  subject: string;
  body: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildRequestEmail(input: RequestEmailInput): BuiltEmail {
  const isUpload = input.kind === 'upload_request';
  const action = isUpload ? 'Enviar documento' : 'Acessar documento';
  const lead = input.reminder
    ? `Lembrete: ${input.firmName} ainda aguarda sua resposta sobre "${input.title}".`
    : isUpload
      ? `${input.firmName} solicitou um documento referente a ${input.companyName}.`
      : `${input.firmName} disponibilizou um documento referente a ${input.companyName}.`;

  const subject = input.reminder
    ? `Lembrete — ${input.title}`
    : isUpload
      ? `${input.firmName}: documento solicitado`
      : `${input.firmName}: documento disponível`;

  const descLine = input.description ? `\n\n${input.description}` : '';
  const body = `${lead}\n\n${input.title}${descLine}\n\n${action}: ${input.link}\n\n— ${input.firmName}`;

  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <p style="font-size:14px;color:#555">${escapeHtml(lead)}</p>
  <h1 style="font-size:18px;margin:16px 0 4px">${escapeHtml(input.title)}</h1>
  ${input.description ? `<p style="font-size:14px;color:#555">${escapeHtml(input.description)}</p>` : ''}
  <p style="margin:24px 0">
    <a href="${escapeHtml(input.link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px">${action}</a>
  </p>
  <p style="font-size:12px;color:#888">${escapeHtml(input.firmName)}</p>
</div>`;

  return { subject, body, html };
}
