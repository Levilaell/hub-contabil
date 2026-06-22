'use client';

import { formatCnpj } from '@hub/core';
import type { MappingRuleRecord } from '@hub/db';
import { StatusBadge, type StatusTone } from '@hub/ui';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, useTransition, type FormEvent, type ReactNode } from 'react';

import {
  createRuleAction,
  deleteRuleAction,
  updateRuleAction,
  type RuleActionState,
  type RuleFormInput,
} from './actions';
import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from './copy';

interface RuleView {
  id: string;
  level: 1 | 2;
  originCfop: string;
  supplierCnpj: string | null;
  entryCfop: string;
}

function toView(rule: MappingRuleRecord): RuleView {
  return {
    id: rule.id,
    level: rule.level,
    originCfop: String(rule.key.originCfop ?? ''),
    supplierCnpj: rule.key.supplierCnpj ? String(rule.key.supplierCnpj) : null,
    entryCfop: String(rule.value.entryCfop ?? ''),
  };
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

function RuleForm({
  action,
  rule,
  onDone,
}: {
  action: (input: RuleFormInput) => Promise<RuleActionState>;
  rule?: RuleView;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input: RuleFormInput = {
      originCfop: String(form.get('originCfop') ?? ''),
      supplierCnpj: String(form.get('supplierCnpj') ?? ''),
      entryCfop: String(form.get('entryCfop') ?? ''),
    };
    setError(null);
    startTransition(async () => {
      const result = await action(input);
      if (result && !result.ok) setError(result.message);
      else onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-background space-y-3 rounded-lg border p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={copy.form.originCfop} hint={copy.form.originHint} htmlFor="originCfop">
          <input
            id="originCfop"
            name="originCfop"
            inputMode="numeric"
            defaultValue={rule?.originCfop ?? ''}
            placeholder="1102"
            className={inputClass}
          />
        </Field>
        <Field label={copy.form.entryCfop} hint={copy.form.entryHint} htmlFor="entryCfop">
          <input
            id="entryCfop"
            name="entryCfop"
            inputMode="numeric"
            defaultValue={rule?.entryCfop ?? ''}
            placeholder="1556"
            className={inputClass}
          />
        </Field>
        <Field label={copy.form.supplierCnpj} hint={copy.form.supplierHint} htmlFor="supplierCnpj">
          <input
            id="supplierCnpj"
            name="supplierCnpj"
            inputMode="numeric"
            defaultValue={rule?.supplierCnpj ?? ''}
            placeholder="00.000.000/0000-00"
            className={inputClass}
          />
        </Field>
      </div>

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

function RuleRow({ rule, onEdit }: { rule: RuleView; onEdit: () => void }) {
  const [removing, startRemove] = useTransition();
  const tone: StatusTone = rule.level === 1 ? 'neutral' : 'muted';
  const levelLabel = rule.level === 1 ? copy.levelSpecific : copy.levelGeneral;

  function handleRemove() {
    if (!window.confirm(copy.form.removeConfirm)) return;
    startRemove(() => {
      void deleteRuleAction(rule.id);
    });
  }

  return (
    <li className="flex items-center gap-3 p-4">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          CFOP {rule.originCfop} → {rule.entryCfop}
        </span>
        <span className="text-muted-foreground mt-0.5 block truncate text-xs">
          {rule.supplierCnpj ? copy.supplierFact(formatCnpj(rule.supplierCnpj)) : copy.anySupplier}
        </span>
      </span>
      <StatusBadge tone={tone} label={levelLabel} />
      <button
        type="button"
        onClick={onEdit}
        aria-label={copy.form.edit}
        className="text-muted-foreground hover:text-foreground rounded-md p-1.5"
      >
        <Pencil className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={handleRemove}
        disabled={removing}
        aria-label={copy.form.remove}
        className="text-muted-foreground hover:text-danger-text rounded-md p-1.5 disabled:opacity-60"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  );
}

export function RulesList({ rules }: { rules: MappingRuleRecord[] }) {
  const views = rules.map(toView);
  const [open, setOpen] = useState<null | 'new' | string>(null);
  const close = () => setOpen(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {open !== 'new' ? (
          <button type="button" onClick={() => setOpen('new')} className={secondaryButtonClass}>
            <Plus className="size-4" aria-hidden />
            {copy.newRule}
          </button>
        ) : null}
      </div>

      {open === 'new' ? <RuleForm action={createRuleAction} onDone={close} /> : null}

      {views.length === 0 && open !== 'new' ? (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="text-sm font-medium">{copy.empty.title}</p>
          <p className="text-muted-foreground mt-1 text-sm">{copy.empty.description}</p>
        </div>
      ) : views.length > 0 ? (
        <ul className="divide-border bg-card divide-y overflow-hidden rounded-xl border">
          {views.map((rule) =>
            open === rule.id ? (
              <li key={rule.id} className="p-4">
                <RuleForm
                  action={(input) => updateRuleAction(rule.id, input)}
                  rule={rule}
                  onDone={close}
                />
              </li>
            ) : (
              <RuleRow key={rule.id} rule={rule} onEdit={() => setOpen(rule.id)} />
            ),
          )}
        </ul>
      ) : null}
    </div>
  );
}
