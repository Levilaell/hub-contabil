import { countOpenExceptions } from '@hub/db';
import type { ReactNode } from 'react';

import { createClient } from '@/lib/supabase/server';

import { AppNav } from './app-nav';

// Server layout: fetches the open-exception count for the sidebar badge (T9), then
// hands off to the client nav (which needs usePathname for the active item).
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const exceptionCount = await countOpenExceptions(supabase);
  return <AppNav exceptionCount={exceptionCount}>{children}</AppNav>;
}
