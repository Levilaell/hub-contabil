# RUNBOOK — Deploy Escritório Demo (production)

Reproducible, step-by-step production deployment for the Hub Contábil base product.
One **Supabase Cloud** project + one **Railway** project (two services: `web` + `worker`)
per firm. Written for Demo; **§11 parametrizes it for client #2**.

> Conventions: run repo commands from the repo root unless noted. Secrets go in env
> vars / the platform's secret store only — never commit them (`.env*` is git-ignored).

---

## 0. Prerequisites

- Accounts: **Supabase** (Cloud), **Railway**, the firm's **domain** registrar, **Anthropic**
  (AI triage + atendimento), **Resend** (transactional e-mail). Optional: **Meta** (WhatsApp
  Cloud API, for inbound documents + atendimento), an **IMAP** mailbox (inbound e-mail),
  **Langfuse** (AI tracing).
- Local tools: Node ≥ 20, `pnpm` 10.x (`corepack enable`), **Supabase CLI**, `git`.
- `pnpm install` succeeds and `pnpm typecheck && pnpm lint && pnpm test` are green.

---

## 1. Create the production Supabase project

1. Supabase → **New project**. Name `hub-demo-prod`. **Region: South America (São Paulo) / sa-east-1** (data residency + latency). Set a strong database password — store it in the secret manager.
2. From **Settings → API**, copy: Project URL (`https://<ref>.supabase.co`), `anon` key, `service_role` key (**secret**).
3. From **Settings → Database → Connection string → Session pooler** (port 5432), copy the connection string; URL-encode special chars in the password. This is `DATABASE_URL`.
4. **Settings → Database → Backups → enable PITR** (Point-in-Time Recovery). Confirm daily backups are on. *(Closes the HARDENING.md §5 item.)*

> Keep **dev** and **prod** as separate Supabase projects. Never point prod env at dev.

---

## 2. Apply the schema (migrations) to prod

The migrations live in `packages/db/supabase/migrations` (idempotent, versioned).

```bash
# Link the CLI to the prod project (one-time), then push:
supabase link --project-ref <prod-ref>
pnpm --filter @hub/db db:push          # applies all migrations
pnpm --filter @hub/db db:types         # regenerate src/database.types.ts from prod
```

If `supabase link` isn't available in your environment, apply via the session-pooler
`DATABASE_URL` instead (the migrations are idempotent and record themselves in
`supabase_migrations.schema_migrations`): run `node apps/worker/apply-pending-migrations.mjs`
with `DATABASE_URL` pointed at **prod** in `apps/worker/.env`.

Verify (REST, service key): `firms`, `companies`, `documents`, `mapping_rules`,
`export_batches`, `classifications` all return HTTP 200.

The `documents` Storage bucket (private, 50 MiB cap) and its RLS are created by the
migrations — confirm it exists under **Storage**.

---

## 3. Seed the firm + users, apply Demo config

The seed (`packages/db/src/seed.ts`) creates the firm + one user per role via the Admin
API (service role). It uses `FIRM_ID = 11111111-…` and emails `*@demo.test`.

```bash
# packages/db/.env must point at PROD (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
# Set a strong production password — do NOT ship the dev default.
SEED_PASSWORD='<strong-prod-password>' pnpm --filter @hub/db seed
```

Then, in Supabase **Auth → Users**, set real e-mails/passwords for the firm's actual
people (or invite them) and remove the `*@demo.test` placeholders you don't need.

Apply the initial firm config (`clients/demo/config.json`) to `firms.config` — easiest
via the **Settings** screen after first login, or with a one-off `update public.firms set
config = '<json>' where id = '<firm-id>'`. Omitted fields fall back to the validated
defaults in `packages/config`.

> ⚠️ **Validate the document taxonomy + routing map with the partner** before relying on
> AI triage — they're config, adjustable in Settings without a deploy.

---

## 4. External service credentials

- **Anthropic** (AI triage, T20): create an API key → `ANTHROPIC_API_KEY` (worker). Without
  it, triage falls back to a heuristic that sends everything to the exception queue.
- **Resend** (e-mail, T17): create an API key → `RESEND_API_KEY`; verify the firm's sender
  domain and set `RESEND_FROM` (e.g. `Escritório Demo <no-reply@demo.example>`).
  Without these the MessagingAdapter is a no-op (links still work via copy-paste).
