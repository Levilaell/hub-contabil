'use client';

import { ConfirmDialog, toast } from '@hub/ui';
import { useState, useTransition } from 'react';

import { toggleArchivedAction } from '../actions';
import { copy, secondaryButtonClass } from '../copy';

export function ArchiveButton({ companyId, archived }: { companyId: string; archived: boolean }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      await toggleArchivedAction(companyId, !archived);
      setConfirmOpen(false);
      toast.success(archived ? copy.detail.restored : copy.detail.archived);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={pending}
        className={secondaryButtonClass}
      >
        {pending ? copy.detail.working : archived ? copy.detail.restore : copy.detail.archive}
      </button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={archived ? copy.detail.restore : copy.detail.archive}
        description={archived ? copy.detail.restoreConfirm : copy.detail.archiveConfirm}
        confirmLabel={archived ? copy.detail.restore : copy.detail.archive}
        cancelLabel={copy.dialogBack}
        tone={archived ? 'default' : 'danger'}
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
