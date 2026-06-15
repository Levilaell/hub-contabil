'use client';

import { isValidCnpj, normalizeCnpj } from '@hub/core';
import Link from 'next/link';
import { useActionState, useState, type ReactNode } from 'react';

import type { ActionState } from './actions';
import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from './copy';

interface Regime {
  key: string;
  label: string;
}

interface CompanyDefaults {
  cnpj?: string;
  legalName?: string;
  tradeName?: string | null;
  taxRegime?: string | null;
  city?: string | null;
  state?: string | null;
}

interface CompanyFormProps {
  mode: 'create' | 'edit';
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  regimes: Regime[];
  defaults?: CompanyDefaults;
  cancelHref: string;
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

export function CompanyForm({ mode, action, regimes, defaults, cancelHref }: CompanyFormProps) {
  const [state, formAction, pending] = useActionState(action, null);
  const [cnpj, setCnpj] = useState(defaults?.cnpj ?? '');

  // Live CNPJ feedback only once 14 digits are typed (don't nag mid-entry).
  const cnpjDigits = normalizeCnpj(cnpj);
  const cnpjInvalid = cnpjDigits.length === 14 && !isValidCnpj(cnpjDigits);

  return (
    <form action={formAction} className="space-y-5">
      {mode === 'create' ? (
        <Field label={copy.form.cnpj} htmlFor="cnpj">
          <input
            id="cnpj"
            name="cnpj"
            required
            inputMode="numeric"
            autoComplete="off"
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            aria-invalid={cnpjInvalid}
            className={inputClass}
          />
          {cnpjInvalid ? <p className="text-danger-text text-xs">{copy.form.cnpjInvalid}</p> : null}
        </Field>
      ) : null}

      <Field label={copy.form.legalName} htmlFor="legalName">
        <input
          id="legalName"
          name="legalName"
          required
          defaultValue={defaults?.legalName ?? ''}
          className={inputClass}
        />
      </Field>

      <Field label={`${copy.form.tradeName} ${copy.form.optional}`} htmlFor="tradeName">
        <input
          id="tradeName"
          name="tradeName"
          defaultValue={defaults?.tradeName ?? ''}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_6rem]">
        <Field label={copy.form.taxRegime} htmlFor="taxRegime">
          <select
            id="taxRegime"
            name="taxRegime"
            defaultValue={defaults?.taxRegime ?? ''}
            className={inputClass}
          >
            <option value="">{copy.form.taxRegimeNone}</option>
            {regimes.map((regime) => (
              <option key={regime.key} value={regime.key}>
                {regime.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`${copy.form.state} ${copy.form.optional}`} htmlFor="state">
          <input
            id="state"
            name="state"
            maxLength={2}
            defaultValue={defaults?.state ?? ''}
            className={`${inputClass} uppercase`}
          />
        </Field>
      </div>

      <Field label={`${copy.form.city} ${copy.form.optional}`} htmlFor="city">
        <input id="city" name="city" defaultValue={defaults?.city ?? ''} className={inputClass} />
      </Field>

      {state && !state.ok ? <p className="text-danger-text text-sm">{state.message}</p> : null}

      <div className="flex gap-2">
        <button type="submit" disabled={pending || cnpjInvalid} className={primaryButtonClass}>
          {pending
            ? copy.form.submitting
            : mode === 'create'
              ? copy.form.submitNew
              : copy.form.submitEdit}
        </button>
        <Link href={cancelHref} className={secondaryButtonClass}>
          {copy.form.cancel}
        </Link>
      </div>
    </form>
  );
}
