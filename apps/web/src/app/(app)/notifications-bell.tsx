'use client';

import type { NotificationItem } from '@hub/db';
import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Popover } from 'radix-ui';

import { copy } from './copy';
import { markNotificationReadAction } from './notification-actions';

// Where a notification links to, by entity kind.
const ENTITY_LINK: Record<string, string> = { task: '/tarefas' };

export function NotificationsBell({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState(notifications);
  const [count, setCount] = useState(unreadCount);
  const [, startTransition] = useTransition();

  function openItem(item: NotificationItem) {
    if (!item.readAt) {
      // Optimistic: mark read locally now, persist + revalidate in the background.
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: 'now' } : n)));
      setCount((c) => Math.max(0, c - 1));
      startTransition(() => markNotificationReadAction(item.id));
    }
    const link = item.entity ? ENTITY_LINK[item.entity] : null;
    if (link) router.push(link);
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={copy.notifications.label}
        className="hover:bg-accent relative grid size-9 place-items-center rounded-md"
      >
        <Bell className="size-5" aria-hidden />
        {count > 0 ? (
          <span className="bg-danger text-danger-foreground absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="bg-card z-50 w-80 overflow-hidden rounded-xl border shadow-lg"
        >
          <div className="border-b px-4 py-2.5 text-sm font-semibold">
            {copy.notifications.title}
          </div>
          {items.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">
              {copy.notifications.empty}
            </p>
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className="hover:bg-accent flex w-full items-start gap-2 p-3 text-left"
                  >
                    <span
                      className={
                        item.readAt
                          ? 'mt-1.5 size-2 shrink-0 rounded-full bg-transparent'
                          : 'bg-danger mt-1.5 size-2 shrink-0 rounded-full'
                      }
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      {item.body ? (
                        <span className="text-muted-foreground block truncate text-xs">
                          {item.body}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
