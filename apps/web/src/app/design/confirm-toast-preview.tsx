'use client';

import { ConfirmDialog, Toaster, toast } from '@hub/ui';
import { useState } from 'react';

import { copy } from './copy';

// Interactive demo for ConfirmDialog + toasts (T30). The design page is a server
// component, so the stateful bits live here; it mounts its own Toaster because
// /design sits outside the (app) layout.
export function ConfirmToastPreview() {
  const [open, setOpen] = useState(false);
  const secondaryBtn =
    'inline-flex items-center gap-2 rounded-lg border bg-background px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent';

  return (
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={() => setOpen(true)} className={secondaryBtn}>
        {copy.confirmToast.open}
      </button>
      <button
        type="button"
        onClick={() => toast.success(copy.confirmToast.successMessage)}
        className={secondaryBtn}
      >
        {copy.confirmToast.showSuccess}
      </button>
      <button
        type="button"
        onClick={() => toast.error(copy.confirmToast.errorMessage)}
        className={secondaryBtn}
      >
        {copy.confirmToast.showError}
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={copy.confirmToast.title}
        description={copy.confirmToast.description}
        confirmLabel={copy.confirmToast.confirm}
        cancelLabel={copy.confirmToast.back}
        tone="danger"
        onConfirm={() => {
          setOpen(false);
          toast.success(copy.confirmToast.confirmed);
        }}
      />
      <Toaster />
    </div>
  );
}
