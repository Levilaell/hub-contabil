'use client';

import { DetailDrawer } from '@hub/ui';
import { Plus } from 'lucide-react';
import { useState, useTransition, type FormEvent, type ReactNode } from 'react';

import { createTaskAction } from './actions';
import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from './copy';

interface Option {
  id: string;
  name: string;
}
interface Department {
  key: string;
  label: string;
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

export function CreateTaskButton({
  companyOptions,
  departments,
  userOptions,
}: {
  companyOptions: Option[];
  departments: Department[];
  userOptions: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createTaskAction(null, formData);
      if (result && !result.ok) setError(result.message);
      else setOpen(false);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
        <Plus className="size-4" aria-hidden />
        {copy.newTask}
      </button>

      <DetailDrawer
        open={open}
        onOpenChange={setOpen}
        title={copy.form.title}
        closeLabel={copy.form.cancel}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={copy.form.company} htmlFor="companyId">
            <select id="companyId" name="companyId" required className={inputClass}>
              {companyOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={copy.form.department} htmlFor="department">
            <select id="department" name="department" required className={inputClass}>
              {departments.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={copy.form.taskTitle} htmlFor="title">
            <input id="title" name="title" required className={inputClass} />
          </Field>
          <Field label={copy.form.period} htmlFor="period">
            <input id="period" name="period" placeholder="2026-06" className={inputClass} />
          </Field>
          <Field label={copy.form.assignee} htmlFor="assigneeId">
            <select id="assigneeId" name="assigneeId" className={inputClass}>
              <option value="">{copy.form.assigneeNone}</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={copy.form.handoffTo} htmlFor="handoffTo">
            <select id="handoffTo" name="handoffTo" className={inputClass}>
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
              {pending ? copy.form.submitting : copy.form.submit}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>
              {copy.form.cancel}
            </button>
          </div>
        </form>
      </DetailDrawer>
    </>
  );
}
