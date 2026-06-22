import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  // Accelerated crons (every 10s) for dev observation; off in prod.
  CRON_ACCELERATED: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((value) => value === 'true' || value === '1'),
  // Min ms between outbound CNPJ-enrichment calls (politeness; BrasilAPI asks for
  // human-paced traffic). Default 1000.
  ENRICHMENT_THROTTLE_MS: z.coerce.number().int().min(0).optional(),
  // AI triage (T20). When absent the pipeline falls back to the heuristic adapter
  // (everything → exception queue), so the worker still runs without a key.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid worker environment, check .env: ${missing}`);
  }
  return parsed.data;
}
