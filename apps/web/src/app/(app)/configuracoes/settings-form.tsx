'use client';

import { useActionState, useState } from 'react';

import { updateFirmConfigAction } from './actions';
import { copy } from './copy';

const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';

interface SettingsFormProps {
  canEdit: boolean;
  deadlineDefaultDays: number;
  aiThreshold: number;
  supportAutoReply: boolean;
  supportAiThreshold: number;
  supportAiModel: string;
  supportFaq: { q: string; a: string }[];
  receptionEnabled: boolean;
  receptionGreeting: string;
  receptionOptions: { label: string; department: string }[];
  departments: { key: string; label: string }[];
  taxonomy: string[];
  routingMap: Record<string, string>;
}

// Confidence presets (T33) — plain words instead of a bare 0–1 input; the
// numeric value still travels in the form (a hidden field), so the config
// schema and everything downstream stay unchanged. "Personalizado" reveals
// the raw input for fine-tuning.
function ThresholdField({
  id,
  name,
  initial,
  presets,
  disabled,
}: {
  id: string;
  name: string;
  initial: number;
  presets: { value: number; label: string }[];
  disabled: boolean;
}) {
  const match = presets.find((p) => Math.abs(p.value - initial) < 1e-9);
  const [mode, setMode] = useState<string>(match ? String(match.value) : 'custom');
  const [custom, setCustom] = useState(String(initial));

  return (
    <div className="space-y-1.5">
      <select
        id={id}
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        disabled={disabled}
        className={inputClass}
      >
        {presets.map((p) => (
          <option key={p.value} value={String(p.value)}>
            {p.label}
          </option>
        ))}
        <option value="custom">{copy.presets.custom}</option>
      </select>
      {mode === 'custom' ? (
        <input
          type="number"
          min={0}
          max={1}
          step={0.01}
          required
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          disabled={disabled}
          aria-label={copy.presets.customLabel}
          className={`${inputClass} max-w-28`}
        />
      ) : null}
      <input type="hidden" name={name} value={mode === 'custom' ? custom : mode} />
    </div>
  );
}

const fmt = (v: number) => v.toLocaleString('pt-BR');

const SUPPORT_MODELS = [
  { value: 'claude-haiku-4-5-20251001', label: copy.supportModelFast },
  { value: 'claude-sonnet-5', label: copy.supportModelBalanced },
  { value: 'claude-opus-4-8', label: copy.supportModelAdvanced },
];

