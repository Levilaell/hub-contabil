'use client';

import type { ExceptionItem } from '@hub/db';
import { DataList, DataListRow, DetailDrawer, StatusBadge, type StatusTone } from '@hub/ui';
import { AlertTriangle } from 'lucide-react';
import { useState, useTransition } from 'react';

import {
  applyTriageSuggestionAction,
  resolveExceptionAction,
  saveRuleFromExceptionAction,
} from './actions';
import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from './copy';

export interface TriageApplyOptions {
  taxonomy: string[];
  departments: { key: string; label: string }[];
  companies: { id: string; name: string; cnpj: string }[];
  routingMap: Record<string, string>;
}

const STATUS: Record<string, { tone: StatusTone; label: string }> = {
  open: { tone: 'warning', label: copy.badge.open },
  resolved: { tone: 'success', label: copy.badge.resolved },
  ignored: { tone: 'muted', label: copy.badge.ignored },
};

function sourceLabel(source: string): string {
  return copy.sources[source] ?? source;
}

function ctxValue(ctx: Record<string, unknown>, key: string): string | null {
  const v = ctx[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

export function ExceptionsList({
  exceptions,
  triageOptions,
}: {
  exceptions: ExceptionItem[];
  triageOptions: TriageApplyOptions;
}) {
  const [selected, setSelected] = useState<ExceptionItem | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Save-as-rule mode (T18): turn a 'rules' pending into a mapping rule.
  const [ruleMode, setRuleMode] = useState(false);
  const [level, setLevel] = useState<1 | 2>(1);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [values, setValues] = useState<Record<string, string>>({});

  // Apply-triage mode (Fase 1.1 §3): file the document from the exception.
  const [applyMode, setApplyMode] = useState(false);
  const [applyDocType, setApplyDocType] = useState('');
  const [applyCompanyId, setApplyCompanyId] = useState('');
  const [applyDepartment, setApplyDepartment] = useState('');

  function open(item: ExceptionItem) {
    setSelected(item);
    setNote('');
    setError(null);
    setRuleMode(false);
    setApplyMode(false);
  }

  function close() {
    setSelected(null);
    setRuleMode(false);
    setApplyMode(false);
  }

  function resolve(status: 'resolved' | 'ignored') {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const res = await resolveExceptionAction(selected.id, status, note);
      if (res && !res.ok) setError(res.message);
      else close();
    });
  }

  function startApply() {
    if (!selected) return;
    setError(null);
    const suggested = ctxValue(selected.suggestion, 'docType') ?? '';
    setApplyDocType(triageOptions.taxonomy.includes(suggested) ? suggested : '');
    // Pre-select the company by the CNPJ the AI extracted, when it exists now.
    const cnpj = ctxValue(selected.context, 'cnpj');
    const match = cnpj ? triageOptions.companies.find((c) => c.cnpj === cnpj) : undefined;
    setApplyCompanyId(match?.id ?? '');
    setApplyDepartment(''); // '' = automatic by type (routingMap)
    setApplyMode(true);
  }

  function submitApply() {
    if (!selected || !applyDocType) {
      setError(copy.triage.needType);
      return;
    }
    setError(null);
    const department = applyDepartment || triageOptions.routingMap[applyDocType] || null;
    startTransition(async () => {
      const res = await applyTriageSuggestionAction(selected.id, {
        docType: applyDocType,
        companyId: applyCompanyId || null,
        department,
        note,
      });
      if (res && !res.ok) setError(res.message);
      else close();
    });
  }

  function startRule() {
    if (!selected) return;
    setError(null);
    setLevel(1);
    setIncluded(new Set(Object.keys(asRecord(selected.context.key))));
    const seed: Record<string, string> = {};
    for (const [k, v] of Object.entries(selected.suggestion)) seed[k] = v == null ? '' : String(v);
    setValues(seed);
    setRuleMode(true);
  }

  function toggleField(field: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  function submitRule() {
    if (!selected) return;
    setError(null);
    const domain = ctxValue(selected.context, 'domain') ?? '';
    const fullKey = asRecord(selected.context.key);
    const key: Record<string, unknown> = {};
    for (const field of Object.keys(fullKey)) if (included.has(field)) key[field] = fullKey[field];
    startTransition(async () => {
      const res = await saveRuleFromExceptionAction(selected.id, {
        domain,
        level,
        key,
        value: { ...values },
      });
      if (res && !res.ok) setError(res.message);
      else close();
    });
  }

  const errorText = selected ? ctxValue(selected.context, 'error') : null;
  const attempts = selected ? ctxValue(selected.context, 'read_ct') : null;
  const payload = selected?.context.payload;
  const hasSuggestion = selected ? Object.keys(selected.suggestion).length > 0 : false;
  const resolvedBy = selected ? ctxValue(selected.resolution, 'resolvedBy') : null;

  // A 'triage' pending with a document can be resolved by FILING the document.
  const canApplyTriage =
    selected?.source === 'triage' &&
    selected.status === 'open' &&
    Boolean(ctxValue(selected.context, 'documentId'));
  const triageReason = selected ? ctxValue(selected.context, 'reason') : null;
  const triageReasonLabel = triageReason
    ? (copy.triage.reasons[triageReason] ?? triageReason)
    : null;
  const triageConfidence = selected ? ctxValue(selected.context, 'confidence') : null;
  const suggestionText = selected
    ? [
        ctxValue(selected.suggestion, 'docType'),
        triageConfidence !== null
          ? copy.triage.confidence(Math.round(Number(triageConfidence) * 100))
          : null,
        ctxValue(selected.suggestion, 'cnpj') ? `CNPJ ${ctxValue(selected.suggestion, 'cnpj')}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  // A 'rules' pending carries { domain, key } in its context — the raw material for
  // a mapping rule (T18). Only then do we offer "save as rule".
  const ruleDomain = selected ? (ctxValue(selected.context, 'domain') ?? '') : '';
  const ruleKey = selected ? asRecord(selected.context.key) : {};
  const canMakeRule =
    selected?.source === 'rules' &&
    selected.status === 'open' &&
    ruleDomain !== '' &&
    Object.keys(ruleKey).length > 0;

  return (
    <>
      <DataList>
        {exceptions.map((item) => (
          <DataListRow
            key={item.id}
            onClick={() => open(item)}
            leading={
              <span className="bg-muted text-muted-foreground grid size-9 place-items-center rounded-full">
                <AlertTriangle className="size-4" aria-hidden />
              </span>
            }
            title={
              ctxValue(item.context, 'fileName') ??
              ctxValue(item.context, 'error') ??
              sourceLabel(item.source)
            }
            facts={
              [
                sourceLabel(item.source),
                ctxValue(item.context, 'reason')
                  ? (copy.triage.reasons[ctxValue(item.context, 'reason') ?? ''] ??
                    ctxValue(item.context, 'reason'))
                  : null,
                timeAgo(item.createdAt),
              ].filter(Boolean) as string[]
            }
            trailing={
              <StatusBadge tone={STATUS[item.status].tone} label={STATUS[item.status].label} />
            }
          />
        ))}
      </DataList>

      <DetailDrawer
        open={selected !== null}
        onOpenChange={(o) => !o && close()}
        title={selected ? sourceLabel(selected.source) : copy.drawer.title}
        description={copy.drawer.title}
        closeLabel={copy.drawer.close}
        footer={
          selected?.status === 'open' ? (
            ruleMode ? (
              <div className="space-y-3">
                {error ? <p className="text-danger-text text-sm">{error}</p> : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitRule}
                    disabled={pending}
                    className={primaryButtonClass}
                  >
                    {pending ? copy.rule.saving : copy.rule.save}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRuleMode(false);
                      setError(null);
                    }}
                    className={secondaryButtonClass}
                  >
                    {copy.rule.cancel}
                  </button>
                </div>
              </div>
            ) : applyMode ? (
              <div className="space-y-3">
                {error ? <p className="text-danger-text text-sm">{error}</p> : null}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={copy.drawer.notePlaceholder}
                  rows={2}
                  className={inputClass}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitApply}
                    disabled={pending}
                    className={primaryButtonClass}
                  >
                    {pending ? copy.triage.submitting : copy.triage.submit}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setApplyMode(false);
                      setError(null);
                    }}
                    className={secondaryButtonClass}
                  >
                    {copy.rule.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {error ? <p className="text-danger-text text-sm">{error}</p> : null}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={copy.drawer.notePlaceholder}
                  rows={2}
                  className={inputClass}
                />
                <div className="flex flex-wrap gap-2">
                  {canApplyTriage ? (
                    <button
                      type="button"
                      onClick={startApply}
                      disabled={pending}
                      className={primaryButtonClass}
                    >
                      {copy.triage.apply}
                    </button>
                  ) : null}
                  {canMakeRule ? (
                    <button
                      type="button"
                      onClick={startRule}
                      disabled={pending}
                      className={primaryButtonClass}
                    >
                      {copy.rule.saveAsRule}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => resolve('resolved')}
                    disabled={pending}
                    className={
                      canMakeRule || canApplyTriage ? secondaryButtonClass : primaryButtonClass
                    }
                  >
                    {pending ? copy.drawer.working : copy.drawer.resolve}
                  </button>
                  <button
                    type="button"
                    onClick={() => resolve('ignored')}
                    disabled={pending}
                    className={secondaryButtonClass}
                  >
                    {copy.drawer.ignore}
                  </button>
                </div>
              </div>
            )
          ) : null
        }
      >
        {selected ? (
          applyMode ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">{copy.triage.title}</p>
                <p className="text-muted-foreground text-xs">{copy.triage.subtitle}</p>
              </div>

              <dl className="space-y-1 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs">{copy.triage.file}</dt>
                  <dd className="mt-0.5 font-medium">
                    {ctxValue(selected.context, 'fileName') ?? '—'}
                  </dd>
                </div>
                {suggestionText ? (
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      {copy.triage.suggestionSummary}
                    </dt>
                    <dd className="mt-0.5">{suggestionText}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="space-y-1.5">
                <label htmlFor="apply-doctype" className="text-xs font-medium">
                  {copy.triage.docType}
                </label>
                <select
                  id="apply-doctype"
                  value={applyDocType}
                  onChange={(e) => setApplyDocType(e.target.value)}
                  className={inputClass}
                >
                  <option value="">—</option>
                  {triageOptions.taxonomy.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="apply-company" className="text-xs font-medium">
                  {copy.triage.company}
                </label>
                <select
                  id="apply-company"
                  value={applyCompanyId}
                  onChange={(e) => setApplyCompanyId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{copy.triage.companyKeep}</option>
                  {triageOptions.companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="apply-department" className="text-xs font-medium">
                  {copy.triage.department}
                </label>
                <select
                  id="apply-department"
                  value={applyDepartment}
                  onChange={(e) => setApplyDepartment(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{copy.triage.departmentAuto}</option>
                  {triageOptions.departments.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : ruleMode ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">{copy.rule.title}</p>
                <p className="text-muted-foreground text-xs">{copy.rule.subtitle}</p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="rule-level" className="text-xs font-medium">
                  {copy.rule.level}
                </label>
                <select
                  id="rule-level"
                  value={level}
                  onChange={(e) => setLevel(Number(e.target.value) === 2 ? 2 : 1)}
                  className={inputClass}
                >
                  <option value={1}>{copy.rule.levelSpecific}</option>
                  <option value={2}>{copy.rule.levelGeneral}</option>
                </select>
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-xs font-medium">{copy.rule.scope}</p>
                  <p className="text-muted-foreground text-xs">{copy.rule.scopeHint}</p>
                </div>
                <ul className="space-y-1.5">
                  {Object.entries(ruleKey).map(([field, value]) => (
                    <li key={field} className="flex items-center gap-2">
                      <input
                        id={`rule-field-${field}`}
                        type="checkbox"
                        checked={included.has(field)}
                        onChange={() => toggleField(field)}
                        className="size-4"
                      />
                      <label htmlFor={`rule-field-${field}`} className="text-sm">
                        <span className="font-medium">{field}</span>: {String(value ?? '—')}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium">{copy.rule.value}</p>
                {Object.keys(values).length === 0 ? (
                  <p className="text-muted-foreground text-sm">{copy.rule.noValue}</p>
                ) : (
                  Object.keys(values).map((field) => (
                    <div key={field} className="space-y-1">
                      <label htmlFor={`rule-value-${field}`} className="text-muted-foreground text-xs">
                        {field}
                      </label>
                      <input
                        id={`rule-value-${field}`}
                        value={values[field]}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [field]: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">{copy.drawer.error}</dt>
                <dd className="mt-0.5 font-medium">
                  {triageReasonLabel ?? errorText ?? copy.noError}
                </dd>
              </div>
              {ctxValue(selected.context, 'fileName') ? (
                <div>
                  <dt className="text-muted-foreground text-xs">{copy.triage.file}</dt>
                  <dd className="mt-0.5">{ctxValue(selected.context, 'fileName')}</dd>
                </div>
              ) : null}
              <div className="flex gap-6">
                <div>
                  <dt className="text-muted-foreground text-xs">{copy.drawer.origin}</dt>
                  <dd className="mt-0.5">{sourceLabel(selected.source)}</dd>
                </div>
                {attempts ? (
                  <div>
                    <dt className="text-muted-foreground text-xs">{copy.drawer.attempts}</dt>
                    <dd className="mt-0.5">{attempts}</dd>
                  </div>
                ) : null}
              </div>

              {hasSuggestion ? (
                <div>
                  <dt className="text-muted-foreground text-xs">{copy.drawer.suggestion}</dt>
                  <dd className="mt-0.5">
                    {selected.source === 'triage' && suggestionText
                      ? suggestionText
                      : JSON.stringify(selected.suggestion)}
                  </dd>
                </div>
              ) : null}

              {selected.status !== 'open' && resolvedBy ? (
                <div>
                  <dt className="text-muted-foreground text-xs">{copy.drawer.resolvedBy}</dt>
                  <dd className="mt-0.5">
                    {STATUS[selected.status].label}
                    {ctxValue(selected.resolution, 'note')
                      ? ` — ${ctxValue(selected.resolution, 'note')}`
                      : ''}
                  </dd>
                </div>
              ) : null}

              {payload !== undefined ? (
                <details className="rounded-lg border p-3">
                  <summary className="text-muted-foreground cursor-pointer text-xs">
                    {copy.drawer.technical}
                  </summary>
                  <pre className="text-muted-foreground mt-2 overflow-x-auto text-xs">
                    {JSON.stringify(payload, null, 2)}
                  </pre>
                </details>
              ) : null}
            </dl>
          )
        ) : null}
      </DetailDrawer>
    </>
  );
}
