import {
  countOpenExceptions,
  countOpenRequests,
  countUnreadNotifications,
  listNotifications,
} from '@hub/db';
import type { ReactNode } from 'react';

import { createClient } from '@/lib/supabase/server';

import { AppNav } from './app-nav';

// Server layout: fetches the sidebar badge counts (open exceptions + open
// requests) + the topbar notifications (count + recent) (T9/T10/T17), then hands
// off to the client nav (which needs usePathname for the active item).
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const [exceptionCount, requestCount, notifications, unreadNotifications] = await Promise.all([
    countOpenExceptions(supabase),
    countOpenRequests(supabase),
    listNotifications(supabase, { limit: 15 }),
    countUnreadNotifications(supabase),
  ]);
  return (
    <AppNav
      exceptionCount={exceptionCount}
      requestCount={requestCount}
      notifications={notifications}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </AppNav>
  );
}
