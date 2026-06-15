import { normalizeCnpj } from '@hub/core';

// CnpjEnrichmentAdapter (PLANEJAMENTO §8, golden rule #3 — every external
// integration behind an interface). v1: BrasilAPI primary, ReceitaWS fallback.
// Both are keyless public APIs (no secrets). Calls are throttled: BrasilAPI asks
// for human-paced traffic (no bulk hammering) and ReceitaWS' free tier allows
// only ~3 req/min, so the fallback is a last resort.

/** Normalized cadastral data, source-independent. */
export interface CompanyEnrichment {
  legalName: string | null; // razão social
  tradeName: string | null; // nome fantasia
  cnaePrimaryCode: string | null;
  cnaePrimaryDescription: string | null;
  registrationStatus: string | null; // situação cadastral (ATIVA, BAIXADA…)
  simplesOptant: boolean | null;
  email: string | null;
  phone: string | null;
  address: {
    street: string | null;
    number: string | null;
    complement: string | null;
    district: string | null;
    city: string | null;
    state: string | null; // UF
    zip: string | null;
  };
}

export type EnrichmentSource = 'brasilapi' | 'receitaws';

export type EnrichmentOutcome =
  | { ok: true; source: EnrichmentSource; data: CompanyEnrichment }
  | { ok: false; error: string };

export interface CnpjEnrichmentAdapter {
  enrich(cnpj: string): Promise<EnrichmentOutcome>;
}

// Minimal structural shape of the bits of fetch/Response we use — lets tests
// inject a fake without pulling in DOM lib types.
type FetchResponse = { ok: boolean; status: number; json: () => Promise<unknown> };
type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<FetchResponse>;

export interface BrasilApiAdapterOptions {
  fetchImpl?: FetchLike;
  /** Minimum ms between outbound calls (politeness). 0 disables — use in tests. */
  throttleMs?: number;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
  /** Fall back to ReceitaWS when BrasilAPI fails. */
  receitawsFallback?: boolean;
}

function text(value: unknown): string | null {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// BrasilAPI /api/cnpj/v1 response → normalized shape.
function mapBrasilApi(body: Record<string, unknown>): CompanyEnrichment {
  return {
    legalName: text(body.razao_social),
    tradeName: text(body.nome_fantasia),
    cnaePrimaryCode: text(body.cnae_fiscal),
    cnaePrimaryDescription: text(body.cnae_fiscal_descricao),
    registrationStatus: text(body.descricao_situacao_cadastral),
    simplesOptant: bool(body.opcao_pelo_simples),
    email: text(body.email),
    phone: text(body.ddd_telefone_1),
    address: {
      street: text(body.logradouro),
      number: text(body.numero),
      complement: text(body.complemento),
      district: text(body.bairro),
      city: text(body.municipio),
      state: text(body.uf),
      zip: text(body.cep),
    },
  };
}

// ReceitaWS response → normalized shape.
function mapReceitaWs(body: Record<string, unknown>): CompanyEnrichment {
  const activities = Array.isArray(body.atividade_principal) ? body.atividade_principal : [];
  const primary = (activities[0] ?? {}) as Record<string, unknown>;
  const simples = (body.simples ?? {}) as Record<string, unknown>;
  return {
    legalName: text(body.nome),
    tradeName: text(body.fantasia),
    cnaePrimaryCode: text(primary.code),
    cnaePrimaryDescription: text(primary.text),
    registrationStatus: text(body.situacao),
    simplesOptant: bool(simples.optante),
    email: text(body.email),
    phone: text(body.telefone),
    address: {
      street: text(body.logradouro),
      number: text(body.numero),
      complement: text(body.complemento),
      district: text(body.bairro),
      city: text(body.municipio),
      state: text(body.uf),
      zip: text(body.cep),
    },
  };
}

export class BrasilApiEnrichmentAdapter implements CnpjEnrichmentAdapter {
  private readonly fetchImpl: FetchLike;
  private readonly throttleMs: number;
  private readonly timeoutMs: number;
  private readonly receitawsFallback: boolean;
  // Serializes outbound calls and spaces them by throttleMs. Shared across all
  // enrich() calls → the adapter MUST be a singleton in the worker.
  private gate: Promise<void> = Promise.resolve();

  constructor(options: BrasilApiAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.throttleMs = options.throttleMs ?? 1000;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.receitawsFallback = options.receitawsFallback ?? true;
  }

  async enrich(cnpj: string): Promise<EnrichmentOutcome> {
    const digits = normalizeCnpj(cnpj);
    if (digits.length !== 14) {
      return { ok: false, error: 'CNPJ inválido para enriquecimento.' };
    }

    const brasil = await this.tryBrasilApi(digits);
    if (brasil.ok || !this.receitawsFallback) return brasil;

    const receita = await this.tryReceitaWs(digits);
    if (receita.ok) return receita;
    return { ok: false, error: `${brasil.error}; ${receita.error}` };
  }

  private async withThrottle<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.gate.then(async () => {
      const result = await fn();
      if (this.throttleMs > 0) await sleep(this.throttleMs);
      return result;
    });
    // Next caller waits for this one + its spacing; never reject the gate chain.
    this.gate = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async fetchJson(url: string): Promise<{ status: number; ok: boolean; body: unknown }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.withThrottle(() => this.fetchImpl(url, { signal: controller.signal }));
      const body = res.ok ? await res.json() : null;
      return { status: res.status, ok: res.ok, body };
    } finally {
      clearTimeout(timer);
    }
  }

  private async tryBrasilApi(cnpj: string): Promise<EnrichmentOutcome> {
    try {
      const { ok, status, body } = await this.fetchJson(
        `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
      );
      if (!ok || !body || typeof body !== 'object') {
        return { ok: false, error: `BrasilAPI HTTP ${status}` };
      }
      return { ok: true, source: 'brasilapi', data: mapBrasilApi(body as Record<string, unknown>) };
    } catch (error) {
      return { ok: false, error: `BrasilAPI: ${error instanceof Error ? error.message : 'erro'}` };
    }
  }

  private async tryReceitaWs(cnpj: string): Promise<EnrichmentOutcome> {
    try {
      const { ok, status, body } = await this.fetchJson(`https://receitaws.com.br/v1/cnpj/${cnpj}`);
      if (!ok || !body || typeof body !== 'object') {
        return { ok: false, error: `ReceitaWS HTTP ${status}` };
      }
      const record = body as Record<string, unknown>;
      // ReceitaWS signals failure with HTTP 200 + { status: 'ERROR', message }.
      if (record.status === 'ERROR') {
        return { ok: false, error: `ReceitaWS: ${text(record.message) ?? 'erro'}` };
      }
      return { ok: true, source: 'receitaws', data: mapReceitaWs(record) };
    } catch (error) {
      return { ok: false, error: `ReceitaWS: ${error instanceof Error ? error.message : 'erro'}` };
    }
  }
}
