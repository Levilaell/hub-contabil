import { listSupportTickets, type SupportStatus } from '@hub/db';
import { EmptyState, PageHeader } from '@hub/ui';
import { CheckCircle2, MessageCircle } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';

import { copy, inputClass, secondaryButtonClass } from './copy';
import { TicketsList } from './tickets-list';

type StatusFilter = SupportStatus | 'open_all' | 'all';

function resolveStatus(raw: string | undefined): StatusFilter {
  return raw === 'open' ||
    raw === 'pending' ||
    raw === 'escalated' ||
    raw === 'resolved' ||
    raw === 'all'
    ? raw
    : 'open_all';
}

// One question per screen: "who is waiting on me?" Default view = open + escalated.
export default async function AtendimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = resolveStatus(sp.status);
  const filtered = status !== 'open_all';

  const supabase = await createClient();
  const tickets = await listSupportTickets(supabase, { status });

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.subtitle} />

      <details open={filtered} className="bg-card rounded-xl border px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">{copy.filters}</summary>
        <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="status" className="text-xs font-medium">
              {copy.statusLabel}
            </label>
            <select id="status" name="status" defaultValue={status} className={inputClass}>
              <option value="open_all">{copy.statusOpenAll}</option>
              <option value="open">{copy.statusOpen}</option>
              <option value="escalated">{copy.statusEscalated}</option>
              <option value="pending">{copy.statusPending}</option>
              <option value="resolved">{copy.statusResolved}</option>
              <option value="all">{copy.statusAll}</option>
            </select>
          </div>
          <button type="submit" className={secondaryButtonClass}>
            {copy.apply}
          </button>
        </form>
      </details>

      {tickets.length === 0 ? (
        <EmptyState
          icon={filtered ? MessageCircle : CheckCircle2}
          title={filtered ? copy.empty.filteredTitle : copy.empty.title}
          description={filtered ? copy.empty.filteredDescription : copy.empty.description}
        />
      ) : (
        <TicketsList tickets={tickets} />
      )}
    </div>
  );
}
