'use client';

import { isOpenRequest } from '@hub/core';
import type { RequestWithCompany } from '@hub/db';
import { DataList, DataListRow, EmptyState, StatusBadge } from '@hub/ui';
import { Inbox } from 'lucide-react';
import { useState } from 'react';

import { copy } from './copy';
import { REQUEST_TONE, RequestDrawer, relativeDays } from './request-drawer';

// Global follow-up list (T17/T31): default view = still-open items; a second
// toggle separates the two flows (pedir documento × disponibilizar documento)
// so each can be tracked on its own (decision #4: full separation for control).

type KindView = 'all' | 'upload_request' | 'document_offer';

export function RequestsList({ requests }: { requests: RequestWithCompany[] }) {
  const [view, setView] = useState<'open' | 'all'>('open');
  const [kindView, setKindView] = useState<KindView>('all');
  const [selected, setSelected] = useState<RequestWithCompany | null>(null);

  const filtered = requests.filter(
    (r) =>
      (view === 'open' ? isOpenRequest(r.status) : true) &&
      (kindView === 'all' ? true : r.kind === kindView),
  );

  const toggle = (
    active: boolean,
    label: string,
    onClick: () => void,
  ) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
        active ? 'bg-background shadow-sm' : 'text-muted-foreground'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="bg-muted inline-flex rounded-lg p-0.5 text-sm">
          {(['open', 'all'] as const).map((v) =>
            toggle(view === v, copy.views[v], () => setView(v)),
          )}
        </div>
        <div className="bg-muted inline-flex rounded-lg p-0.5 text-sm">
          {(
            [
              ['all', copy.kindViews.all],
              ['upload_request', copy.kindViews.upload],
              ['document_offer', copy.kindViews.offer],
            ] as const
          ).map(([k, label]) => toggle(kindView === k, label, () => setKindView(k)))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={view === 'open' ? copy.empty.openTitle : copy.empty.allTitle}
          description={view === 'open' ? copy.empty.openHint : copy.empty.allHint}
        />
      ) : (
        <DataList>
          {filtered.map((r) => (
            <DataListRow
              key={r.id}
              onClick={() => setSelected(r)}
              leading={<StatusBadge tone={REQUEST_TONE[r.status]} label={copy.status[r.status]} />}
              title={r.title}
              facts={[
                r.companyName,
                r.kind === 'upload_request' ? copy.kindUpload : copy.kindOffer,
                r.sentAt
                  ? `enviado ${relativeDays(r.sentAt)}`
                  : `criado ${relativeDays(r.createdAt)}`,
              ]}
            />
          ))}
        </DataList>
      )}

      {selected ? <RequestDrawer request={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
