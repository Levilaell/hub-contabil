'use client';

import type { CompanyPartner } from '@hub/db';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useActionState, useEffect, useState, useTransition } from 'react';

import {
  createPartnerAction,
  deletePartnerAction,
  updatePartnerAction,
  type ActionState,
} from '../actions';
import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from '../copy';

// Sócios registry (Fase 1.1 §1.1) — same interaction pattern as ContactsSection:
// inline list with add/edit forms, nothing required beyond the name.

function PartnerForm({
  action,
  defaults,
  onDone,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaults?: CompanyPartner;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="bg-background space-y-3 rounded-lg border p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="partner-name" className="text-xs font-medium">
            {copy.partners.name}
          </label>
          <input
            id="partner-name"
            name="name"
            required
            defaultValue={defaults?.name ?? ''}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="partner-cpfCnpj" className="text-xs font-medium">
            {copy.partners.cpfCnpj}
          </label>
          <input
            id="partner-cpfCnpj"
            name="cpfCnpj"
            defaultValue={defaults?.cpfCnpj ?? ''}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="partner-qualification" className="text-xs font-medium">
            {copy.partners.qualification}
          </label>
          <input
            id="partner-qualification"
            name="qualification"
            defaultValue={defaults?.qualification ?? ''}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="partner-ownershipPercent" className="text-xs font-medium">
            {copy.partners.ownershipPercent}
          </label>
          <input
            id="partner-ownershipPercent"
            name="ownershipPercent"
            inputMode="decimal"
            defaultValue={defaults?.ownershipPercent != null ? String(defaults.ownershipPercent) : ''}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="partner-joinedOn" className="text-xs font-medium">
            {copy.partners.joinedOn}
          </label>
          <input
            id="partner-joinedOn"
            name="joinedOn"
            type="date"
            defaultValue={defaults?.joinedOn ?? ''}
            className={inputClass}
          />
        </div>
      </div>

      {state && !state.ok ? <p className="text-danger-text text-sm">{state.message}</p> : null}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? copy.partners.saving : copy.partners.save}
        </button>
        <button type="button" onClick={onDone} className={secondaryButtonClass}>
          {copy.partners.cancel}
        </button>
      </div>
    </form>
  );
}

function PartnerRow({
  companyId,
  partner,
  onEdit,
}: {
  companyId: string;
  partner: CompanyPartner;
  onEdit: () => void;
}) {
  const [removing, startRemove] = useTransition();
  const facts = [
    partner.qualification,
    partner.ownershipPercent != null ? `${partner.ownershipPercent}%` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  function handleRemove() {
    if (!window.confirm(copy.partners.removeConfirm)) return;
    startRemove(() => deletePartnerAction(partner.id, companyId));
  }

  return (
    <li className="flex items-center gap-3 p-4">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{partner.name}</span>
        {facts ? (
          <span className="text-muted-foreground mt-0.5 block truncate text-xs">{facts}</span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={onEdit}
        aria-label={copy.partners.edit}
        className="text-muted-foreground hover:text-foreground rounded-md p-1.5"
      >
        <Pencil className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={handleRemove}
        disabled={removing}
        aria-label={copy.partners.remove}
        className="text-muted-foreground hover:text-danger-text rounded-md p-1.5 disabled:opacity-60"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  );
}

export function PartnersSection({
  companyId,
  partners,
}: {
  companyId: string;
  partners: CompanyPartner[];
}) {
  // null = list; 'new' = add form; otherwise the id being edited.
  const [open, setOpen] = useState<null | 'new' | string>(null);
  const close = () => setOpen(null);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{copy.partners.title}</h2>
        {open !== 'new' ? (
          <button type="button" onClick={() => setOpen('new')} className={secondaryButtonClass}>
            <Plus className="size-4" aria-hidden />
            {copy.partners.add}
          </button>
        ) : null}
      </div>

      {open === 'new' ? (
        <PartnerForm action={createPartnerAction.bind(null, companyId)} onDone={close} />
      ) : null}

      {partners.length === 0 && open !== 'new' ? (
        <div className="rounded-xl border border-dashed px-6 py-8 text-center">
          <p className="text-sm font-medium">{copy.partners.empty}</p>
          <p className="text-muted-foreground mt-1 text-sm">{copy.partners.emptyHint}</p>
        </div>
      ) : (
        <ul className="divide-border bg-card divide-y overflow-hidden rounded-xl border">
          {partners.map((partner) =>
            open === partner.id ? (
              <li key={partner.id} className="p-4">
                <PartnerForm
                  action={updatePartnerAction.bind(null, partner.id, companyId)}
                  defaults={partner}
                  onDone={close}
                />
              </li>
            ) : (
              <PartnerRow
                key={partner.id}
                companyId={companyId}
                partner={partner}
                onEdit={() => setOpen(partner.id)}
              />
            ),
          )}
        </ul>
      )}
    </section>
  );
}
