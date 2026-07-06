'use client';

import type { CompanyEnrichment } from '@hub/adapters';
import { isValidCnpj, normalizeCnpj } from '@hub/core';
import Link from 'next/link';
import { useActionState, useState, useTransition, type ReactNode } from 'react';

import { lookupCnpjAction, type ActionState } from './actions';
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
  legalNature?: string | null;
  companySize?: string | null;
  stateRegistration?: string | null;
  municipalRegistration?: string | null;
  nire?: string | null;
  nireIssuedOn?: string | null;
  activitiesStartedOn?: string | null;
  serviceStartedOn?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressDistrict?: string | null;
  addressZip?: string | null;
  shareCapital?: number | null;
  cnaeCode?: string | null;
  cnaeDescription?: string | null;
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

function TextField({
  name,
  label,
  defaultValue,
  type = 'text',
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  type?: string;
}) {
  return (
    <Field label={label} htmlFor={name}>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ''}
        className={inputClass}
      />
    </Field>
  );
}

// Lookup result → form prefill. The tax regime is only a hint (mei/simples flags);
// anything else stays for the accountant to pick.
function prefillFromLookup(data: CompanyEnrichment): CompanyDefaults {
  return {
    legalName: data.legalName ?? '',
    tradeName: data.tradeName,
    taxRegime: data.meiOptant ? 'mei' : data.simplesOptant ? 'simples_nacional' : null,
    city: data.address.city,
    state: data.address.state,
    legalNature: data.legalNature,
    companySize: data.companySize,
    activitiesStartedOn: data.activitiesStartedOn,
    addressStreet: data.address.street,
    addressNumber: data.address.number,
    addressComplement: data.address.complement,
    addressDistrict: data.address.district,
    addressZip: data.address.zip,
    shareCapital: data.shareCapital,
    cnaeCode: data.cnaePrimaryCode,
    cnaeDescription: data.cnaePrimaryDescription,
  };
}