export function SettingsForm(props: SettingsFormProps) {
  const {
    canEdit,
    deadlineDefaultDays,
    aiThreshold,
    supportAutoReply,
    supportAiThreshold,
    supportAiModel,
    supportFaq,
    receptionEnabled,
    receptionGreeting,
    receptionOptions,
    departments,
    taxonomy,
    routingMap,
  } = props;
  const [state, formAction, pending] = useActionState(updateFirmConfigAction, null);

  return (
    <form action={formAction} className="space-y-6">
      {!canEdit ? <p className="text-muted-foreground text-sm">{copy.readOnlyNote}</p> : null}

      <div className="bg-card space-y-5 rounded-xl border p-5">
        <div className="space-y-1.5">
          <label htmlFor="deadlineDefaultDays" className="text-sm font-medium">
            {copy.deadlineLabel}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="deadlineDefaultDays"
              name="deadlineDefaultDays"
              type="number"
              min={1}
              max={365}
              required
              disabled={!canEdit}
              defaultValue={deadlineDefaultDays}
              className={`${inputClass} max-w-28`}
            />
            <span className="text-muted-foreground text-sm">{copy.deadlineSuffix}</span>
          </div>
          <p className="text-muted-foreground text-xs">{copy.deadlineHint}</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="aiThreshold" className="text-sm font-medium">
            {copy.aiLabel}
          </label>
          <ThresholdField
            id="aiThreshold"
            name="aiThreshold"
            initial={aiThreshold}
            disabled={!canEdit}
            presets={[
              { value: 0.95, label: copy.presets.strict(fmt(0.95)) },
              { value: 0.85, label: copy.presets.balanced(fmt(0.85)) },
              { value: 0.7, label: copy.presets.permissive(fmt(0.7)) },
            ]}
          />
          <p className="text-muted-foreground text-xs">{copy.aiHint}</p>
        </div>

        <div className="space-y-3 border-t pt-5">
          <p className="text-sm font-semibold">{copy.supportTitle}</p>
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              name="supportAutoReply"
              disabled={!canEdit}
              defaultChecked={supportAutoReply}
              className="mt-0.5 size-4"
            />
            <span>
              <span className="block text-sm font-medium">{copy.supportAutoReplyLabel}</span>
              <span className="text-muted-foreground block text-xs">
                {copy.supportAutoReplyHint}
              </span>
            </span>
          </label>
          <div className="space-y-1.5">
            <label htmlFor="supportAiThreshold" className="text-sm font-medium">
              {copy.supportThresholdLabel}
            </label>
            <ThresholdField
              id="supportAiThreshold"
              name="supportAiThreshold"
              initial={supportAiThreshold}
              disabled={!canEdit}
              presets={[
                { value: 0.9, label: copy.presets.strict(fmt(0.9)) },
                { value: 0.8, label: copy.presets.balanced(fmt(0.8)) },
                { value: 0.65, label: copy.presets.permissive(fmt(0.65)) },
              ]}
            />
            <p className="text-muted-foreground text-xs">{copy.supportThresholdHint}</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="supportAiModel" className="text-sm font-medium">
              {copy.supportModelLabel}
            </label>
            <select
              id="supportAiModel"
              name="supportAiModel"
              disabled={!canEdit}
              defaultValue={supportAiModel}
              className={inputClass}
            >
              {SUPPORT_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
              {SUPPORT_MODELS.every((m) => m.value !== supportAiModel) ? (
                <option value={supportAiModel}>{copy.supportModelCurrent(supportAiModel)}</option>
              ) : null}
            </select>
            <p className="text-muted-foreground text-xs">{copy.supportModelHint}</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="supportFaq" className="text-sm font-medium">
              {copy.supportFaqLabel}
            </label>
            <textarea
              id="supportFaq"
              name="supportFaq"
              rows={5}
              disabled={!canEdit}
              defaultValue={supportFaq.map((f) => `${f.q} | ${f.a}`).join('\n')}
              placeholder={copy.supportFaqPlaceholder}
              className={inputClass}
            />
            <p className="text-muted-foreground text-xs">{copy.supportFaqHint}</p>
          </div>
        </div>

        <div className="space-y-3 border-t pt-5">
          <p className="text-sm font-semibold">{copy.receptionTitle}</p>
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              name="receptionEnabled"
              disabled={!canEdit}
              defaultChecked={receptionEnabled}
              className="mt-0.5 size-4"
            />
            <span>
              <span className="block text-sm font-medium">{copy.receptionEnabledLabel}</span>
              <span className="text-muted-foreground block text-xs">
                {copy.receptionEnabledHint}
              </span>
            </span>
          </label>
          <div className="space-y-1.5">
            <label htmlFor="receptionGreeting" className="text-sm font-medium">
              {copy.receptionGreetingLabel}
            </label>
            <input
              id="receptionGreeting"
              name="receptionGreeting"
              disabled={!canEdit}
              defaultValue={receptionGreeting}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="receptionOptions" className="text-sm font-medium">
              {copy.receptionOptionsLabel}
            </label>
            <textarea
              id="receptionOptions"
              name="receptionOptions"
              rows={5}
              disabled={!canEdit}
              defaultValue={receptionOptions.map((o) => `${o.label} | ${o.department}`).join('\n')}
              placeholder={copy.receptionOptionsPlaceholder}
              className={inputClass}
            />
            <p className="text-muted-foreground text-xs">
              {copy.receptionOptionsHint(departments.map((d) => d.key).join(', '))}
            </p>
          </div>
        </div>

        {state && !state.ok ? <p className="text-danger-text text-sm">{state.message}</p> : null}
        {state?.ok ? <p className="text-success-text text-sm">{copy.saved}</p> : null}

        {canEdit ? (
          <button
            type="submit"
            disabled={pending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
          >
            {pending ? copy.saving : copy.save}
          </button>
        ) : null}
      </div>

      <details className="bg-card rounded-xl border p-5">
        <summary className="cursor-pointer text-sm font-medium">{copy.advanced}</summary>
        <div className="mt-4 space-y-4">
          <p className="text-muted-foreground text-xs">{copy.advancedNote}</p>
          <div>
            <p className="mb-1.5 text-sm font-medium">{copy.departments}</p>
            <div className="flex flex-wrap gap-1.5">
              {departments.map((dept) => (
                <span key={dept.key} className="bg-muted rounded-full px-2.5 py-0.5 text-xs">
                  {dept.label}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">{copy.taxonomy}</p>
            <div className="flex flex-wrap gap-1.5">
              {taxonomy.map((type) => (
                <span
                  key={type}
                  className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 font-mono text-xs"
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">{copy.routing}</p>
            <ul className="text-muted-foreground space-y-0.5 text-xs">
              {Object.entries(routingMap).map(([type, dept]) => (
                <li key={type}>
                  <span className="font-mono">{type}</span> → {dept}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </form>
  );
}