- **WhatsApp Cloud API** (inbound + atendimento, optional): from Meta for Developers,
  obtain `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`,
  `WHATSAPP_VERIFY_TOKEN`. Set the **same four in both web and worker** (web verifies the
  webhook signature; worker downloads media + sends). The temporary token from API Setup
  lasts 24h — use a permanent **System User** token for prod. Then point the Meta webhook
  at `https://<app-url>/api/webhooks/whatsapp`, verify token = `WHATSAPP_VERIFY_TOKEN`,
  and subscribe the `messages` field. Without these, WhatsApp is a no-op.
- **IMAP** (inbound e-mail, optional): set `IMAP_HOST`, `IMAP_USER`, `IMAP_PASSWORD`
  (`IMAP_PORT` default 993, `IMAP_SECURE` default true) on the **worker**. Use a dedicated
  mailbox + an app password (Gmail/M365 block basic IMAP). Without these the poll cron is
  not scheduled. (Atendimento auto-reply also needs `support.autoReply` on in `firms.config`.)
- **Langfuse** (optional): not wired yet; leave unset until the observability seam is enabled.

---

## 5. Provision compute (web + worker)

Two deployables, both pointing at the **prod** Supabase project:

> **Hosting decision.** The **web** (Next.js) is ideal on **Vercel**. The **worker** is a
> long-running poller + cron process, which does **not** fit Vercel's serverless model
> as-is — host it on a **persistent host** (Railway / Render / Fly). Recommended split:
> **web → Vercel, worker → Railway** (or both on Railway if you prefer one platform).
> An all-Vercel setup is possible but requires rewriting the worker into Vercel Cron +
> an on-demand queue-drain function, and chunking long export/triage jobs to fit the
> function timeout — no feature is lost, but it's real work; defer unless needed.

**Service `web`** (Next.js — Vercel or Railway):
- Vercel: import the repo, set **Root Directory** to `apps/web`, framework Next.js (build/start auto-detected). Railway: Build `pnpm install && pnpm --filter @hub/web build`, Start `pnpm --filter @hub/web start`.
- Env:
  | Var | Value |
  | --- | --- |
  | `NEXT_PUBLIC_SUPABASE_URL` | prod Project URL |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod anon key |
  | `SUPABASE_SERVICE_ROLE_KEY` | prod service_role (**secret**) — used by `/s/` Storage + the WhatsApp webhook |
  | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | from §4 (optional; needed to verify the webhook) |
  | `FIRM_ID` | this firm's UUID (optional — webhook firm resolution; falls back to the single firms row) |

**Service `worker`** (Node consumers + crons — persistent host, e.g. Railway):
- Build: `pnpm install` *(the worker runs via tsx — no compile step)*
- Start: `pnpm --filter @hub/worker start:prod` *(env injected by Railway; the dev `start` script reads a local `.env` and would fail in prod)*
- Env:
  | Var | Value |
  | --- | --- |
  | `SUPABASE_URL` | prod Project URL |
  | `SUPABASE_SERVICE_ROLE_KEY` | prod service_role (**secret**) |
  | `DATABASE_URL` | prod session-pooler string (port 5432, password URL-encoded) |
  | `APP_BASE_URL` | the firm's app URL (for request links in reminder e-mails), e.g. `https://app.demo.example` |
  | `CRON_ACCELERATED` | `false` (production cadence: deadlines 06:00, recurrences day 1, alerts hourly) |
  | `ANTHROPIC_API_KEY` | from §4 (optional) |
  | `RESEND_API_KEY`, `RESEND_FROM` | from §4 (optional) |
  | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | from §4 (optional; media download + send) |
  | `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASSWORD`, `IMAP_SECURE` | from §4 (optional; inbound e-mail poll) |
  | `ENRICHMENT_THROTTLE_MS` | optional (default 1000) |

> The worker uses the service role and **must** filter every query by `firm_id` (golden
> rule #1) — enforced by `apps/worker/src/firm-scope.test.ts` in CI.

---

## 6. Domain & DNS

Point the firm's app subdomain (e.g. `app.demo.example`) at the **web** host (Vercel or
Railway custom domain + the CNAME it provides). Set `APP_BASE_URL` on the `worker` to the
same URL so public request links (`/s/{token}`) and reminder e-mails resolve.

