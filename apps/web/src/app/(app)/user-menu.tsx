'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

import { copy } from './copy';

// Topbar identity + sign-out. Fetches the current user client-side (the route is
// already gated by middleware, so this is only for display).
export function UserMenu() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      {email ? (
        <span className="text-muted-foreground hidden text-sm sm:inline">{email}</span>
      ) : null}
      <button
        type="button"
        onClick={signOut}
        aria-label={copy.signOut}
        title={copy.signOut}
        className="hover:bg-accent grid size-9 place-items-center rounded-md transition-colors"
      >
        <LogOut className="size-4" aria-hidden />
      </button>
    </div>
  );
}
