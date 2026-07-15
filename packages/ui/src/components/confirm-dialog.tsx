'use client';

import type { ReactNode } from 'react';
import { AlertDialog } from 'radix-ui';

import { cn } from '../lib/cn';

// Blocking confirmation for destructive/irreversible actions (T30) — replaces
// native window.confirm so every confirmation looks and behaves the same
// (focus trap, Escape, consistent buttons, mobile-friendly). All labels come
// from the feature's copy.ts (pt-BR); this component stays copy-free.
export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** 'danger' paints the confirm button destructive; 'default' uses primary. */
  tone?: 'danger' | 'default';
  /** Disables both buttons while the action runs (dialog stays open). */
  pending?: boolean;
  /** Runs on confirm. The dialog does NOT close itself — close it via
   *  onOpenChange when the action settles (lets async actions show `pending`). */
  onConfirm: () => void;
  /** Optional element that opens the dialog (rendered via Radix asChild). */
  trigger?: ReactNode;
  /** Optional content between the description and the buttons (e.g. a checkbox
   *  refining what the confirmation does — T39). */
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  pending = false,
  onConfirm,
  trigger,
  children,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      {trigger ? <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger> : null}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40" />
        <AlertDialog.Content
          className={cn(
            'bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 duration-150',
          )}
        >
          <AlertDialog.Title className="text-base font-semibold">{title}</AlertDialog.Title>
          {description ? (
            <AlertDialog.Description className="text-muted-foreground mt-1.5 text-sm">
              {description}
            </AlertDialog.Description>
          ) : null}
          {children ? <div className="mt-4">{children}</div> : null}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel
              disabled={pending}
              className="hover:bg-accent focus-visible:ring-ring rounded-lg border px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 disabled:opacity-60"
            >
              {cancelLabel}
            </AlertDialog.Cancel>
            <AlertDialog.Action
              disabled={pending}
              onClick={(event) => {
                // Radix closes on click by default; the caller owns closing so
                // async actions can keep the dialog open with `pending`.
                event.preventDefault();
                onConfirm();
              }}
              className={cn(
                'focus-visible:ring-ring rounded-lg px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 disabled:opacity-60',
                tone === 'danger'
                  ? 'bg-danger text-danger-foreground hover:bg-danger/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
