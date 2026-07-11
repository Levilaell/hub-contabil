'use client';

import { isOpenRequest, type RequestKind, type RequestStatus } from '@hub/core';
import type { RequestEvent } from '@hub/db';
import { ConfirmDialog, DetailDrawer, StatusBadge, toast, type StatusTone } from '@hub/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import {
  cancelRequestAction,
  copyLinkAction,
  loadRequestEventsAction,
  loadSendContextAction,
  sendRequestEmailAction,
  type SendContext,
} from './actions';
import { copy } from './copy';

// Shared request detail drawer (T31): status + timeline + send (with a contact
// picker instead of a blind e-mail field) + copy-link + cancel. Used by the
// global /solicitacoes list AND the company page tabs, so both places offer the
// exact same follow-up actions.

export const REQUEST_TONE: Record<RequestStatus, StatusTone> = {
  requested: 'neutral',
  sent: 'warning',
  viewed: 'warning',
  received: 'success',
  downloaded: 'success',
  expired: 'muted',
  cancelled: 'muted',
};

export interface DrawerRequest {
  id: string;
  companyId: string;
  kind: RequestKind;
  title: string;
  description: string;
  status: RequestStatus;
  /** Shown as the drawer subtitle when present (global list). */
  companyName?: string;
}

const OTHER = '__other__';

export function RequestDrawer({
  request,
  onClose,
}: {
  request: DrawerRequest;
  onClose: () => void;
}) {
  const router = useRouter();
  const [events, setEvents] = useState<RequestEvent[] | null>(null);
  const [sendContext, setSendContext] = useState<SendContext | null>(null);
  const [recipient, setRecipient] = useState<string>(OTHER);
  const [customEmail, setCustomEmail] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, startTransition] = useTransition();
  const canAct = isOpenRequest(request.status);

  useEffect(() => {
    let alive = true;
    void loadRequestEventsAction(request.id).then((e) => alive && setEvents(e));
    void loadSendContextAction(request.id, request.companyId).then((ctx) => {
      if (!alive) return;
      setSendContext(ctx);
      // Pre-select the department-routed suggestion, else the first contact.
      const initial = ctx.suggestedEmail ?? ctx.contacts[0]?.email ?? OTHER;
      setRecipient(initial);
    });
    return () => {
      alive = false;
    };
  }, [request.id, request.companyId]);

  function reloadEvents() {
    void loadRequestEventsAction(request.id).then(setEvents);
  }

  function handleSend() {
    const to = recipient === OTHER ? customEmail.trim() : recipient;
    setFeedback(null);
    startTransition(async () => {
      const result = await sendRequestEmailAction(request.id, request.companyId, to || undefined);
      if (result.ok) {
        toast.success(copy.detail.sent);
        reloadEvents();
        router.refresh();
      } else {
        setFeedback(result.message);
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
        toast.success(copy.detail.copied);
      } catch {
        setFeedback(url);
      }
      reloadEvents();
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
          <StatusBadge tone={REQUEST_TONE[request.status]} label={copy.status[request.status]} />
          <span className="text-muted-foreground text-sm">
            {request.kind === 'upload_request' ? copy.kindUpload : copy.kindOffer}
            {request.companyName ? ` · ${request.companyName}` : ''}
          </span>
        </div>

        {request.description ? <p className="text-sm">{request.description}</p> : null}

        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide uppercase">{copy.detail.timeline}</h3>
          {events === null ? (
            <p className="text-muted-foreground text-sm">{copy.detail.loadingEvents}</p>
          ) : events.length > 0 ? (
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{copy.events[e.eventType] ?? e.eventType}</span>
                  <span className="text-muted-foreground text-xs">{relativeDays(e.occurredAt)}</span>
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
              <label htmlFor="req-recipient" className="text-xs font-medium">
                {copy.detail.sendTo}
              </label>
              <select
                id="req-recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="bg-background w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
              >
                {(sendContext?.contacts ?? []).map((c) => (
                  <option key={c.email} value={c.email}>
                    {c.name} — {c.email}
                    {c.email === sendContext?.suggestedEmail ? copy.detail.suggestedSuffix : ''}
                  </option>
                ))}
                <option value={OTHER}>{copy.detail.otherEmail}</option>
              </select>
              {sendContext !== null && sendContext.contacts.length === 0 ? (
                <p className="text-muted-foreground text-xs">{copy.detail.noContacts}</p>
              ) : null}
            </div>
            {recipient === OTHER ? (
              <input
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder={copy.detail.emailLabel}
                aria-label={copy.detail.emailLabel}
                className="bg-background w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
              />
            ) : null}
            <button
              type="button"
              onClick={handleSend}
              disabled={pending || (recipient === OTHER && customEmail.trim().length === 0)}
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

export function relativeDays(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'há 1 dia';
  return `há ${days} dias`;
}
