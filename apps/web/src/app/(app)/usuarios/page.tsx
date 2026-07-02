import { parseFirmConfig } from '@hub/config';
import { listFirmUsers } from '@hub/db';
import { EmptyState, PageHeader } from '@hub/ui';
import { Users } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';

import { copy } from './copy';
import { UsersManager } from './users-manager';

// One question per screen: "who accesses this firm, and what do they see?" Managers
// only — staff get a read-restricted notice. Data is fetched RLS-scoped; the privileged
// writes go through the Admin-API server actions.
export default async function UsuariosPage() {
  const supabase = await createClient();
  const [{ data: firm }, { data: userData }, users] = await Promise.all([
    supabase.from('firms').select('config').limit(1).single(),
    supabase.auth.getUser(),
    listFirmUsers(supabase),
  ]);

  const role = userData.user?.app_metadata?.role as string | undefined;
  const canManage = role === 'owner' || role === 'manager';

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={copy.title} description={copy.subtitle} />
      {!canManage ? (
        <EmptyState icon={Users} title={copy.restricted} />
      ) : (
        <UsersManager
          users={users}
          departments={parseFirmConfig(firm?.config).departments}
          currentUserId={userData.user?.id ?? ''}
          currentUserRole={role === 'owner' ? 'owner' : 'manager'}
        />
      )}
    </div>
  );
}
