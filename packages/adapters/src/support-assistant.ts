import Anthropic from '@anthropic-ai/sdk';

// SupportAssistantAdapter (golden rule #3, atendimento). Given a client's WhatsApp
// question plus the firm's own context (the company's status, pending items) and a
// configurable FAQ, it drafts a reply, judges whether the question is within the
// firm's declared scope, and gives a confidence. The decision to send vs escalate
// lives in core (decideSupportResponse) — the AI never decides alone (#5). Behind
// this interface so the worker never imports the SDK directly and tests inject a
// fake. The factory returns Anthropic when a key is set, else a heuristic no-op
// that always escalates (confidence 0, out of scope) so a human handles everything.

export interface SupportAssistantInput {
  question: string;
  /** Firm/company context the model may use (status, pendências) — pt-BR text. */
  context: string;
  /** Firm FAQ entries (config), each "pergunta → resposta". */
  faq: { q: string; a: string }[];
  /** Anthropic model id (firm config). */
  model: string;
}

export interface SupportAssistantResult {
  reply: string;
  confidence: number; // clamped 0..1
  inScope: boolean;
}

export interface SupportAssistantAdapter {
  answer(input: SupportAssistantInput): Promise<SupportAssistantResult>;
}

const SYSTEM =
  'Você é o assistente de um escritório de contabilidade brasileiro, respondendo clientes no WhatsApp. ' +
  'Use SOMENTE o contexto e o FAQ fornecidos. Responda em pt-BR, curto e claro. ' +
  'NUNCA invente prazos, valores ou orientação fiscal que não estejam no contexto. ' +
  'Se a pergunta fugir do escopo (consultoria, cálculo fiscal, algo sem resposta no contexto), marque inScope=false. ' +
  'Dê uma confiança de 0 a 1. Responda apenas pela ferramenta.';

function clampConfidence(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Heuristic fallback when no Anthropic key is configured: escalates everything to a
 *  human (confidence 0, out of scope), so atendimento still works without the AI. */
export class HeuristicSupportAssistant implements SupportAssistantAdapter {
  answer(): Promise<SupportAssistantResult> {
    return Promise.resolve({ reply: '', confidence: 0, inScope: false });
  }
}

export interface AnthropicSupportOptions {
  apiKey: string;
  client?: Anthropic;
}

export class AnthropicSupportAssistant implements SupportAssistantAdapter {
  private readonly client: Anthropic;

  constructor(opts: AnthropicSupportOptions) {
    this.client = opts.client ?? new Anthropic({ apiKey: opts.apiKey });
  }

  async answer(input: SupportAssistantInput): Promise<SupportAssistantResult> {
    const faqText = input.faq.length
      ? input.faq.map((f, i) => `${i + 1}. P: ${f.q}\n   R: ${f.a}`).join('\n')
      : '(sem FAQ cadastrado)';

    const response = await this.client.messages.create({
      model: input.model,
      max_tokens: 700,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Contexto da empresa:\n${input.context || '(sem contexto)'}\n\nFAQ do escritório:\n${faqText}\n\nPergunta do cliente:\n${input.question.slice(0, 4000)}`,
            },
          ],
        },
      ],
      tools: [
        {
          name: 'draft_reply',
          description: 'Registra a resposta sugerida ao cliente.',
          input_schema: {
            type: 'object',
            properties: {
              reply: { type: 'string', description: 'Resposta em pt-BR para o cliente.' },
              confidence: { type: 'number', description: 'Confiança de 0 a 1.' },
              inScope: {
                type: 'boolean',
                description: 'A pergunta está dentro do escopo respondível pelo contexto?',
              },
            },
            required: ['reply', 'confidence', 'inScope'],
            additionalProperties: false,
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'draft_reply' },
    });

    if (response.stop_reason === 'refusal') {
      return { reply: '', confidence: 0, inScope: false };
    }

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    const raw = (toolUse?.input ?? {}) as Record<string, unknown>;
    return {
      reply: typeof raw.reply === 'string' ? raw.reply : '',
      confidence: clampConfidence(raw.confidence),
      inScope: raw.inScope === true,
    };
  }
}

export interface SupportAssistantEnv {
  ANTHROPIC_API_KEY?: string;
  [key: string]: string | undefined;
}

/** Anthropic when a key is configured, else the heuristic no-op (worker). */
export function createSupportAssistant(
  env: SupportAssistantEnv = process.env,
): SupportAssistantAdapter {
  if (env.ANTHROPIC_API_KEY) {
    return new AnthropicSupportAssistant({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return new HeuristicSupportAssistant();
}
