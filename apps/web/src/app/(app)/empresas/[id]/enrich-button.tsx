'use client';

import { Sparkles } from 'lucide-react';
import { useTransition } from 'react';

import { enrichCompanyAction } from '../actions';
import { copy, secondaryButtonClass } from '../copy';

export function EnrichButton({ companyId }: { companyId: string }) {
  const [running, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={running}
      onClick={() => startTransition(() => enrichCompanyAction(companyId))}
      className={secondaryButtonClass}
    >
      <Sparkles className="size-4" aria-hidden />
      {running ? copy.enrichment.enriching : copy.enrichment.enrich}
    </button>
  );
}
