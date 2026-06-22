# HARDENING.md — Hub Contábil (T24)

Security & robustness checklist for v1. Status: ✅ done · ⚠️ action required on prod.

## 1. RLS review — table by table ✅

Every domain table has **RLS enabled** and a policy of the form
`firm_id = public.current_firm_id()` (the firm comes from the JWT, never a table
lookup — golden rule #1). `current_firm_id()` reads `app_metadata.firm_id` from the
JWT only. Authenticated grants are the **minimum** each screen needs; everything else
goes through SECURITY DEFINER RPCs or the service role (worker).

| Table | authenticated grants | Write path beyond direct grants |
| --- | --- | --- |
| `firms` | select, update **(config only)** | — |
| `users` | select | provisioned out-of-band |
| `user_departments` | select | — |
| `audit_events` | select, insert | append-only; stamped via `log_audit` |
| `companies` | select, insert, update | archive via `status` (no delete) |
| `contacts` | select, insert, update, delete | — |
| `tasks` | select, insert, update | handoff via `handoff_task` RPC (no delete) |
| `notifications` | select | written by service / triggers |
| `recurring_tasks` | select, insert, update, delete | — |
| `documents` | select, insert, delete | **no update** — derived CFOP via `apply_cfop_metadata` RPC (file immutable, golden rule #4) |
| `monitored_documents` | select, insert, update, delete | daily cron recompute (service) |
| `document_requests` | select, insert | status changes via token RPCs only |
| `document_request_events` | select | written via token RPCs |
| `exception_queue` | **select only** | inserts via service or `queue_rules_exception`; resolve via `resolve_exception` |
| `mapping_rules` | select, insert, update, delete | — |
| `export_batches` | **select only** | created via `create_export_batch`; built by worker (service) |
| `export_batch_documents` | **select only** | written by worker (service) |
| `storage.objects` (documents bucket) | select, insert, delete **scoped to `firm/{firm_id}/…`** | path prefix enforced by storage RLS |

**Automated proof:** cross-tenant isolation is asserted in `packages/db` integration
tests — `rls.test.ts` plus per-feature "does not list a foreign firm …" cases
(`monitored-documents`, `mapping-rules`, `cfop`, `export-batches`). They run against
the cloud dev project (`pnpm --filter @hub/db test` with `packages/db/.env`).

**Privileged RPCs** (SECURITY DEFINER, `set search_path = ''`, firm derived
server-side, granted to `authenticated`, revoked from `public`/`anon`):
`log_audit`, `resolve_exception`, `queue_rules_exception`, `apply_cfop_metadata`,
`request_enrichment`, `create_export_batch`, `mark_export_downloaded`,
`mark_notification_read`, `handoff_task`, `cancel_document_request`,
`rotate_request_token`, and the token-only set (`get_request_by_token`,
`get_request_owner`, `log_request_view`, `record_request_upload`,
`record_request_download`, `hash_request_token`).

## 2. Public route `/s/[token]` ✅

The only unauthenticated surface. Defenses:

- **Token-keyed, no session.** Only the token's **hash** is stored; every decision
  goes through SECURITY DEFINER RPCs that resolve the token server-side.
- **Service role is minimal.** It appears only to mint signed Storage URLs, and the
  Storage path is always **re-derived server-side** from the token-resolved owner —
  never trusted from client input (`buildStoragePath(owner.firmId, owner.companyId, …)`).
- **Zod validation** on every input (`apps/web/src/app/s/[token]/actions.ts`): token
  (base64url, 20–200 chars), hash (sha256 hex), file name (1–255), size (≤ 50 MiB).
- **Per-IP rate limiting** (`apps/web/src/lib/rate-limit.ts`): view 60/min, upload
  20/min, download 30/min, keyed on `x-forwarded-for`. Unit-tested.
  ⚠️ **Limitation:** the limiter is **in-memory (per instance)** — correct for the v1
  single-instance web deploy. A multi-instance deploy must move it to a shared store
  (a pg table or Redis).
- Invalid/expired tokens render a friendly expiry page (the page resolves the request
  before showing actions).

## 3. Worker `firm_id` scope sweep ✅

The worker uses the **service role** (bypasses RLS), so every write must scope
`firm_id` itself. `apps/worker/src/firm-scope.test.ts` statically scans the worker
source and **fails** if any `insert/update/delete` on a `public.*` table omits
`firm_id`. Cross-firm cron **reads** (e.g. scanning `public.firms` to iterate every
firm) are intentionally exempt — the risk is writing to the wrong firm, not reading;
each row carries `firm_id` and every subsequent write re-scopes it. Runs in CI via
`pnpm test`.

## 4. Designed error / empty / loading states ✅

- `apps/web/src/app/error.tsx` — root error boundary (public route, login).
- `apps/web/src/app/global-error.tsx` — root-layout crash fallback (inline-styled, so
  it renders even if the stylesheet is unavailable).
- `apps/web/src/app/not-found.tsx` — 404.
- `apps/web/src/app/(app)/error.tsx` — authenticated-shell error boundary.
- Per-feature `loading.tsx` skeletons and shared `<EmptyState>` (UX rule #7).

## 5. Backups / PITR ⚠️ action required on prod

Point-in-Time Recovery is a Supabase project setting, not code. On the **prod**
project: Dashboard → Database → Backups → enable **PITR**. Confirm daily backups are
running. This is a step in the T25 deployment runbook (`clients/demo/RUNBOOK.md`).

## 6. Summary

| Item | Status |
| --- | --- |
| RLS enabled + firm-scoped on every table | ✅ |
| Cross-tenant isolation tests | ✅ (cloud dev) |
| Public route: validation + rate limit + token-only | ✅ |
| Worker firm_id sweep (CI test) | ✅ |
| Error / not-found / global-error pages | ✅ |
| Backups / PITR on prod | ⚠️ enable on prod (T25) |
| Rate limiter shared across instances | ⚠️ only if web scales beyond 1 instance |
