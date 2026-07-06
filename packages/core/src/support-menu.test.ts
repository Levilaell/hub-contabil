import { describe, expect, it } from 'vitest';

import { buildReceptionMenu, decideReception, type ReceptionConfig } from './support-menu';

const CONFIG: ReceptionConfig = {
  enabled: true,
  greeting: 'Escolha uma opção:',
  options: [
    { label: '📊 Contabilidade', department: 'contabil' },
    { label: '👥 Departamento Pessoal', department: 'dp' },
    { label: '🧾 Fiscal', department: 'fiscal' },
  ],
};

describe('decideReception', () => {
  it('passes everything through when the menu is disabled', () => {
    const action = decideReception({
      config: { ...CONFIG, enabled: false },
      ticketDepartment: null,
      text: 'olá',
    });
    expect(action).toEqual({ kind: 'pass' });
  });

  it('passes everything through when there are no options', () => {
    const action = decideReception({
      config: { ...CONFIG, options: [] },
      ticketDepartment: null,
      text: '1',
    });
    expect(action).toEqual({ kind: 'pass' });
  });

  it('greets an unrouted conversation with the menu', () => {
    const action = decideReception({ config: CONFIG, ticketDepartment: null, text: 'bom dia' });
    expect(action).toEqual({ kind: 'send_menu' });
  });

  it('a valid number picks the option', () => {
    const action = decideReception({ config: CONFIG, ticketDepartment: null, text: ' 2 ' });
    expect(action).toEqual({ kind: 'select', option: CONFIG.options[1] });
  });

  it('an out-of-range number re-presents the menu', () => {
    const action = decideReception({ config: CONFIG, ticketDepartment: null, text: '9' });
    expect(action).toEqual({ kind: 'send_menu' });
  });

  it('a routed conversation passes messages to the assistant/human', () => {
    const action = decideReception({
      config: CONFIG,
      ticketDepartment: 'contabil',
      text: 'qual o status da minha empresa?',
    });
    expect(action).toEqual({ kind: 'pass' });
  });

  it('"voltar" re-opens the menu even after routing', () => {
    const action = decideReception({ config: CONFIG, ticketDepartment: 'dp', text: 'Voltar' });
    expect(action).toEqual({ kind: 'send_menu' });
  });

  it('"fim" closes the conversation at any point', () => {
    expect(decideReception({ config: CONFIG, ticketDepartment: null, text: 'fim' })).toEqual({
      kind: 'close',
    });
    expect(decideReception({ config: CONFIG, ticketDepartment: 'fiscal', text: 'FIM' })).toEqual({
      kind: 'close',
    });
  });
});

describe('buildReceptionMenu', () => {
  it('renders greeting, numbered options and the voltar/fim footer', () => {
    const menu = buildReceptionMenu(CONFIG);
    expect(menu).toContain('Escolha uma opção:');
    expect(menu).toContain('1 — 📊 Contabilidade');
    expect(menu).toContain('3 — 🧾 Fiscal');
    expect(menu).toContain('voltar');
    expect(menu).toContain('fim');
  });
});
