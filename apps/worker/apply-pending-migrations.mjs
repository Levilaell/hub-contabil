// Dev utility: applies any migration files not yet recorded in
// supabase_migrations.schema_migrations, via DATABASE_URL from apps/worker/.env
// (no hardcoded secret). SQL is idempotent. Records each applied version so the
// Supabase CLI stays in sync. Run: node apply-pending-migrations.mjs
import { readdirSync, readFileSync } from 'node:fs';

import postgres from 'postgres';

const env = readFileSync(new URL('.env', import.meta.url), 'utf8');
const dbUrl = /^DATABASE_URL=(.*)$/m.exec(env)?.[1]?.trim();
if (!dbUrl) {
  console.error('DATABASE_URL not found in apps/worker/.env');
  process.exit(1);
}

const MIGRATIONS = new URL('../../packages/db/supabase/migrations/', import.meta.url);
const files = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const sql = postgres(dbUrl, { prepare: false, connect_timeout: 15, max: 1 });
try {
  const applied = new Set(
    (await sql`select version from supabase_migrations.schema_migrations`).map((r) => r.version),
  );
  for (const file of files) {
    const version = file.slice(0, 14);
    const name = file.slice(15, -4);
    if (applied.has(version)) continue;
    const ddl = readFileSync(new URL(file, MIGRATIONS), 'utf8');
    await sql.unsafe(ddl).simple();
    await sql`
      insert into supabase_migrations.schema_migrations (version, name)
      values (${version}, ${name}) on conflict (version) do nothing
    `;
    console.log(`✓ applied ${version} ${name}`);
  }
  console.log('done — all migrations applied.');
} catch (e) {
  console.error('ERROR', e.code ?? '', String(e.message).slice(0, 300));
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 3 });
}
