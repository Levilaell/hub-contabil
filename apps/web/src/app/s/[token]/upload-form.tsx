'use client';

import { CheckCircle2, UploadCloud } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';

import { createClient } from '@/lib/supabase/client';

import { finalizeUploadAction, prepareUploadAction } from './actions';
import { copy } from './copy';

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

type State = 'idle' | 'sending' | 'done' | 'error';

export function UploadForm({ token, bucket }: { token: string; bucket: string }) {
  const supabase = createClient();
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file || state === 'sending') return;
    setState('sending');
    setMessage('');
    try {
      const hash = await sha256(file);
      const prepared = await prepareUploadAction(token, hash, file.name);
      if (!prepared.ok) {
        setState('error');
        setMessage(prepared.message);
        return;
      }
      const upload = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(prepared.path, prepared.uploadToken, file);
      if (upload.error) {
        setState('error');
        setMessage(copy.upload.error);
        return;
      }
      const finalized = await finalizeUploadAction(token, hash, file.name, file.size);
      if (!finalized.ok) {
        setState('error');
        setMessage(finalized.message ?? copy.upload.error);
        return;
      }
      setState('done');
    } catch {
      setState('error');
      setMessage(copy.upload.error);
    }
  }

  if (state === 'done') {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="bg-success/12 text-success flex size-12 items-center justify-center rounded-full">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <p className="font-medium">{copy.upload.success}</p>
        <p className="text-muted-foreground text-sm">{copy.upload.successHint}</p>
      </div>
    );
  }

  const busy = state === 'sending';
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-center text-sm">{copy.upload.instruction}</p>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e: DragEvent) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e: DragEvent) => {
          e.preventDefault();
          setDragOver(false);
          void handleFile(e.dataTransfer.files[0]);
        }}
        disabled={busy}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center text-sm transition-colors ${
          dragOver ? 'border-primary bg-accent' : 'hover:bg-accent'
        } disabled:opacity-60`}
      >
        <UploadCloud className="text-muted-foreground size-6" aria-hidden />
        <span className="text-muted-foreground">
          {busy ? copy.upload.sending : copy.upload.dropzone}
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.xml,.png,.jpg,.jpeg,.gif,.webp"
        hidden
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {state === 'error' ? <p className="text-danger text-center text-sm">{message}</p> : null}
    </div>
  );
}
