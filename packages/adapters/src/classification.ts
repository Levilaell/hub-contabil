import Anthropic from '@anthropic-ai/sdk';

// ClassificationAdapter (PLANEJAMENTO §8/§M10, golden rule #3). The AI triage
// pipeline (T20 worker) classifies a document's type, extracts its CNPJ, and gives
// a confidence — behind this interface so the worker never imports the SDK directly
// and tests can inject a fake. XML never reaches here (deterministic parser in core
// handles NF-e). The factory returns the Anthropic implementation when a key is
// configured, else a heuristic no-op so the pipeline still runs (everything lands in
// the exception queue for a human — golden rule #5).

export interface ClassificationInput {
  /** Closed taxonomy (firm config) the type must come from. */
  taxonomy: readonly string[];
  fileName: string;
  /** Anthropic model id (firm config); the Anthropic adapter honors it. */
  model: string;
  /** PDF/image bytes for vision. media XOR text. */
  media?: { mediaType: string; base64: string };
  /** Already-extracted text (non-NF-e XML fallback and plain-text docs). */
  text?: string;
  /** Recent human corrections (few-shot): what the firm decided for similar files. */
  examples?: { fileName: string | null; docType: string }[];
  /** Firm department keys — when set, the model also suggests the department the
   *  document's CONTENT belongs to (types without a fixed route, Fase 1.1). */
  departments?: readonly string[];
}

export interface ClassificationResult {
  docType: string;
  confidence: number; // clamped 0..1
  cnpj: string | null; // 14-digit, or null
  /** Content-based department suggestion (validated against input.departments). */
  department: string | null;
}

export interface ClassificationAdapter {
  classify(input: ClassificationInput): Promise<ClassificationResult>;
}

const SYSTEM =
  'Você classifica documentos contábeis/fiscais brasileiros. Escolha o ÚNICO tipo que melhor descreve o documento, a partir da taxonomia fornecida. Extraia o CNPJ principal (14 dígitos, só números) se houver, senão null. Quando uma lista de departamentos for fornecida, indique também a qual departamento o CONTEÚDO do documento pertence (ex.: um comprovante de pagamento de folha é do departamento pessoal; um boleto de imposto é do fiscal), senão null. Dê uma confiança de 0 a 1 (quão certo você está). Responda apenas pela ferramenta.';

function clampConfidence(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function cleanCnpj(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  return digits.length === 14 ? digits : null;
}

/** Heuristic fallback used when no Anthropic key is configured: defers everything to
 *  a human by returning zero confidence (→ exception queue). */
export class HeuristicClassificationAdapter implements ClassificationAdapter {
  classify(input: ClassificationInput): Promise<ClassificationResult> {
    const fallback = input.taxonomy.includes('other') ? 'other' : (input.taxonomy[0] ?? 'other');
    return Promise.resolve({ docType: fallback, confidence: 0, cnpj: null, department: null });
  }
}

export interface AnthropicClassificationOptions {
  apiKey: string;
  client?: Anthropic; // injectable for tests
}

export class AnthropicClassificationAdapter implements ClassificationAdapter {
  private readonly client: Anthropic;

  constructor(opts: AnthropicClassificationOptions) {
    this.client = opts.client ?? new Anthropic({ apiKey: opts.apiKey });
  }

  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    const fallbackType = input.taxonomy.includes('other')
      ? 'other'
      : (input.taxonomy[0] ?? 'other');

    const content: Anthropic.ContentBlockParam[] = [];
    if (input.media) {
      if (input.media.mediaType === 'application/pdf') {
        content.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: input.media.base64 },
        });
      } else if (input.media.mediaType.startsWith('image/')) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: input.media.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: input.media.base64,
          },
        });
      }
    }
    if (input.text) content.push({ type: 'text', text: input.text.slice(0, 20_000) });
    // Few-shot from human corrections: the firm's own decisions steer borderline
    // cases (golden rule #5 — resolutions feed back examples).
    const examples = (input.examples ?? []).filter((e) => e.docType);
    if (examples.length > 0) {
      const lines = examples
        .slice(0, 12)
        .map((e) => `- ${e.fileName ? `arquivo "${e.fileName}"` : 'documento'} → ${e.docType}`)
        .join('\n');
      content.push({
        type: 'text',
        text: `Classificações anteriores confirmadas por humanos neste escritório (referência):\n${lines}`,
      });
    }
    const departments = input.departments ?? [];
    content.push({
      type: 'text',
      text:
        `Arquivo: ${input.fileName}\nTaxonomia: ${input.taxonomy.join(', ')}` +
        (departments.length > 0 ? `\nDepartamentos: ${departments.join(', ')}` : '') +
        '\nClassifique este documento.',
    });

    const response = await this.client.messages.create({
      model: input.model,
      max_tokens: 512,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
      tools: [
        {
          name: 'classify_document',
          description: 'Registra a classificação do documento.',
          input_schema: {
            type: 'object',
            properties: {
              docType: { type: 'string', enum: [...input.taxonomy] },
              confidence: { type: 'number', description: 'Confiança de 0 a 1.' },
              cnpj: { type: ['string', 'null'], description: 'CNPJ de 14 dígitos ou null.' },
              department: {
                type: ['string', 'null'],
                description:
                  'Departamento responsável pelo CONTEÚDO do documento (um dos fornecidos) ou null.',
              },
            },
            required: ['docType', 'confidence', 'cnpj', 'department'],
            additionalProperties: false,
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'classify_document' },
    });

    // A safety refusal (HTTP 200, stop_reason refusal) → defer to a human.
    if (response.stop_reason === 'refusal') {
      return { docType: fallbackType, confidence: 0, cnpj: null, department: null };
    }

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    const raw = (toolUse?.input ?? {}) as Record<string, unknown>;
    const docType =
      typeof raw.docType === 'string' && input.taxonomy.includes(raw.docType)
        ? raw.docType
        : fallbackType;
    return {
      docType,
      confidence: clampConfidence(raw.confidence),
      cnpj: cleanCnpj(raw.cnpj),
      department:
        typeof raw.department === 'string' && departments.includes(raw.department)
          ? raw.department
          : null,
    };
  }
}

export interface ClassificationEnv {
  ANTHROPIC_API_KEY?: string;
  [key: string]: string | undefined;
}

/** Anthropic when a key is configured, else the heuristic no-op (web + worker). */
export function createClassificationAdapter(
  env: ClassificationEnv = process.env,
): ClassificationAdapter {
  if (env.ANTHROPIC_API_KEY) {
    return new AnthropicClassificationAdapter({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return new HeuristicClassificationAdapter();
}
