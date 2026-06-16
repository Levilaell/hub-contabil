import { DOCUMENTS_BUCKET, getRequestByToken } from '@hub/db';
import { CheckCircle2, Link2Off, ShieldCheck } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';

import { copy } from './copy';
import { DownloadButton } from './download-button';
import { UploadForm } from './upload-form';
import { ViewLogger } from './view-logger';

// Public client page (T16). No firm session — the token in the URL is the access
// credential, resolved entirely through token-keyed RPCs. The simplest screen in
// the product: brand + one sentence + one action. Always dynamically rendered.
export const dynamic = 'force-dynamic';

function Shell({ brand, children }: { brand?: string; children: React.ReactNode }) {
  return (
    <main className="bg-muted/40 flex min-h-full flex-1 items-center justify-center p-4">
      <div className="bg-card w-full max-w-md space-y-6 rounded-2xl border p-6 shadow-sm sm:p-8">
        {brand ? (
          <div className="flex items-center justify-between border-b pb-4">
            <span className="font-semibold">{brand}</span>
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <ShieldCheck className="size-3.5" aria-hidden />
              {copy.secure}
            </span>
          </div>
        ) : null}
        {children}
        <p className="text-muted-foreground border-t pt-4 text-center text-xs">{copy.poweredBy}</p>
      </div>
    </main>
  );
}

function Notice({ title, body, brand }: { title: string; body: string; brand?: string }) {
  return (
    <Shell brand={brand}>
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
          <Link2Off className="size-6" aria-hidden />
        </span>
        <h1 className="text-base font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">{body}</p>
      </div>
    </Shell>
  );
}

export default async function PublicRequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const view = await getRequestByToken(supabase, token);

  if (!view) {
    return <Notice title={copy.invalid.title} body={copy.invalid.body} />;
  }
  if (view.isExpired) {
    return <Notice title={copy.expired.title} body={copy.expired.body} brand={view.firmName} />;
  }

  return (
    <Shell brand={view.firmName}>
      {/* Logs the open from a client effect (bot-safe) — not during this render. */}
      <ViewLogger token={token} />
      <div className="space-y-1.5 text-center">
        <p className="text-muted-foreground text-xs">{view.companyName}</p>
        <h1 className="text-lg font-semibold">{view.title}</h1>
        {view.description ? (
          <p className="text-muted-foreground text-sm">{view.description}</p>
        ) : null}
      </div>

      {view.kind === 'upload_request' ? (
        view.status === 'received' ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="bg-success/12 text-success flex size-12 items-center justify-center rounded-full">
              <CheckCircle2 className="size-6" aria-hidden />
            </span>
            <p className="font-medium">{copy.upload.received}</p>
          </div>
        ) : (
          <UploadForm token={token} bucket={DOCUMENTS_BUCKET} />
        )
      ) : (
        <DownloadButton token={token} />
      )}
    </Shell>
  );
}
