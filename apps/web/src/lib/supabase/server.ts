import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server Supabase client (anon key + RLS) for Server Components, Route Handlers
// and Server Actions. Cookie writes from a Server Component are a no-op — the
// middleware refreshes the session.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — safe to ignore; middleware refreshes.
          }
        },
      },
    },
  );
}
