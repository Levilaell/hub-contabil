'use client';

import { PageHeader, StatusBadge, type StatusTone } from '@hub/ui';
import { ArrowRight, Lightbulb, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { copy, sections } from './copy';

// In-app tutorial (/ajuda): one tab per screen, each explaining what it answers
// and how to test it. Self-contained tabs (useState) — no shared Tabs primitive
// exists yet and this is the only consumer. Linked from the topbar help button.
export default function AjudaPage() {
  const [active, setActive] = useState<(typeof sections)[number]['key']>(sections[0].key);
  const section = sections.find((s) => s.key === active) ?? sections[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={copy.title} description={copy.subtitle} />

      <p className="text-muted-foreground text-sm leading-relaxed">{copy.intro}</p>

      {/* Farol legend — the central visual metaphor, explained once up front. */}
      <section className="bg-card space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">{copy.legendTitle}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {copy.legend.map((item) => (
            <li key={item.label} className="flex items-center gap-2.5">
              <StatusBadge tone={item.tone as StatusTone} label={item.label} />
              <span className="text-muted-foreground text-sm">{item.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label={copy.title}
        className="flex flex-wrap gap-1.5 border-b pb-px"
      >
        {sections.map((s) => {
          const isActive = s.key === active;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(s.key)}
              className={
                isActive
                  ? 'border-primary text-foreground -mb-px border-b-2 px-3 py-2 text-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground -mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium transition-colors'
              }
            >
              {copy.tabs[s.key]}
            </button>
          );
        })}
      </div>

      {/* Active section */}
      <section className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
          <p className="text-muted-foreground text-sm">{section.goal}</p>
        </div>

        <ol className="space-y-3">
          {section.steps.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="bg-primary/10 text-primary mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums">
                {i + 1}
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        {section.tip ? (
          <div className="bg-warning/10 border-warning/20 flex gap-2.5 rounded-lg border p-3">
            <Lightbulb className="text-warning-text size-4 shrink-0" aria-hidden />
            <p className="text-warning-text text-sm">{section.tip}</p>
          </div>
        ) : null}

        {section.href ? (
          <Link
            href={section.href}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
          >
            {section.hrefLabel}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </section>

      {/* Feedback */}
      <section className="bg-muted/40 flex gap-3 rounded-xl border p-4">
        <MessageSquare className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">{copy.feedbackTitle}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">{copy.feedbackText}</p>
        </div>
      </section>
    </div>
  );
}
