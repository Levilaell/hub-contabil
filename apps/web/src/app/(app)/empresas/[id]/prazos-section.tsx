'use client';

import type { MonitoredDoc } from '@hub/db';
import { ConfirmDialog, StatusBadge, toast, type StatusTone } from '@hub/ui';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, useTransition, type FormEvent, type ReactNode } from 'react';

import {
  createPrazoAction,
  deletePrazoAction,
  updatePrazoAction,
  type PrazoActionState,
} from './prazos-actions';
import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from '../copy';

interface KeyLabel {
  key: string;
  label: string;
}
interface DocOption {
  id: string;
  fileName: string;
}

const TONE: Record<string, StatusTone> = {
  no_date: 'muted',
  valid: 'success',
  due_soon: 'warning',
  overdue: 'danger',
  needs_update: 'warning',
};

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function PrazoForm({
  action,
  kinds,
  defaultTriggerDays,
  companyDocs,
  prazo,
  onDone,
}: {
  action: (prev: PrazoActionState, formData: FormData) => Promise<PrazoActionState>;
  kinds: KeyLabel[];
  defaultTriggerDays: number;
  companyDocs: DocOption[];
  prazo?: MonitoredDoc;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await action(null, formData);
      if (result && !result.ok) setError(result.message);
      else onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-background space-y-3 rounded-lg border p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={copy.prazos.kind} htmlFor="docKind">
          <select
            id="docKind"
            name="docKind"
            defaultValue={prazo?.docKind ?? kinds[0]?.key}
            className={inputClass}
          >
            {kinds.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={copy.prazos.dueDate} htmlFor="dueDate">
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={prazo?.dueDate ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label={copy.prazos.triggerDays} htmlFor="triggerDays">
          <input
            id="triggerDays"
            name="triggerDays"
            type="number"
            min={0}
            max={365}
            defaultValue={prazo?.triggerDays ?? defaultTriggerDays}
            className={inputClass}
          />
        </Field>
        <Field label={copy.prazos.document} htmlFor="documentId">
          <select
            id="documentId"
            name="documentId"
            defaultValue={prazo?.documentId ?? ''}
            className={inputClass}
          >
            <option value="">{copy.prazos.documentNone}</option>
            {companyDocs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fileName}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error ? <p className="text-danger-text text-sm">{error}</p> : null}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? copy.prazos.saving : copy.prazos.save}
        </button>
        <button type="button" onClick={onDone} className={secondaryButtonClass}>
          {copy.prazos.cancel}
        </button>
      </div>
    </form>
  );
}

function PrazoRow({
  companyId,
  prazo,
  kindLabel,
  onEdit,
}: {
  companyId: string;
  prazo: MonitoredDoc;
  kindLabel: string;
  onEdit: () => void;
}) {
  const [removing, startRemove] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  function handleRemove() {
    startRemove(async () => {
      await deletePrazoAction(prazo.id, companyId);
      setConfirmOpen(false);
      toast.success(copy.prazos.removed);
    });
  }
  return (
    <li className="flex items-center gap-3 p-4">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{kindLabel}</span>
        <span className="text-muted-foreground mt-0.5 block truncate text-xs">
          {prazo.dueDate ?? copy.prazos.noDueDate}
        </span>
      </span>
      <StatusBadge
        tone={TONE[prazo.status] ?? 'muted'}
        label={copy.prazos.status[prazo.status] ?? prazo.status}
      />
      <button
        type="button"
        onClick={onEdit}
        aria-label={copy.prazos.edit}
        className="text-muted-foreground hover:text-foreground rounded-md p-1.5"
      >
        <Pencil className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={removing}
        aria-label={copy.prazos.remove}
        className="text-muted-foreground hover:text-danger-text rounded-md p-1.5 disabled:opacity-60"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={copy.prazos.removeTitle}
        description={copy.prazos.removeConfirm}
        confirmLabel={copy.prazos.remove}
        cancelLabel={copy.dialogBack}
        tone="danger"
        pending={removing}
        onConfirm={handleRemove}
      />
    </li>
  );
}

export function PrazosSection({
  companyId,
  prazos,
  kinds,
  defaultTriggerDays,
  companyDocs,
}: {
  companyId: string;
  prazos: MonitoredDoc[];
  kinds: KeyLabel[];
  defaultTriggerDays: number;
  companyDocs: DocOption[];
}) {
  const [open, setOpen] = useState<null | 'new' | string>(null);
  const close = () => setOpen(null);
  const kindLabel = (key: string) => kinds.find((k) => k.key === key)?.label ?? key;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {open !== 'new' ? (
          <button type="button" onClick={() => setOpen('new')} className={secondaryButtonClass}>
            <Plus className="size-4" aria-hidden />
            {copy.prazos.add}
          </button>
        ) : null}
      </div>

      {open === 'new' ? (
        <PrazoForm
          action={createPrazoAction.bind(null, companyId)}
          kinds={kinds}
          defaultTriggerDays={defaultTriggerDays}
          companyDocs={companyDocs}
          onDone={close}
        />
      ) : null}

      {prazos.length === 0 && open !== 'new' ? (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="text-sm font-medium">{copy.prazos.empty}</p>
          <p className="text-muted-foreground mt-1 text-sm">{copy.prazos.emptyHint}</p>
        </div>
      ) : (
        <ul className="divide-border bg-card divide-y overflow-hidden rounded-xl border">
          {prazos.map((prazo) =>
            open === prazo.id ? (
              <li key={prazo.id} className="p-4">
                <PrazoForm
                  action={updatePrazoAction.bind(null, prazo.id, companyId)}
                  kinds={kinds}
                  defaultTriggerDays={defaultTriggerDays}
                  companyDocs={companyDocs}
                  prazo={prazo}
                  onDone={close}
                />
              </li>
            ) : (
              <PrazoRow
                key={prazo.id}
                companyId={companyId}
                prazo={prazo}
                kindLabel={kindLabel(prazo.docKind)}
                onEdit={() => setOpen(prazo.id)}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}
