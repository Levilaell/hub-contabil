'use client';

import { parseNfe } from '@hub/core';
import { DOCUMENTS_BUCKET, buildStoragePath, findDocumentByHash, insertDocument } from '@hub/db';
import { DetailDrawer, StatusBadge, type StatusTone } from '@hub/ui';
import { Upload, UploadCloud } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, type DragEvent } from 'react';

import { createClient } from '@/lib/supabase/client';

import { applyCfopAction } from './actions';
import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from './copy';

interface Department {
  key: string;
  label: string;
}
type FileStatus = 'pending' | 'sending' | 'done' | 'duplicate' | 'error';
interface FileRow {
  name: string;
  status: FileStatus;
}

const STATUS: Record<FileStatus, { tone: StatusTone; label: string }> = {
  pending: { tone: 'muted', label: copy.uploader.pending },
  sending: { tone: 'warning', label: copy.uploader.sending },
  done: { tone: 'success', label: copy.uploader.done },
  duplicate: { tone: 'neutral', label: copy.uploader.duplicate },
  error: { tone: 'danger', label: copy.uploader.error },
};

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function UploadButton({
  companyId,
  firmId,
  departments,
  docTypes,
}: {
  companyId: string;
  firmId: string;
  departments: Department[];
  docTypes: string[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const periodRef = useRef<HTMLInputElement>(null);
  const deptRef = useRef<HTMLSelectElement>(null);
  const typeRef = useRef<HTMLSelectElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (busy || !fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const period = periodRef.current?.value.trim() || null;
    const department = deptRef.current?.value || null;
    const docType = typeRef.current?.value || 'other';

    setBusy(true);
    setRows(files.map((f) => ({ name: f.name, status: 'pending' })));
    const setStatus = (i: number, status: FileStatus) =>
      setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status } : r)));

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i]!;
      setStatus(i, 'sending');
      try {
        const hash = await sha256(file);
        // Dedup BEFORE upload — skip identical content (no storage, no row).
        if (await findDocumentByHash(supabase, companyId, hash)) {
          setStatus(i, 'duplicate');
          continue;
        }
        const path = buildStoragePath(firmId, companyId, period, department, hash, file.name);
        const upload = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .upload(path, file, { upsert: false });
        if (upload.error) {
          setStatus(i, 'error');
          continue;
        }
        const registered = await insertDocument(supabase, {
          companyId,
          period,
          department,
          docType,
          storagePath: path,
          hash,
          fileName: file.name,
          sizeBytes: file.size,
        });
        if (!registered.ok) {
          const isDup = registered.message.includes('duplicado');
          // Non-dup failure → the uploaded object is a true orphan, remove it. On a
          // dup the content already has a winning row; leave its file alone.
          if (!isDup) await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
          setStatus(i, isDup ? 'duplicate' : 'error');
          continue;
        }
        setStatus(i, 'done');
        // NF-e XML → resolve CFOPs and fill documents.metadata.entry_cfop (T19).
        // Best-effort: the deterministic parse runs client-side; failures never
        // touch the upload result.
        if (file.name.toLowerCase().endsWith('.xml')) {
          try {
            const parsed = parseNfe(await file.text());
            if (parsed.isNfe && parsed.items.length > 0) {
              await applyCfopAction(registered.id, parsed.issuerCnpj, parsed.items);
            }
          } catch {
            // ignore — CFOP application is an enhancement, not part of the upload
          }
        }
      } catch {
        setStatus(i, 'error');
      }
    }
    setBusy(false);
    router.refresh();
  }

  const done = rows.filter((r) => r.status === 'done').length;
  const dup = rows.filter((r) => r.status === 'duplicate').length;
  const err = rows.filter((r) => r.status === 'error').length;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
        <Upload className="size-4" aria-hidden />
        {copy.upload}
      </button>

      <DetailDrawer
        open={open}
        onOpenChange={(o) => {
          if (busy) return;
          setOpen(o);
          if (!o) setRows([]);
        }}
        title={copy.uploader.title}
        closeLabel={copy.uploader.close}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="up-period" className="text-xs font-medium">
                {copy.uploader.periodLabel}
              </label>
              <input id="up-period" ref={periodRef} placeholder="2026-06" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="up-dept" className="text-xs font-medium">
                {copy.uploader.departmentLabel}
              </label>
              <select id="up-dept" ref={deptRef} defaultValue="" className={inputClass}>
                <option value="">{copy.uploader.departmentNone}</option>
                {departments.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="up-type" className="text-xs font-medium">
              {copy.uploader.typeLabel}
            </label>
            <select id="up-type" ref={typeRef} defaultValue={docTypes[0]} className={inputClass}>
              {docTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

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
            <span className="text-muted-foreground">{copy.uploader.dropzone}</span>
          </button>
          <input
            ref={fileRef}
            type="file"
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
            <p className="text-muted-foreground text-sm">{copy.uploader.summary(done, dup, err)}</p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              if (busy) return;
              setOpen(false);
              setRows([]);
            }}
            disabled={busy}
            className={secondaryButtonClass}
          >
            {copy.uploader.close}
          </button>
        </div>
      </DetailDrawer>
    </>
  );
}
