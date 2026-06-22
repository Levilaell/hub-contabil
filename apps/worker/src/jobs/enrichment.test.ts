import type { CnpjEnrichmentAdapter, EnrichmentOutcome } from '@hub/adapters';
import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createEnrichmentHandler } from './enrichment';

// Consumer test against the linked Supabase Cloud dev project, with a FAKE adapter
// (no external HTTP) — exercises the DB-write logic: enrichment_data, non-destructive
// column fill, robot audit. Skipped when DATABASE_URL is absent.

const DATABASE_URL = process.env.DATABASE_URL;
const hasEnv = Boolean(DATABASE_URL);
const FIRM = '11111111-1111-4111-8111-111111111111'; // Demo (seeded)

function fakeAdapter(outcome: EnrichmentOutcome): CnpjEnrichmentAdapter {
  return { enrich: () => Promise.resolve(outcome) };
}

const OK_OUTCOME: EnrichmentOutcome = {
  ok: true,
  source: 'brasilapi',
  data: {
    legalName: 'NOME OFICIAL LTDA',
    tradeName: 'Oficial',
    cnaePrimaryCode: '6201501',
    cnaePrimaryDescription: 'Desenvolvimento de software',
    registrationStatus: 'ATIVA',
    simplesOptant: true,
    email: 'contato@oficial.test',
    phone: '1133334444',
    address: {
      street: 'Rua X',
      number: '100',
      complement: null,
      district: 'Centro',
      city: 'Santos',
      state: 'SP',
      zip: '11000000',
    },
  },
};

describe.skipIf(!hasEnv)('enrichment consumer (cloud dev)', () => {
  let sql: Sql;
  const ids: string[] = [];

  async function insertCompany(cnpj: string, extra: Record<string, unknown> = {}): Promise<string> {
    const [row] = await sql<{ id: string }[]>`
      insert into public.companies ${sql({ firm_id: FIRM, cnpj, legal_name: 'Razão Original', ...extra })}
      returning id
    `;
    if (!row) throw new Error('insert returned no row');
    ids.push(row.id);
    return row.id;
  }

  beforeAll(() => {
    if (!DATABASE_URL) throw new Error('missing DATABASE_URL');
    sql = postgres(DATABASE_URL, { prepare: false });
  });

  afterAll(async () => {
    if (sql) {
      for (const id of ids) {
        await sql`delete from public.audit_events where entity_id = ${id}`;
        await sql`delete from public.companies where id = ${id}`;
      }
      await sql.end();
    }
  });

  it('stores enrichment_data and fills empty columns without touching legal_name', async () => {
    const id = await insertCompany('11222333000181');
    await createEnrichmentHandler(sql, fakeAdapter(OK_OUTCOME))({ firm_id: FIRM, company_id: id });

    const [row] = await sql<
      {
        legal_name: string;
        trade_name: string | null;
        city: string | null;
        state: string | null;
        enrichment_data: unknown;
      }[]
    >`
      select legal_name, trade_name, city, state, enrichment_data
      from public.companies where id = ${id}
    `;
    expect(row?.legal_name).toBe('Razão Original'); // non-destructive
    expect(row?.trade_name).toBe('Oficial');
    expect(row?.city).toBe('Santos');
    expect(row?.state).toBe('SP');

    const data = (
      typeof row?.enrichment_data === 'string'
        ? JSON.parse(row.enrichment_data)
        : row?.enrichment_data
    ) as { status?: string; source?: string };
    expect(data.status).toBe('done');
    expect(data.source).toBe('brasilapi');

    const audit = await sql`
      select 1 from public.audit_events
      where entity_id = ${id} and action = 'company.enriched'
    `;
    expect(audit.length).toBe(1);
  });

  it('does not overwrite an already-populated column', async () => {
    const id = await insertCompany('11444777000161', { city: 'Cidade Existente' });
    await createEnrichmentHandler(sql, fakeAdapter(OK_OUTCOME))({ firm_id: FIRM, company_id: id });
    const [row] = await sql<{ city: string | null }[]>`
      select city from public.companies where id = ${id}
    `;
    expect(row?.city).toBe('Cidade Existente');
  });

  it('throws on adapter failure so the runner retries/dead-letters', async () => {
    const id = await insertCompany('11222333000262');
    const handler = createEnrichmentHandler(
      sql,
      fakeAdapter({ ok: false, error: 'API fora do ar' }),
    );
    await expect(handler({ firm_id: FIRM, company_id: id })).rejects.toThrow(/fora do ar/);
  });

  it('skips quietly when the company no longer exists', async () => {
    const handler = createEnrichmentHandler(sql, fakeAdapter(OK_OUTCOME));
    await expect(
      handler({ firm_id: FIRM, company_id: '00000000-0000-4000-8000-000000000000' }),
    ).resolves.toBeUndefined();
  });
});
