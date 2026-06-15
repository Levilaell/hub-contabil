import type { CnpjEnrichmentAdapter } from '@hub/adapters';
import type { Sql } from 'postgres';

import type { EnrichmentPayload } from '../queue/payloads.js';

// Enrichment consumer (T7): look up the company, call the adapter, store the
// result in companies.enrichment_data and fill EMPTY cadastral columns only
// (non-destructive — never clobbers the user's razão social). A failed lookup
// throws so the runner retries with backoff then dead-letters (golden rule #6).

// Two-letter UF or null — guards the companies.state check constraint against a
// junk value from the upstream API failing the whole UPDATE.
function safeUf(value: string | null): string | null {
  return value && /^[A-Za-z]{2}$/.test(value) ? value.toUpperCase() : null;
}

export function createEnrichmentHandler(sql: Sql, adapter: CnpjEnrichmentAdapter) {
  return async function handle(payload: EnrichmentPayload): Promise<void> {
    const { firm_id, company_id } = payload;

    // Golden rule #1: the worker uses the service role (bypasses RLS), so every
    // query filters firm_id explicitly.
    const [company] = await sql<{ cnpj: string }[]>`
      select cnpj from public.companies
      where id = ${company_id} and firm_id = ${firm_id}
    `;
    if (!company) {
      // Company removed before the job ran — nothing to enrich, don't retry forever.
      console.warn(`[enrichment] company ${company_id} not found in firm ${firm_id}; skipping`);
      return;
    }

    const outcome = await adapter.enrich(company.cnpj);
    if (!outcome.ok) {
      // Throw → runner retries (exponential backoff) then DLQ → exception queue (T9).
      throw new Error(outcome.error);
    }

    const enrichmentData = {
      status: 'done',
      source: outcome.source,
      fetched_at: new Date().toISOString(),
      data: outcome.data,
    };
    const { tradeName, address } = outcome.data;

    // sql.json stores a real jsonb object; `${JSON.stringify(x)}::jsonb` would
    // double-encode it into a jsonb *string* (breaks ->> / jsonb_typeof queries).
    await sql`
      update public.companies set
        enrichment_data = ${sql.json(enrichmentData as unknown as Parameters<typeof sql.json>[0])},
        trade_name = coalesce(trade_name, ${tradeName}),
        city = coalesce(city, ${address.city}),
        state = coalesce(state, ${safeUf(address.state)})
      where id = ${company_id} and firm_id = ${firm_id}
    `;

    // Robot action → audit with a null actor (golden rule #7).
    await sql`
      insert into public.audit_events (firm_id, action, entity, entity_id, context)
      values (
        ${firm_id}, 'company.enriched', 'company', ${company_id},
        ${sql.json({ source: outcome.source })}
      )
    `;
  };
}
