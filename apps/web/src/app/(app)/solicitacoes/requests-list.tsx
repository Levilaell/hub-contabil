'use client';

import { isOpenRequest, type RequestStatus } from '@hub/core';
import type { RequestEvent, RequestWithCompany } from '@hub/db';
import {
  ConfirmDialog,
  DataList,
  DataListRow,
  DetailDrawer,
  EmptyState,
  StatusBadge,
  toast,
  type StatusTone,
} from '@hub/ui';
import { Inbox } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  cancelRequestAction,
  copyLinkAction,
  loadRequestEventsAction,
  sendRequestEmailAction,
} from './actions';
import { copy } from './copy';

const TONE: Record<RequestStatus, StatusTone> = {
  requested: 'neutral',
  sent: 'warning',
  viewed: 'warning',
  received: 'success',
  downloaded: 'success',
  expired: 'muted',
  cancelled: 'muted',
};

function relativeDays(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'há 1 dia';
  return `há ${days} dias`;
}

function Drawer({
  request,
  events,
  onReload,
  onClose,
}: {
  request: RequestWithCompany;
  events: RequestEvent[];
  onReload: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, startTransition] = useTransition();
  const canAct = isOpenRequest(request.status);

  function handleSend() {
    setFeedback(null);
    startTransition(async () => {
      const result = await sendRequestEmailAction(
        request.id,
        request.companyId,
        email || undefined,
      );
      setFeedback(result.ok ? copy.detail.sent : result.message);
      if (result.ok) {
        onReload();
        router.refresh();
      }
    });
  }

  function handleCopy() {
    setFeedback(null);
    startTransition(async () => {
      const result = await copyLinkAction(request.id);
      if (!result.ok) {
        setFeedback(result.message);
        return;
      }
      const url = `${window.location.origin}/s/${result.token}`;
      try {
        await navigator.clipboard.writeText(url);
        setFeedback(copy.detail.copied);
      } catch {
        setFeedback(url);
      }
      onReload();
      router.refresh();
    });
  }

  function handleCancel() {
    startTransition(async () => {
      await cancelRequestAction(request.id);
      setConfirmCancel(false);
      toast.success(copy.detail.cancelled);
      router.refresh();
      onClose();
    });
  }

  return (
    <DetailDrawer
      open
      onOpenChange={(o) => !o && onClose()}
      title={request.title}
      closeLabel={copy.close}
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <StatusBadge tone={TONE[request.status]} label={copy.status[request.status]} />
          <span className="text-muted-foreground text-sm">{request.companyName}</span>
        </div>

        {request.description ? <p className="text-sm">{request.description}</p> : null}

        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide uppercase">{copy.detail.timeline}</h3>
          {events.length > 0 ? (
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{copy.events[e.eventType] ?? e.eventType}</span>
                  <span className="text-muted-foreground text-xs">
                    {relativeDays(e.occurredAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">{copy.detail.noEvents}</p>
          )}
        </section>

        {canAct ? (
          <section className="space-y-3 border-t pt-4">
            <div className="space-y-1.5">
              <label htmlFor="req-email" className="text-xs font-medium">
                {copy.detail.emailLabel}
              </label>
              <input
                id="req-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={copy.detail.emailHint}
                className="bg-background w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
              />
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={pending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {pending ? copy.detail.sending : copy.detail.send}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={pending}
              className="hover:bg-accent inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {copy.detail.copy}
            </button>
            <p className="text-muted-foreground text-center text-xs">{copy.detail.copyHint}</p>
            {feedback ? <p className="text-center text-sm font-medium">{feedback}</p> : null}
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              disabled={pending}
              className="text-danger-text hover:bg-accent inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm disabled:opacity-60"
            >
              {copy.detail.cancel}
            </button>
            <ConfirmDialog
              open={confirmCancel}
              onOpenChange={setConfirmCancel}
              title={copy.detail.cancelTitle}
              description={copy.detail.cancelConfirm}
              confirmLabel={copy.detail.cancel}
              cancelLabel={copy.dialogBack}
              tone="danger"
              pending={pending}
              onConfirm={handleCancel}
            />
          </section>
        ) : feedback ? (
          <p className="text-center text-sm font-medium">{feedback}</p>
        ) : null}
      </div>
    </DetailDrawer>
  );
}

export function RequestsList({ requests }: { requests: RequestWithCompany[] }) {
  const [view, setView] = useState<'open' | 'all'>('open');
  const [selected, setSelected] = useState<RequestWithCompany | null>(null);
  const [events, setEvents] = useState<RequestEvent[]>([]);
  const [, startTransition] = useTransition();

  function openRequest(r: RequestWithCompany) {
    setSelected(r);
    setEvents([]);
    startTransition(async () => setEvents(await loadRequestEventsAction(r.id)));
  }

  const filtered = view === 'open' ? requests.filter((r) => isOpenRequest(r.status)) : requests;

  return (
    <div className="space-y-4">
      <div className="bg-muted inline-flex rounded-lg p-0.5 text-sm">
        {(['open', 'all'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              view === v ? 'bg-background shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {copy.views[v]}
          </button>
        ))}
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
              onClick={() => openRequest(r)}
              leading={<StatusBadge tone={TONE[r.status]} label={copy.status[r.status]} />}
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

      {selected ? (
        <Drawer
          request={selected}
          events={events}
          onReload={() =>
            startTransition(async () => setEvents(await loadRequestEventsAction(selected.id)))
          }
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