---

## 7. Smoke-test production end to end

Log in as a firm user and walk the critical flows (these mirror the E2E specs in
`apps/web/e2e`):

1. **Login** → dashboard loads.
2. **Onboarding**: import a small companies spreadsheet → companies listed; enrichment fills CNAE/address.
3. **Document request**: create one, open the `/s/{token}` link in an incognito window → status becomes *visualizado*; upload via the link → lands in the repository.
4. **Triagem (IA)**: "Triagem por IA" upload a sample NF-e XML + a PDF → XML files deterministically; the PDF classifies (or lands in Exceções); use **Corrigir** on one.
5. **Prazos**: add a monitored doc with a near/past due date → traffic light + alert/task on the daily cron.
6. **Exportação**: build a batch → it turns *Pronto*; download the `.zip` (renamed files + `manifest.json`/`manifest.csv`); pending-CFOP files are excluded.
7. **Entrada por WhatsApp** (if configured): from a registered test number, send a document and a text question to the firm's WhatsApp → the document flows through triage into the repository; the question opens a ticket in **Atendimento**.
8. **Atendimento**: open `/atendimento`, reply to the ticket → the reply is delivered over WhatsApp; with `support.autoReply` on + Anthropic set, trivial questions get an AI answer, the rest escalate.

Confirm the worker logs show `connected to Supabase Cloud`, queues polling (incl. `inbound`/`support`), and crons scheduled.

---

## 8. Security checklist (see HARDENING.md)

- [ ] PITR/backups enabled on prod (§1).
- [ ] RLS on every table (it is — migrations); cross-tenant tests green against a dev project.
- [ ] Public route `/s/[token]`: validation + rate limit active. The limiter is **in-memory per instance** — keep `web` at **1 instance**, or move the limiter to a shared store before scaling out.
- [ ] Rotate any secret ever pasted into a chat/ticket; store all secrets in Railway/Supabase secret stores only.

---

## 9. Operations

- **Logs**: per-service host logs. Failed jobs dead-letter → the **Exceções** screen (never silent).
- **Migrations**: add versioned SQL in `packages/db/supabase/migrations`, then `db:push` to prod during a maintenance window; `db:types` after.
- **Backups**: PITR + daily; test a restore before go-live.
- **Force a deadline pass** (outside the 06:00 cron): on the worker host, `node --env-file=.env --import tsx ops-deadline-sweep.mjs` — recomputes statuses, emits alerts, creates overdue renewal tasks. Idempotent.
- **WhatsApp webhook health**: Meta re-sends a GET verification on config changes; the endpoint echoes the challenge when `WHATSAPP_VERIFY_TOKEN` matches. Inbound failures dead-letter from the `inbound`/`support` queues → **Exceções**. The access token expires (24h for temp tokens) — rotate to a System User token.
- **IMAP poll**: the `inbound-imap` cron only runs when `IMAP_*` is set; check worker logs for `[cron] inbound-imap`. Messages are marked `\Seen` after routing; `inbound_messages` (unique uid) prevents double-processing.

---

## 10. Rollback

- App: redeploy the previous image/deployment on each host (web + worker).
- Data: PITR restore to a timestamp before the incident (coordinate — restores affect the whole project).
- A bad migration: ship a forward-fixing migration; migrations are idempotent, never edited in place.

---

## 11. Reproduce for client #2

The product is multi-tenant-ready but deployed single-tenant. For a new firm, repeat
§1–§7 with these changes — no core code edits:

1. New Supabase project + new Railway project (own env values).
2. In `packages/db/src/seed.ts`, change `FIRM_ID` (new UUID), `FIRM_NAME`, and the seed
   user emails — or parametrize them via env before running the seed.
3. Create `clients/<firm>/config.json` (copy this firm's, adjust triggers/convention/
   taxonomy) and apply to that firm's `firms.config`.
4. New domain + `APP_BASE_URL`; new external keys (Anthropic/Resend).
5. Run §7 smoke flows.

> Per the extraction pact (PLANEJAMENTO §9): week 1 of client #2, extract any commons
> into `packages/*` before adding features — keep `clients/*` to config/overrides only.
