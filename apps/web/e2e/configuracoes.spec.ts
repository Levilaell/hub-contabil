import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

// Audit viewer + advanced-config editor (Configurações). Both are owner/manager-only.
// The audit test seeds one event via the service role and reads it back (list + drawer);
// the advanced test edits the taxonomy through the UI and confirms it persisted, then
// restores the firm's original config.

const FIRM = '11111111-1111-4111-8111-111111111111';
const dbEnv = readFileSync(resolve(process.cwd(), '../../packages/db/.env'), 'utf8');
const get = (k: string) => new RegExp(`^${k}=(.*)$`, 'm').exec(dbEnv)?.[1]?.trim() ?? '';
const SUPABASE_URL = get('SUPABASE_URL');
const SERVICE = get('SUPABASE_SERVICE_ROLE_KEY');

test.describe('auditoria', () => {
  let service: SupabaseClient;
  const stamp = Date.now();
  const marker = `e2e.marker.${stamp}`;
  const value = `auditoria-e2e-${stamp}`;
  let eventId = '';

  test.beforeAll(async () => {
    service = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
    const { data } = await service
      .from('audit_events')
      .insert({ firm_id: FIRM, action: marker, entity: 'firm', context: { marca: value } })
      .select('id')
      .single();
    eventId = (data as { id: string }).id;
  });

  test.afterAll(async () => {
    if (service && eventId) await service.from('audit_events').delete().eq('id', eventId);
  });

  test('shows the event and its context inline (no click needed)', async ({ page }) => {
    await page.goto('/auditoria');
    await expect(page.getByText(marker)).toBeVisible(); // unmapped action → raw string
    await expect(page.getByText(value)).toBeVisible(); // context shown inline
  });
});

test.describe('configuração avançada', () => {
  let service: SupabaseClient;
  let original: unknown = null;
  const type = `e2e_tipo_${Date.now()}`;

  test.beforeAll(async () => {
    service = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
    const { data } = await service.from('firms').select('config').eq('id', FIRM).single();
    original = (data as { config: unknown }).config;
  });

  test.afterAll(async () => {
    if (service && original !== null) {
      await service.from('firms').update({ config: original }).eq('id', FIRM);
    }
  });

  test('adds a document type through the UI and it persists', async ({ page }) => {
    await page.goto('/configuracoes/avancado');
    const input = page.getByPlaceholder('novo tipo (ex.: nfe, recibo)');
    await input.fill(type);
    await expect(input).toHaveValue(type); // React flushed the controlled state
    await page.getByRole('button', { name: 'Adicionar tipo' }).click();
    // The new type shows both as a chip and in the routing list → assert the first.
    await expect(page.getByText(type).first()).toBeVisible();
    await page.getByRole('button', { name: 'Salvar configuração' }).click();
    await expect(page.getByText('Configuração salva.')).toBeVisible();

    // Persisted to firms.config.taxonomy.
    await expect
      .poll(async () => {
        const { data } = await service.from('firms').select('config').eq('id', FIRM).single();
        const cfg = (data as { config: { taxonomy?: string[] } }).config;
        return cfg.taxonomy?.includes(type) ?? false;
      })
      .toBe(true);
  });
});
