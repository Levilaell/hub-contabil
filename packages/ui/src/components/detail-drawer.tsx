'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Dialog } from 'radix-ui';

import { cn } from '../lib/cn';

// Detail lives one click away in a right-side drawer (CLAUDE.md UX rule #2),
// built on Radix Dialog for focus trap + escape handling. Interactive → client.
export interface DetailDrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional element that opens the drawer (rendered via Radix asChild). */
  trigger?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Footer actions, pinned to the bottom. */
  footer?: ReactNode;
  /** Accessible label for the close button (pass pt-BR). */
  closeLabel?: string;
  className?: string;
}

export function DetailDrawer({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  closeLabel = 'Close',
  className,
}: DetailDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={cn(
            'bg-background fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-200',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b p-4">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-base font-semibold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-muted-foreground mt-0.5 text-sm">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label={closeLabel}
              className="hover:bg-accent focus-visible:ring-ring -m-1 grid size-8 shrink-0 place-items-center rounded-md transition-colors outline-none focus-visible:ring-2"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
          {footer ? <div className="border-t p-4">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
