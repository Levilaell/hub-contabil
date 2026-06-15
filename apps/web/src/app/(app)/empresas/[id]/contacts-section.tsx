'use client';

import type { Contact, PreferredChannel } from '@hub/db';
import { StatusBadge } from '@hub/ui';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useActionState, useEffect, useState, useTransition } from 'react';

import {
  createContactAction,
  deleteContactAction,
  updateContactAction,
  type ActionState,
} from '../actions';
import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from '../copy';

const CHANNELS: PreferredChannel[] = ['email', 'phone', 'whatsapp'];

function ContactForm({
  action,
  defaults,
  onDone,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaults?: Contact;
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
          <label htmlFor="name" className="text-xs font-medium">
            {copy.contacts.name}
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={defaults?.name ?? ''}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-medium">
            {copy.contacts.email}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={defaults?.email ?? ''}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="phone" className="text-xs font-medium">
            {copy.contacts.phone}
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={defaults?.phone ?? ''}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="preferredChannel" className="text-xs font-medium">
            {copy.contacts.channel}
          </label>
          <select
            id="preferredChannel"
            name="preferredChannel"
            defaultValue={defaults?.preferredChannel ?? 'email'}
            className={inputClass}
          >
            {CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {copy.contacts.channels[channel]}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm sm:pt-6">
          <input
            type="checkbox"
            name="isPrimary"
            defaultChecked={defaults?.isPrimary ?? false}
            className="size-4 rounded border"
          />
          {copy.contacts.markPrimary}
        </label>
      </div>

      {state && !state.ok ? <p className="text-danger-text text-sm">{state.message}</p> : null}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? copy.contacts.saving : copy.contacts.save}
        </button>
        <button type="button" onClick={onDone} className={secondaryButtonClass}>
          {copy.contacts.cancel}
        </button>
      </div>
    </form>
  );
}

function ContactRow({
  companyId,
  contact,
  onEdit,
}: {
  companyId: string;
  contact: Contact;
  onEdit: () => void;
}) {
  const [removing, startRemove] = useTransition();
  const detail = contact.email || contact.phone || copy.contacts.channels[contact.preferredChannel];

  function handleRemove() {
    if (!window.confirm(copy.contacts.removeConfirm)) return;
    startRemove(() => deleteContactAction(contact.id, companyId));
  }

  return (
    <li className="flex items-center gap-3 p-4">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{contact.name}</span>
          {contact.isPrimary ? <StatusBadge tone="success" label={copy.contacts.primary} /> : null}
        </span>
        <span className="text-muted-foreground mt-0.5 block truncate text-xs">{detail}</span>
      </span>
      <button
        type="button"
        onClick={onEdit}
        aria-label={copy.contacts.edit}
        className="text-muted-foreground hover:text-foreground rounded-md p-1.5"
      >
        <Pencil className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={handleRemove}
        disabled={removing}
        aria-label={copy.contacts.remove}
        className="text-muted-foreground hover:text-danger-text rounded-md p-1.5 disabled:opacity-60"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  );
}

export function ContactsSection({
  companyId,
  contacts,
}: {
  companyId: string;
  contacts: Contact[];
}) {
  // null = list; 'new' = add form; otherwise the id being edited.
  const [open, setOpen] = useState<null | 'new' | string>(null);
  const close = () => setOpen(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {open !== 'new' ? (
          <button type="button" onClick={() => setOpen('new')} className={secondaryButtonClass}>
            <Plus className="size-4" aria-hidden />
            {copy.contacts.add}
          </button>
        ) : null}
      </div>

      {open === 'new' ? (
        <ContactForm action={createContactAction.bind(null, companyId)} onDone={close} />
      ) : null}

      {contacts.length === 0 && open !== 'new' ? (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="text-sm font-medium">{copy.contacts.empty}</p>
          <p className="text-muted-foreground mt-1 text-sm">{copy.contacts.emptyHint}</p>
        </div>
      ) : (
        <ul className="divide-border bg-card divide-y overflow-hidden rounded-xl border">
          {contacts.map((contact) =>
            open === contact.id ? (
              <li key={contact.id} className="p-4">
                <ContactForm
                  action={updateContactAction.bind(null, contact.id, companyId)}
                  defaults={contact}
                  onDone={close}
                />
              </li>
            ) : (
              <ContactRow
                key={contact.id}
                companyId={companyId}
                contact={contact}
                onEdit={() => setOpen(contact.id)}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}
