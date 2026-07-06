'use client';

import {
  DOCUMENTS_BUCKET,
  buildInboxPath,
  enqueueTriage,
  insertInboxDocument,
} from '@hub/db';
import { DetailDrawer, StatusBadge, type StatusTone } from '@hub/ui';
import { Sparkles, UploadCloud } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, type DragEvent } from 'react';

import { createClient } from '@/lib/supabase/client';

import { copy, primaryButtonClass, secondaryButtonClass } from './copy';

type FileStatus = 'sending' | 'done' | 'duplicate' | 'error';
interface FileRow {
  name: string;
  status: FileStatus;
}

const STATUS: Record<FileStatus, { tone: StatusTone; label: string }> = {
  sending: { tone: 'warning', label: copy.inbox.sending },
  done: { tone: 'success', label: copy.inbox.done },
  duplicate: { tone: 'neutral', label: copy.inbox.duplicate },
  error: { tone: 'danger', label: copy.inbox.error },
};

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function InboxButton({ firmId }: { firmId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (busy || !fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setBusy(true);
    setRows(files.map((f) => ({ name: f.name, status: 'sending' })));
    const setStatus = (i: number, status: FileStatus) =>
      setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status } : r)));

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i]!;
      try {
        const hash = await sha256(file);
        const path = buildInboxPath(firmId, hash, file.name);
        const upload = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .upload(path, file, { upsert: false });
        if (upload.error) {
          // an existing object means the same content is already in the inbox
          setStatus(i, upload.error.message.includes('exists') ? 'duplicate' : 'error');
          continue;
        }
        const registered = await insertInboxDocument(supabase, {
          storagePath: path,
          hash,
          fileName: file.name,
          sizeBytes: file.size,
        });
        if (!registered.ok) {
          const isDup = registered.message.includes('duplicado');
          if (!isDup) await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
          setStatus(i, isDup ? 'duplicate' : 'error');
          continue;
        }
        await enqueueTriage(supabase, registered.id);
        setStatus(i, 'done');
      } catch {
        setStatus(i, 'error');
      }
    }
    setBusy(false);
    router.refresh();
  }

  const done = rows.filter((r) => r.status === 'done').length;
  const err = rows.filter((r) => r.status === 'error').length;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={secondaryButtonClass}>
        <Sparkles className="size-4" aria-hidden />
        {copy.inbox.button}
      </button>

      <DetailDrawer
        open={open}
        onOpenChange={(o) => {
          if (busy) return;
          setOpen(o);
          if (!o) setRows([]);
        }}
        title={copy.inbox.title}
        closeLabel={copy.inbox.close}
      >
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">{copy.inbox.hint}</p>

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
              void handleFiles(e.dataTransfer.files);
            }}
            disabled={busy}
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center text-sm transition-colors ${
              dragOver ? 'border-primary bg-accent' : 'hover:bg-accent'
            } disabled:opacity-60`}
          >
            <UploadCloud className="text-muted-foreground size-6" aria-hidden />
            <span className="text-muted-foreground">{copy.inbox.drop}</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.xml,.png,.jpg,.jpeg,.gif,.webp"
            multiple
            hidden
            onChange={(e) => void handleFiles(e.target.files)}
          />

          {rows.length > 0 ? (
            <ul className="divide-border bg-card max-h-64 divide-y overflow-y-auto rounded-xl border">
              {rows.map((row, i) => (
                <li key={`${row.name}-${i}`} className="flex items-center gap-3 p-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm">{row.name}</span>
                  <StatusBadge tone={STATUS[row.status].tone} label={STATUS[row.status].label} />
                </li>
              ))}
            </ul>
          ) : null}

          {rows.length > 0 && !busy ? (
            <p className="text-muted-foreground text-sm">{copy.inbox.summary(done, err)}</p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              if (busy) return;
              setOpen(false);
              setRows([]);
            }}
            disabled={busy}
            className={primaryButtonClass}
          >
            {copy.inbox.close}
          </button>
        </div>
      </DetailDrawer>
    </>
  );
}
