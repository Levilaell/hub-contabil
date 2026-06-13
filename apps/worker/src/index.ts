import postgres from 'postgres';

import { loadEnv } from './env.js';

// T1 bootstrap: prove connectivity to Supabase Cloud and stay alive.
// pgmq consumers and crons arrive in T5.
async function main(): Promise<void> {
  const env = loadEnv();
  const sql = postgres(env.DATABASE_URL);

  const [row] = await sql<{ now: Date; version: string }[]>`
    select now() as now, version() as version
  `;
  if (!row) {
    throw new Error('Connectivity probe returned no rows');
  }
  console.log(`[worker] connected to Supabase Cloud — db time ${row.now.toISOString()}`);
  console.log(`[worker] ${row.version}`);

  const heartbeat = setInterval(() => {
    console.log(`[worker] heartbeat ${new Date().toISOString()}`);
  }, 30_000);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[worker] ${signal} received, closing`);
    clearInterval(heartbeat);
    await sql.end({ timeout: 5 });
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error('[worker] fatal during startup:', error);
  process.exit(1);
});
