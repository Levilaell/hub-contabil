'use client';

import { Plus, X } from 'lucide-react';
import { useState, useTransition } from 'react';

import { updateAdvancedConfigAction } from './actions';
import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from './copy';

type Dept = { key: string; label: string };

export function AdvancedForm({
  initialDepartments,
  initialTaxonomy,
  initialRoutingMap,
}: {
  initialDepartments: Dept[];
  initialTaxonomy: string[];
  initialRoutingMap: Record<string, string>;
}) {
  const [departments, setDepartments] = useState<Dept[]>(initialDepartments);
  const [taxonomy, setTaxonomy] = useState<string[]>(initialTaxonomy);
  const [routingMap, setRoutingMap] = useState<Record<string, string>>(initialRoutingMap);

  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('');

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addDept() {
    const key = newKey.trim().toLowerCase().replace(/\s+/g, '_');
    const label = newLabel.trim();
    if (!key || !label || departments.some((d) => d.key === key)) return;
    setDepartments((d) => [...d, { key, label }]);
    setNewKey('');
    setNewLabel('');
  }

  function removeDept(key: string) {
    setDepartments((d) => d.filter((x) => x.key !== key));
    setRoutingMap((m) => {
      const next = { ...m };
      for (const [t, dep] of Object.entries(next)) if (dep === key) delete next[t];
      return next;
    });
  }

  function editDeptLabel(key: string, label: string) {
    setDepartments((d) => d.map((x) => (x.key === key ? { ...x, label } : x)));
  }

  function addType() {
    const t = newType.trim().toLowerCase();
    if (!t || taxonomy.includes(t)) return;
    setTaxonomy((x) => [...x, t]);
    setNewType('');
  }

  function removeType(t: string) {
    setTaxonomy((x) => x.filter((y) => y !== t));
    setRoutingMap((m) => {
      const next = { ...m };
      delete next[t];
      return next;
    });
  }

  function setRoute(type: string, dept: string) {
    setRoutingMap((m) => {
      const next = { ...m };
      if (dept) next[type] = dept;
      else delete next[type];
      return next;
    });
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateAdvancedConfigAction({ departments, taxonomy, routingMap });
      if (res && !res.ok) setError(res.message);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-6">
      {/* Departments */}
      <section className="bg-card space-y-4 rounded-xl border p-5">
        <div>
          <h2 className="text-sm font-semibold">{copy.departments.title}</h2>
          <p className="text-muted-foreground text-xs">{copy.departments.hint}</p>
        </div>
        <ul className="space-y-2">
          {departments.map((d) => (
            <li key={d.key} className="flex items-center gap-2">
              <code className="bg-muted text-muted-foreground w-32 shrink-0 truncate rounded px-2 py-1 font-mono text-xs">
                {d.key}
              </code>
              <input
                value={d.label}
                onChange={(e) => editDeptLabel(d.key, e.target.value)}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => removeDept(d.key)}
                aria-label={copy.departments.remove}
                className="hover:bg-accent text-muted-foreground grid size-9 shrink-0 place-items-center rounded-md"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder={copy.departments.keyPlaceholder}
            className={`${inputClass} w-32 shrink-0`}
          />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={copy.departments.labelPlaceholder}
            className={inputClass}
          />
          <button
            type="button"
            onClick={addDept}
            aria-label={copy.departments.add}
            className={`${secondaryButtonClass} shrink-0`}
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      </section>

      {/* Taxonomy */}
      <section className="bg-card space-y-4 rounded-xl border p-5">
        <div>
          <h2 className="text-sm font-semibold">{copy.taxonomy.title}</h2>
          <p className="text-muted-foreground text-xs">{copy.taxonomy.hint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {taxonomy.map((t) => (
            <span
              key={t}
              className="bg-muted flex items-center gap-1 rounded-full px-3 py-1 text-sm"
            >
              {t}
              <button
                type="button"
                onClick={() => removeType(t)}
                aria-label={`${copy.departments.remove} ${t}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addType();
              }
            }}
            placeholder={copy.taxonomy.placeholder}
            className={inputClass}
          />
          <button
            type="button"
            onClick={addType}
            aria-label={copy.taxonomy.add}
            className={`${secondaryButtonClass} shrink-0`}
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      </section>

      {/* Routing */}
      <section className="bg-card space-y-4 rounded-xl border p-5">
        <div>
          <h2 className="text-sm font-semibold">{copy.routing.title}</h2>
          <p className="text-muted-foreground text-xs">{copy.routing.hint}</p>
        </div>
        <ul className="space-y-2">
          {taxonomy.map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="w-40 shrink-0 truncate text-sm">{t}</span>
              <select
                value={routingMap[t] ?? ''}
                onChange={(e) => setRoute(t, e.target.value)}
                className={inputClass}
              >
                <option value="">{copy.routing.none}</option>
                {departments.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </section>

      {error ? <p className="text-danger-text text-sm">{error}</p> : null}
      {saved ? <p className="text-success-text text-sm">{copy.saved}</p> : null}
      <button type="button" onClick={save} disabled={pending} className={primaryButtonClass}>
        {pending ? copy.saving : copy.save}
      </button>
    </div>
  );
}
