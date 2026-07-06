// Reception menu (URA) for the atendimento channel (Fase 1.1 §4, partner spec).
// A NEW conversation is greeted with a numbered department menu; the client's
// pick tags the ticket with a department. Deterministic automation, not AI —
// the support assistant only sees messages the menu passes through.
//
// Client vocabulary (mirrors the firm's previous chatbot): a number picks an
// option, "voltar" returns to the menu, "fim" ends the conversation.

export interface ReceptionOption {
  label: string; // what the client sees ("📊 Contabilidade")
  department: string; // firm-config department key
}

export interface ReceptionConfig {
  enabled: boolean;
  greeting: string;
  options: ReceptionOption[];
}

export type ReceptionAction =
  | { kind: 'send_menu' }
  | { kind: 'select'; option: ReceptionOption }
  | { kind: 'close' }
  /** Not a menu interaction — hand the message to the assistant/human flow. */
  | { kind: 'pass' };

const BACK_WORDS = new Set(['voltar', 'menu']);
const END_WORDS = new Set(['fim', 'encerrar', 'sair']);

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

/** Menu text sent to the client: greeting + numbered options + footer. */
export function buildReceptionMenu(config: ReceptionConfig): string {
  const lines = config.options.map((opt, i) => `${i + 1} — ${opt.label}`);
  return [
    config.greeting,
    '',
    ...lines,
    '',
    '🔄 Digite *voltar* para retornar ao menu',
    '❌ Digite *fim* para encerrar o atendimento',
  ].join('\n');
}

/**
 * Decide what the reception does with an inbound message. `ticketDepartment`
 * null means the conversation has not been routed yet.
 */
export function decideReception(input: {
  config: ReceptionConfig;
  ticketDepartment: string | null;
  text: string;
}): ReceptionAction {
  const { config, ticketDepartment } = input;
  if (!config.enabled || config.options.length === 0) return { kind: 'pass' };

  const text = normalize(input.text);
  if (END_WORDS.has(text)) return { kind: 'close' };
  if (BACK_WORDS.has(text)) return { kind: 'send_menu' };

  // Not routed yet: only a valid option number advances; anything else
  // (re-)presents the menu so the client always knows where they are.
  if (!ticketDepartment) {
    const pick = /^\d{1,2}$/.test(text) ? Number(text) : null;
    const option = pick !== null ? config.options[pick - 1] : undefined;
    if (option) return { kind: 'select', option };
    return { kind: 'send_menu' };
  }

  return { kind: 'pass' };
}

/** Confirmation sent right after a pick, inviting the actual question. */
export function buildReceptionConfirmation(option: ReceptionOption): string {
  return `✅ ${option.label} — pode enviar sua mensagem que a equipe responde por aqui.`;
}

/** Goodbye sent when the client ends the conversation. */
export const RECEPTION_GOODBYE =
  'Atendimento encerrado. Quando precisar, é só mandar outra mensagem. 👋';
