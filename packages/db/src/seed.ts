import { type User, createClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

// Seeds the M Rocha firm + one user per role into the linked Supabase Cloud
// project. Uses the service role (bypasses RLS). Idempotent — safe to re-run.
// firm_id and role go into auth app_metadata, which Supabase embeds in the JWT
// so RLS (public.current_firm_id()) can enforce tenant isolation.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Dev-only password for the seeded test accounts; override via env.
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'hub-dev-2026!';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Seed requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (packages/db/.env)');
}

// Deterministic ids keep the seed idempotent and let tests reference the firm.
const FIRM_ID = '11111111-1111-4111-8111-111111111111';
const FIRM_NAME = 'Contabilidade M Rocha';

type Role = 'owner' | 'manager' | 'staff';
interface SeedUser {
  email: string;
  fullName: string;
  role: Role;
  departments: string[];
}

const SEED_USERS: SeedUser[] = [
  { email: 'owner@mrocha.test', fullName: 'Dono M Rocha', role: 'owner', departments: [] },
  { email: 'manager@mrocha.test', fullName: 'Gerente M Rocha', role: 'manager', departments: [] },
  {
    email: 'staff@mrocha.test',
    fullName: 'Analista Fiscal',
    role: 'staff',
    departments: ['fiscal'],
  },
];

const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email: string): Promise<User | undefined> {
  // The seed set is tiny, so one page is enough.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === email);
}

async function ensureAuthUser(user: SeedUser): Promise<string> {
  const app_metadata = { firm_id: FIRM_ID, role: user.role };
  const user_metadata = { full_name: user.fullName };
  const existing = await findUserByEmail(user.email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      app_metadata,
      user_metadata,
    });
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password: SEED_PASSWORD,
    email_confirm: true,
    app_metadata,
    user_metadata,
  });
  if (error) throw error;
  return data.user.id;
}

async function main(): Promise<void> {
  const { error: firmError } = await admin.from('firms').upsert({ id: FIRM_ID, name: FIRM_NAME });
  if (firmError) throw firmError;

  for (const user of SEED_USERS) {
    const userId = await ensureAuthUser(user);

    const { error: profileError } = await admin.from('users').upsert({
      id: userId,
      firm_id: FIRM_ID,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
    });
    if (profileError) throw profileError;

    for (const department of user.departments) {
      const { error: departmentError } = await admin
        .from('user_departments')
        .upsert(
          { firm_id: FIRM_ID, user_id: userId, department },
          { onConflict: 'firm_id,user_id,department', ignoreDuplicates: true },
        );
      if (departmentError) throw departmentError;
    }

    console.log(`seeded ${user.role.padEnd(7)} ${user.email}`);
  }

  console.log(`Seed complete — ${FIRM_NAME} (${FIRM_ID}) + ${SEED_USERS.length} users.`);
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
