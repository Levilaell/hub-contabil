'use client';

import { useTransition } from 'react';

import { toggleArchivedAction } from '../actions';
import { copy, secondaryButtonClass } from '../copy';

export function ArchiveButton({ companyId, archived }: { companyId: string; archived: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const message = archived ? copy.detail.restoreConfirm : copy.detail.archiveConfirm;
    if (!window.confirm(message)) return;
    startTransition(() => toggleArchivedAction(companyId, !archived));
  }

  return (
    <button type="button" onClick={handleClick} disabled={pending} className={secondaryButtonClass}>
      {pending ? copy.detail.working : archived ? copy.detail.restore : copy.detail.archive}
    </button>
  );
}
