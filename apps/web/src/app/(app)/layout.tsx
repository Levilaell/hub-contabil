import { countOpenExceptions, countUnreadNotifications, listNotifications } from '@hub/db';
import type { ReactNode } from 'react';

import { createClient } from '@/lib/supabase/server';

import { AppNav } from './app-nav';

// Server layout: fetches the sidebar exception badge count + the topbar
// notifications (count + recent) (T9/T10), then hands off to the client nav
// (which needs usePathname for the active item).
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const [exceptionCount, notifications, unreadNotifications] = await Promise.all([
    countOpenExceptions(supabase),
    listNotifications(supabase, { limit: 15 }),
    countUnreadNotifications(supabase),
  ]);
  return (
    <AppNav
      exceptionCount={exceptionCount}
      notifications={notifications}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </AppNav>
  );
}