export function CompanyForm({ mode, action, regimes, defaults, cancelHref }: CompanyFormProps) {
  const [state, formAction, pending] = useActionState(action, null);
  const [cnpj, setCnpj] = useState(defaults?.cnpj ?? '');

  // CNPJ-first create flow (Fase 1.1 §1.2): lookup happens BEFORE the rest of the
  // form appears; the accountant reviews prefilled data instead of typing it.
  const [step, setStep] = useState<'cnpj' | 'form'>(mode === 'create' ? 'cnpj' : 'form');
  const [prefill, setPrefill] = useState<CompanyDefaults | undefined>(defaults);
  const [partners, setPartners] = useState<{ name: string; qualification: string | null }[]>([]);
  const [lookupState, setLookupState] = useState<'idle' | 'done' | 'failed'>('idle');
  const [looking, startLookup] = useTransition();

  // Live CNPJ feedback only once 14 digits are typed (don't nag mid-entry).
  const cnpjDigits = normalizeCnpj(cnpj);
  const cnpjInvalid = cnpjDigits.length === 14 && !isValidCnpj(cnpjDigits);
  const cnpjReady = cnpjDigits.length === 14 && !cnpjInvalid;

  function runLookup() {
    startLookup(async () => {
      const result = await lookupCnpjAction(cnpjDigits);
      if (result.ok) {
        setPrefill(prefillFromLookup(result.data));
        setPartners(result.data.partners.map((p) => ({ name: p.name, qualification: p.qualification })));
        setLookupState('done');
      } else {
        setPrefill(undefined);
        setPartners([]);
        setLookupState('failed');
      }
      setStep('form');
    });
  }

  if (step === 'cnpj') {
    return (
      <div className="space-y-5">
        <Field label={copy.form.cnpj} htmlFor="cnpj">
          <input
            id="cnpj"
            name="cnpj"
            required
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            aria-invalid={cnpjInvalid}
            className={inputClass}
          />
          {cnpjInvalid ? (
            <p className="text-danger-text text-xs">{copy.form.cnpjInvalid}</p>
          ) : (
            <p className="text-muted-foreground text-xs">{copy.form.lookupHint}</p>
          )}
        </Field>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runLookup}
            disabled={!cnpjReady || looking}
            className={primaryButtonClass}
          >
            {looking ? copy.form.lookingUp : copy.form.lookup}
          </button>
          <button
            type="button"
            onClick={() => {
              setLookupState('idle');
              setStep('form');
            }}
            disabled={!cnpjReady || looking}
            className={secondaryButtonClass}
          >
            {copy.form.manualFill}
          </button>
          <Link href={cancelHref} className={secondaryButtonClass}>
            {copy.form.cancel}
          </Link>
        </div>
      </div>
    );
  }

  const d = prefill;
  const detailsOpen = lookupState === 'done';

  return (
    <form action={formAction} className="space-y-5">
      {mode === 'create' ? (
        <>
          {lookupState === 'done' ? (
            <p className="bg-success/10 text-success-text rounded-lg px-3 py-2 text-sm">
              {copy.form.lookupDone}
            </p>
          ) : null}
          {lookupState === 'failed' ? (
            <p className="bg-warning/10 text-warning-text rounded-lg px-3 py-2 text-sm">
              {copy.form.lookupFailed}
            </p>
          ) : null}
          <Field label={copy.form.cnpj} htmlFor="cnpj">
            <div className="flex gap-2">
              <input
                id="cnpj"
                name="cnpj"
                required
                readOnly
                value={cnpj}
                className={`${inputClass} bg-muted`}
              />
              <button
                type="button"
                onClick={() => setStep('cnpj')}
                className={secondaryButtonClass}
              >
                {copy.form.changeCnpj}
              </button>
            </div>
          </Field>
        </>
      ) : null}

      <Field label={copy.form.legalName} htmlFor="legalName">
        <input
          id="legalName"
          name="legalName"
          required
          defaultValue={d?.legalName ?? ''}
          className={inputClass}
        />
      </Field>

      <Field label={`${copy.form.tradeName} ${copy.form.optional}`} htmlFor="tradeName">
        <input id="tradeName" name="tradeName" defaultValue={d?.tradeName ?? ''} className={inputClass} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_6rem]">
        <Field label={copy.form.taxRegime} htmlFor="taxRegime">
          <select
            id="taxRegime"
            name="taxRegime"
            defaultValue={d?.taxRegime ?? ''}
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
            defaultValue={d?.state ?? ''}
            className={`${inputClass} uppercase`}
          />
        </Field>
      </div>

      <Field label={`${copy.form.city} ${copy.form.optional}`} htmlFor="city">
        <input id="city" name="city" defaultValue={d?.city ?? ''} className={inputClass} />
      </Field>

      {/* Fase 1.1 §1.1 — optional cadastral detail, collapsed by default (UX rule 12);
          opened after a successful lookup so the accountant sees what arrived. */}
      <details open={detailsOpen} className="bg-background rounded-lg border px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">{copy.form.detailsSection}</summary>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField name="legalNature" label={copy.form.legalNature} defaultValue={d?.legalNature} />
          <TextField name="companySize" label={copy.form.companySize} defaultValue={d?.companySize} />
          <TextField
            name="stateRegistration"
            label={copy.form.stateRegistration}
            defaultValue={d?.stateRegistration}
          />
          <TextField
            name="municipalRegistration"
            label={copy.form.municipalRegistration}
            defaultValue={d?.municipalRegistration}
          />
          <TextField name="nire" label={copy.form.nire} defaultValue={d?.nire} />
          <TextField
            name="nireIssuedOn"
            label={copy.form.nireIssuedOn}
            defaultValue={d?.nireIssuedOn}
            type="date"
          />
          <TextField
            name="activitiesStartedOn"
            label={copy.form.activitiesStartedOn}
            defaultValue={d?.activitiesStartedOn}
            type="date"
          />
          <TextField
            name="serviceStartedOn"
            label={copy.form.serviceStartedOn}
            defaultValue={d?.serviceStartedOn}
            type="date"
          />
          <TextField
            name="shareCapital"
            label={copy.form.shareCapital}
            defaultValue={d?.shareCapital != null ? String(d.shareCapital) : ''}
          />
          <TextField name="cnaeCode" label={copy.form.cnaeCode} defaultValue={d?.cnaeCode} />
          <div className="sm:col-span-2">
            <TextField
              name="cnaeDescription"
              label={copy.form.cnaeDescription}
              defaultValue={d?.cnaeDescription}
            />
          </div>
        </div>
      </details>

      <details open={detailsOpen} className="bg-background rounded-lg border px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">{copy.form.addressSection}</summary>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField name="addressStreet" label={copy.form.addressStreet} defaultValue={d?.addressStreet} />
          <TextField name="addressNumber" label={copy.form.addressNumber} defaultValue={d?.addressNumber} />
          <TextField
            name="addressComplement"
            label={copy.form.addressComplement}
            defaultValue={d?.addressComplement}
          />
          <TextField
            name="addressDistrict"
            label={copy.form.addressDistrict}
            defaultValue={d?.addressDistrict}
          />
          <TextField name="addressZip" label={copy.form.addressZip} defaultValue={d?.addressZip} />
        </div>
      </details>

      {mode === 'create' && partners.length > 0 ? (
        <div className="bg-background rounded-lg border px-4 py-3">
          <p className="text-sm font-medium">{copy.partners.title}</p>
          <p className="text-muted-foreground text-xs">{copy.form.partnersFound(partners.length)}</p>
          <ul className="mt-2 space-y-1">
            {partners.map((p) => (
              <li key={p.name} className="text-sm">
                {p.name}
                {p.qualification ? (
                  <span className="text-muted-foreground"> — {p.qualification}</span>
                ) : null}
              </li>
            ))}
          </ul>
          <input type="hidden" name="partnersJson" value={JSON.stringify(partners)} />
        </div>
      ) : null}

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
