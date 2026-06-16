'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';

import { downloadAction } from './actions';
import { copy } from './copy';

export function DownloadButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleDownload() {
    if (busy) return;
    setBusy(true);
    setError('');
    const result = await downloadAction(token);
    if (result.ok) {
      window.location.href = result.url;
      // leave busy true briefly; the navigation starts the download
      setTimeout(() => setBusy(false), 1500);
    } else {
      setError(result.message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-center text-sm">{copy.offer.instruction}</p>
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={busy}
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-60"
      >
        <Download className="size-4" aria-hidden />
        {busy ? copy.offer.downloading : copy.offer.download}
      </button>
      {error ? <p className="text-danger text-center text-sm">{error}</p> : null}
    </div>
  );
}
