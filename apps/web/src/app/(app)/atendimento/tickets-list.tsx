'use client';

import type { SupportMessage, SupportTicket } from '@hub/db';
import { DataList, DataListRow, DetailDrawer, StatusBadge, type StatusTone } from '@hub/ui';
import { MessageCircle } from 'lucide-react';
import { useState, useTransition } from 'react';

import {
  loadSupportMessagesAction,
  replySupportAction,
  setSupportStatusAction,
} from './actions';
import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from './copy';

const STATUS: Record<string, { tone: StatusTone; label: string }> = {
  open: { tone: 'warning', label: copy.badge.open },
  pending: { tone: 'neutral', label: copy.badge.pending },
  escalated: { tone: 'danger', label: copy.badge.escalated },
  resolved: { tone: 'success', label: copy.badge.resolved },
};

function channelLabel(channel: string): string {
  return copy.channels[channel] ?? channel;
}

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

export function TicketsList({
  tickets,
  departmentLabels,
}: {
  tickets: SupportTicket[];
  departmentLabels: Record<string, string>;
}) {
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[] | null>(null);
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open(ticket: SupportTicket) {
    setSelected(ticket);
    setMessages(null);
    setReply('');
    setError(null);
    void loadSupportMessagesAction(ticket.id).then(setMessages);
  }

  function close() {
    setSelected(null);
  }

  function refresh(id: string) {
    void loadSupportMessagesAction(id).then(setMessages);
  }

  function sendReply() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const res = await replySupportAction(selected.id, reply);
      if (res && !res.ok) setError(res.message);
      else {
        setReply('');
        refresh(selected.id);
      }
    });
  }

  function changeStatus(status: 'escalated' | 'resolved' | 'open') {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const res = await setSupportStatusAction(selected.id, status);
      if (res && !res.ok) setError(res.message);
      else close();
    });
  }

  const isResolved = selected?.status === 'resolved';

  return (
    <>
      <DataList>
        {tickets.map((ticket) => (
          <DataListRow
            key={ticket.id}
            onClick={() => open(ticket)}
            leading={
              <span className="bg-muted text-muted-foreground grid size-9 place-items-center rounded-full">
                <MessageCircle className="size-4" aria-hidden />
              </span>
            }
            title={ticket.contactName || ticket.contactIdentifier}
            facts={[
              channelLabel(ticket.channel),
              ticket.department ? (departmentLabels[ticket.department] ?? ticket.department) : null,
              ticket.subject || '—',
              timeAgo(ticket.lastMessageAt),
            ].filter(Boolean) as string[]}
            trailing={
              <StatusBadge
                tone={STATUS[ticket.status]?.tone ?? 'neutral'}
                label={STATUS[ticket.status]?.label ?? ticket.status}
              />
            }
          />
        ))}
      </DataList>

      <DetailDrawer
        open={selected !== null}
        onOpenChange={(o) => !o && close()}
        title={selected ? selected.contactName || selected.contactIdentifier : copy.title}
        description={selected ? channelLabel(selected.channel) : copy.title}
        closeLabel={copy.drawer.close}
        footer={
          selected ? (
            <div className="space-y-3">
              {error ? <p className="text-danger-text text-sm">{error}</p> : null}
              {!isResolved ? (
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={copy.drawer.replyPlaceholder}
                  rows={2}
                  className={inputClass}
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                {!isResolved ? (
                  <button
                    type="button"
                    onClick={sendReply}
                    disabled={pending || reply.trim().length === 0}
                    className={primaryButtonClass}
                  >
                    {pending ? copy.drawer.sending : copy.drawer.reply}
                  </button>
                ) : null}
                {selected.status !== 'escalated' && !isResolved ? (
                  <button
                    type="button"
                    onClick={() => changeStatus('escalated')}
                    disabled={pending}
                    className={secondaryButtonClass}
                  >
                    {copy.drawer.escalate}
                  </button>
                ) : null}
                {!isResolved ? (
                  <button
                    type="button"
                    onClick={() => changeStatus('resolved')}
                    disabled={pending}
                    className={secondaryButtonClass}
                  >
                    {copy.drawer.resolve}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => changeStatus('open')}
                    disabled={pending}
                    className={secondaryButtonClass}
                  >
                    {copy.drawer.reopen}
                  </button>
                )}
              </div>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">{copy.drawer.company}</dt>
                <dd className="mt-0.5">
                  {selected.companyId ? copy.drawer.companyLinked : copy.drawer.noCompany}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">{copy.drawer.contact}</dt>
                <dd className="mt-0.5">{selected.contactIdentifier}</dd>
              </div>
            </dl>

            <div>
              <p className="text-muted-foreground mb-2 text-xs">{copy.drawer.conversation}</p>
              {messages === null ? (
                <p className="text-muted-foreground text-sm">{copy.drawer.loading}</p>
              ) : messages.length === 0 ? (
                <p className="text-muted-foreground text-sm">{copy.drawer.empty}</p>
              ) : (
                <ul className="space-y-2">
                  {messages.map((m) => (
                    <li
                      key={m.id}
                      className={
                        m.direction === 'inbound'
                          ? 'bg-muted mr-8 rounded-lg px-3 py-2 text-sm'
                          : 'bg-primary/10 ml-8 rounded-lg px-3 py-2 text-sm'
                      }
                    >
                      <div className="text-muted-foreground mb-0.5 flex items-center justify-between text-[11px]">
                        <span>{copy.author[m.author] ?? m.author}</span>
                        <span>{copy.delivery[m.delivery] || timeAgo(m.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </DetailDrawer>
    </>
  );
}
