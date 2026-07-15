'use client';

import type { RecurringTask, RecurringTargetKind } from '@hub/db';
import { ConfirmDialog, DetailDrawer, EmptyState, StatusBadge, toast } from '@hub/ui';
import { Plus, Repeat } from 'lucide-react';
import { useState, useTransition, type FormEvent, type ReactNode } from 'react';

import {
  createRecurringAction,
  deactivateRecurringAction,
  toggleRecurringActiveAction,
  updateRecurringAction,
} from './actions';
import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from './copy';

interface Option {
  id: string;
  name: string;
}
interface KeyLabel {
  key: string;
  label: string;
}

interface ListProps {
  templates: RecurringTask[];
  departments: KeyLabel[];
  regimes: KeyLabel[];
  companyOptions: Option[];
  userOptions: Option[];
  canManage: boolean;
}

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
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function RecurringForm({
  template,
  departments,
  regimes,
  companyOptions,
  userOptions,
  onDone,
}: {
  template: RecurringTask | null;
  departments: KeyLabel[];
  regimes: KeyLabel[];
  companyOptions: Option[];
  userOptions: Option[];
  onDone: () => void;
}) {
  const action = template ? updateRecurringAction.bind(null, template.id) : createRecurringAction;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [targetKind, setTargetKind] = useState<RecurringTargetKind>(template?.targetKind ?? 'all');
  const defaultCompanyIds = asStringArray(template?.targetValue.companyIds);
  const defaultRegimes = asStringArray(template?.targetValue.regimes);

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label={copy.form.title} htmlFor="title">
        <input
          id="title"
          name="title"
          required
          defaultValue={template?.title}
          className={inputClass}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={copy.form.department} htmlFor="department">
          <select
            id="department"
            name="department"
            defaultValue={template?.department ?? departments[0]?.key}
            className={inputClass}
          >
            {departments.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={copy.form.generationDay} htmlFor="generationDay">
          <input
            id="generationDay"
            name="generationDay"
            type="number"
            min={1}
            max={28}
            required
            defaultValue={template?.generationDay ?? 1}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label={copy.form.target} htmlFor="targetKind">
        <select
          id="targetKind"
          name="targetKind"
          value={targetKind}
          onChange={(e) => setTargetKind(e.target.value as RecurringTargetKind)}
          className={inputClass}
        >
          <option value="all">{copy.targets.all}</option>
          <option value="selection">{copy.targets.selection}</option>
          <option value="by_regime">{copy.targets.by_regime}</option>
        </select>
      </Field>

      {targetKind === 'selection' ? (
        <Field label={copy.form.companies} htmlFor="companyIds">
          <select
            id="companyIds"
            name="companyIds"
            multiple
            defaultValue={defaultCompanyIds}
            className={`${inputClass} h-40`}
          >
            {companyOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">{copy.form.multiHint}</p>
        </Field>
      ) : null}

      {targetKind === 'by_regime' ? (
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">{copy.form.regimes}</legend>
          <div className="flex flex-wrap gap-3">
            {regimes.map((r) => (
              <label key={r.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="regimes"
                  value={r.key}
                  defaultChecked={defaultRegimes.includes(r.key)}
                  className="size-4 rounded border"
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {/* Optional owner for every generated task (T28) — stops recurring tasks
          from being born without a responsible person. */}
      <Field label={copy.form.defaultAssignee} htmlFor="defaultAssigneeId">
        <select
          id="defaultAssigneeId"
          name="defaultAssigneeId"
          defaultValue={template?.defaultAssigneeId ?? ''}
          className={inputClass}
        >
          <option value="">{copy.form.defaultAssigneeNone}</option>
          {userOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label={copy.form.handoffTo} htmlFor="handoffTo">
        <select
          id="handoffTo"
          name="handoffTo"
          defaultValue={template?.handoffTo ?? ''}
          className={inputClass}
        >
          <option value="">{copy.form.handoffNone}</option>
          {departments.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
      </Field>

      {error ? <p className="text-danger-text text-sm">{error}</p> : null}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? copy.form.saving : copy.form.save}
        </button>
        <button type="button" onClick={onDone} className={secondaryButtonClass}>
          {copy.form.cancel}
        </button>
      </div>
    </form>
  );
}

export function RecurringList({
  templates,
  departments,
  regimes,
  companyOptions,
  userOptions,
  canManage,
}: ListProps) {
  const [openForm, setOpenForm] = useState<null | 'new' | RecurringTask>(null);
  const [pending, startTransition] = useTransition();
  const departmentLabel = (key: string) => departments.find((d) => d.key === key)?.label ?? key;

  // T39 (decision #2): deactivating confirms first and offers cancelling the
  // template's still-open instances (default on — matches the user expectation
  // that "the tasks go away").
  const [deactivating, setDeactivating] = useState<RecurringTask | null>(null);
  const [cancelOpen, setCancelOpen] = useState(true);

  function toggle(template: RecurringTask) {
    if (template.active) {
      setCancelOpen(true);
      setDeactivating(template);
      return;
    }
    startTransition(() => toggleRecurringActiveAction(template.id, true));
  }

  function confirmDeactivate() {
    if (!deactivating) return;
    startTransition(async () => {
      const res = await deactivateRecurringAction(deactivating.id, cancelOpen);
      setDeactivating(null);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(
        cancelOpen
          ? copy.deactivateDialog.doneCancelled(res.cancelled)
          : copy.deactivateDialog.doneKept,
      );
    });
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex justify-end">
          <button type="button" onClick={() => setOpenForm('new')} className={primaryButtonClass}>
            <Plus className="size-4" aria-hidden />
            {copy.newTemplate}
          </button>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{copy.readOnly}</p>
      )}

      {templates.length === 0 ? (
        <EmptyState icon={Repeat} title={copy.empty.title} description={copy.empty.description} />
      ) : (
        <ul className="divide-border bg-card divide-y overflow-hidden rounded-xl border">
          {templates.map((template) => (
            <li key={template.id} className="flex items-center gap-3 p-4">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{template.title}</span>
                <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                  {departmentLabel(template.department)} · {copy.targets[template.targetKind]} ·{' '}
                  {copy.generationDayShort} {template.generationDay}
                </span>
              </span>
              <StatusBadge
                tone={template.active ? 'success' : 'muted'}
                label={template.active ? copy.active : copy.inactive}
              />
              {canManage ? (
                <>
                  <button
                    type="button"
                    onClick={() => setOpenForm(template)}
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    {copy.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(template)}
                    disabled={pending}
                    className="text-muted-foreground hover:text-foreground text-xs disabled:opacity-60"
                  >
                    {template.active ? copy.deactivate : copy.activate}
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title={copy.deactivateDialog.title}
        description={copy.deactivateDialog.description}
        confirmLabel={copy.deactivateDialog.confirm}
        cancelLabel={copy.deactivateDialog.cancel}
        tone="danger"
        pending={pending}
        onConfirm={confirmDeactivate}
      >
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={cancelOpen}
            onChange={(e) => setCancelOpen(e.target.checked)}
            className="mt-0.5 size-4 rounded border"
          />
          {copy.deactivateDialog.cancelOpenLabel}
        </label>
      </ConfirmDialog>

      <DetailDrawer
        open={openForm !== null}
        onOpenChange={(o) => !o && setOpenForm(null)}
        title={openForm && openForm !== 'new' ? copy.form.editTitle : copy.form.newTitle}
        closeLabel={copy.form.cancel}
      >
        {openForm !== null ? (
          <RecurringForm
            template={openForm === 'new' ? null : openForm}
            departments={departments}
            regimes={regimes}
            companyOptions={companyOptions}
            userOptions={userOptions}
            onDone={() => setOpenForm(null)}
          />
        ) : null}
      </DetailDrawer>
    </div>
  );
}
