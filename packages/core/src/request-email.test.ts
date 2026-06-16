import { describe, expect, it } from 'vitest';

import { buildRequestEmail } from './request-email';

describe('buildRequestEmail', () => {
  const base = {
    firmName: 'Contabilidade M Rocha',
    companyName: 'Padaria do Zé',
    title: 'Envie o contrato social',
    link: 'https://app.test/s/tok123',
    kind: 'upload_request' as const,
  };

  it('includes the link in both text and HTML bodies', () => {
    const email = buildRequestEmail(base);
    expect(email.body).toContain('https://app.test/s/tok123');
    expect(email.html).toContain('https://app.test/s/tok123');
    expect(email.subject).toContain('M Rocha');
  });

  it('uses a reminder subject/lead when reminder=true', () => {
    const email = buildRequestEmail({ ...base, reminder: true });
    expect(email.subject.toLowerCase()).toContain('lembrete');
    expect(email.body.toLowerCase()).toContain('lembrete');
  });

  it('escapes HTML in firm-supplied fields', () => {
    const email = buildRequestEmail({ ...base, title: 'A < B & "C"' });
    expect(email.html).toContain('A &lt; B &amp; &quot;C&quot;');
    expect(email.html).not.toContain('A < B & "C"');
  });
});
