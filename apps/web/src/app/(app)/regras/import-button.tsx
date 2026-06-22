'use client';

import { DetailDrawer } from '@hub/ui';
import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { importRulesAction } from './actions';
import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from './copy';

export function ImportButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(copy.importer.noFile);
      return;
    }
    const formData = new FormData();
    formData.set('file', file);
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await importRulesAction(formData);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setResult(copy.importer.result(res.created, res.skipped));
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={secondaryButtonClass}>
        <Upload className="size-4" aria-hidden />
        {copy.import}
      </button>

      <DetailDrawer
        open={open}
        onOpenChange={setOpen}
        title={copy.importer.title}
        closeLabel={copy.importer.cancel}
      >
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">{copy.importer.hint}</p>
          <div className="space-y-1.5">
            <label htmlFor="rules-file" className="text-xs font-medium">
              {copy.importer.fileLabel}
            </label>
            <input id="rules-file" ref={fileRef} type="file" accept=".csv,.xlsx" className={inputClass} />
          </div>
          {error ? <p className="text-danger-text text-sm">{error}</p> : null}
          {result ? <p className="text-sm font-medium">{result}</p> : null}
          <div className="flex gap-2">
            <button type="button" onClick={submit} disabled={pending} className={primaryButtonClass}>
              {pending ? copy.importer.importing : copy.importer.submit}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>
              {copy.importer.cancel}
            </button>
          </div>
        </div>
      </DetailDrawer>
    </>
  );
}
