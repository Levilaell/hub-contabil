import { normalizeCnpj } from '@hub/core';

// CnpjEnrichmentAdapter (PLANEJAMENTO §8, golden rule #3 — every external
// integration behind an interface). v1: BrasilAPI primary, ReceitaWS fallback.
// Both are keyless public APIs (no secrets). Calls are throttled PER SOURCE:
// BrasilAPI asks for human-paced traffic (bursts get Cloudflare 403s) and
// ReceitaWS' free tier allows only ~3 req/min — the fallback gate spaces calls
// accordingly so a bulk import degrades to slow instead of dead-lettering.

/** Normalized cadastral data, source-independent. */
export interface CompanyEnrichment {
  legalName: string | null; // razão social
  tradeName: string | null; // nome fantasia
  legalNature: string | null; // natureza jurídica
  companySize: string | null; // enquadramento/porte (ME, EPP, DEMAIS…)
  shareCapital: number | null; // capital social
  activitiesStartedOn: string | null; // data de início das atividades (YYYY-MM-DD)
  cnaePrimaryCode: string | null;
  cnaePrimaryDescription: string | null;
  registrationStatus: string | null; // situação cadastral (ATIVA, BAIXADA…)
  simplesOptant: boolean | null;
  meiOptant: boolean | null;
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
  partners: CompanyEnrichmentPartner[]; // QSA (sócios)
}

export interface CompanyEnrichmentPartner {
  name: string;
  qualification: string | null; // qualificação (Sócio-Administrador…)
  cpfCnpj: string | null;
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
type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<FetchResponse>;

export interface BrasilApiAdapterOptions {
  fetchImpl?: FetchLike;
  /** Minimum ms between BrasilAPI calls (politeness). 0 disables — use in tests. */
  throttleMs?: number;
  /** Minimum ms between ReceitaWS calls (free tier ≈ 3 req/min). Defaults to 0 when throttleMs is 0. */
  receitawsThrottleMs?: number;
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

// Accepts a plain number, a dot-decimal string ("120000.00", ReceitaWS) or a
// pt-BR formatted string ("120.000,00").
function money(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const raw = value.replace(/[R$\s]/g, '');
  if (!raw) return null;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

// Accepts YYYY-MM-DD (BrasilAPI) or DD/MM/YYYY (ReceitaWS) → YYYY-MM-DD.
function isoDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Serializes calls through a gate and spaces them by `spacingMs`. One gate per
// upstream source → the adapter MUST be a singleton in the worker.
class ThrottleGate {
  private chain: Promise<void> = Promise.resolve();
  constructor(private readonly spacingMs: number) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.chain.then(async () => {
      const result = await fn();
      if (this.spacingMs > 0) await sleep(this.spacingMs);
      return result;
    });
    // Next caller waits for this one + its spacing; never reject the gate chain.
    this.chain = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }
}

function mapPartnersBrasilApi(value: unknown): CompanyEnrichmentPartner[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const name = text(row.nome_socio);
    if (!name) return [];
    return [
      {
        name,
        qualification: text(row.qualificacao_socio),
        cpfCnpj: text(row.cnpj_cpf_do_socio),
      },
    ];
  });
}

function mapPartnersReceitaWs(value: unknown): CompanyEnrichmentPartner[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const name = text(row.nome);
    if (!name) return [];
    return [{ name, qualification: text(row.qual), cpfCnpj: null }];
  });
}

// BrasilAPI /api/cnpj/v1 response → normalized shape.
function mapBrasilApi(body: Record<string, unknown>): CompanyEnrichment {
  return {
    legalName: text(body.razao_social),
    tradeName: text(body.nome_fantasia),
    legalNature: text(body.natureza_juridica),
    companySize: text(body.porte),
    shareCapital: money(body.capital_social),
    activitiesStartedOn: isoDate(body.data_inicio_atividade),
    cnaePrimaryCode: text(body.cnae_fiscal),
    cnaePrimaryDescription: text(body.cnae_fiscal_descricao),
    registrationStatus: text(body.descricao_situacao_cadastral),
    simplesOptant: bool(body.opcao_pelo_simples),
    meiOptant: bool(body.opcao_pelo_mei),
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
    partners: mapPartnersBrasilApi(body.qsa),
  };
}

// ReceitaWS response → normalized shape.
function mapReceitaWs(body: Record<string, unknown>): CompanyEnrichment {
  const activities = Array.isArray(body.atividade_principal) ? body.atividade_principal : [];
  const primary = (activities[0] ?? {}) as Record<string, unknown>;
  const simples = (body.simples ?? {}) as Record<string, unknown>;
  const simei = (body.simei ?? {}) as Record<string, unknown>;
  return {
    legalName: text(body.nome),
    tradeName: text(body.fantasia),
    legalNature: text(body.natureza_juridica),
    companySize: text(body.porte),
    shareCapital: money(body.capital_social),
    activitiesStartedOn: isoDate(body.abertura),
    cnaePrimaryCode: text(primary.code),
    cnaePrimaryDescription: text(primary.text),
    registrationStatus: text(body.situacao),
    simplesOptant: bool(simples.optante),
    meiOptant: bool(simei.optante),
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
    partners: mapPartnersReceitaWs(body.qsa),
  };
}

export class BrasilApiEnrichmentAdapter implements CnpjEnrichmentAdapter {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly receitawsFallback: boolean;
  private readonly brasilGate: ThrottleGate;
  private readonly receitaGate: ThrottleGate;

  constructor(options: BrasilApiAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.receitawsFallback = options.receitawsFallback ?? true;
    const brasilMs = options.throttleMs ?? 1500;
    this.brasilGate = new ThrottleGate(brasilMs);
    this.receitaGate = new ThrottleGate(options.receitawsThrottleMs ?? (brasilMs === 0 ? 0 : 21_000));
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

  // The timeout timer starts when the request actually FIRES, not while it waits
  // in the gate queue — otherwise a bulk import aborts queued calls before they run.
  private async fetchJson(
    gate: ThrottleGate,
    url: string,
  ): Promise<{ status: number; ok: boolean; body: unknown }> {
    return gate.run(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'hub-contabil/1.0 (cadastral enrichment)' },
        });
        const body = res.ok ? await res.json() : null;
        return { status: res.status, ok: res.ok, body };
      } finally {
        clearTimeout(timer);
      }
    });
  }

  private async tryBrasilApi(cnpj: string): Promise<EnrichmentOutcome> {
    try {
      const { ok, status, body } = await this.fetchJson(
        this.brasilGate,
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
      const { ok, status, body } = await this.fetchJson(
        this.receitaGate,
        `https://receitaws.com.br/v1/cnpj/${cnpj}`,
      );
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
