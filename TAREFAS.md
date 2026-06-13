# TAREFAS.md — Hub Contábil · Base Product (v1)

Execution: **one task at a time**, in order. When done, stop and wait for review. Every task follows the "definition of done" in CLAUDE.md; every screen task additionally follows the **UI definition of done** (UX checklist 1–13).

---

## Phase 0 — Foundation

**T1 · Monorepo bootstrap**
pnpm monorepo with `apps/web` (Next.js + TS + Tailwind + shadcn/ui), `apps/worker` (Node + TS), `packages/db`, `packages/core`, `packages/adapters`, `packages/config`, `packages/ui`, `clients/mrocha`. Shared strict tsconfig, ESLint, Prettier, Vitest, dev scripts. Supabase CLI linked to the **cloud dev project** (no local DB). Acceptance: `pnpm dev` runs web and worker against Supabase Cloud; lint and typecheck clean; README with commands and env var list.

**T2 · Design system + app shell (`packages/ui`)**
Semantic tokens (success/warning/danger/neutral/muted), typography and spacing scale; components: `StatusBadge` (color+icon+label), `TrafficLight` (incl. aggregation logic), `StatCard` (big number, clickable), `EmptyState`, `DataList` (list row: indicator + title + up to 2 facts + chevron), `DetailDrawer`, `PageHeader` (title + ONE primary action), skeleton loaders. App shell: single sidebar (max 7 items, icons, count-badge slot), topbar, responsive breakpoints. Storybook-style demo page rendering all components in all states. Acceptance: demo page approved visually **before any feature screen is built**; no feature may re-implement status visuals.

**T3 · Base schema + RLS + auth**
Migrations on Supabase Cloud: `firms`, `users` (profile over auth.users with role), `user_departments` (junction; owner/manager access all departments), `audit_events`. RLS by `firm_id` via JWT claim; `updated_at` trigger; seed: M Rocha firm + one user per role. `audit(actor, action, entity, context)` helper in core. Acceptance: automated test proving cross-tenant query returns empty/error; working login; audit event written on a test action.

**T4 · Firm config layer**
Zod schemas in `packages/config` (deadline triggers, AI threshold, taxonomy, routing map, departments, status vocabularies). Persisted in `firms.config` JSONB with defaults; minimal Settings screen (read/edit with validation, advanced options collapsed). Acceptance: changing a trigger on screen reflects in DB; invalid config rejected with pt-BR message.

**T5 · Queues and crons infrastructure**
pgmq on Supabase Cloud: `triage`, `export`, `notifications` + DLQs. Job runner with Zod payloads, exponential retry (3x), DLQ→exception queue (T9; log until then). Cron scheduler: stubs `deadlines-daily`, `recurrences-monthly`, `alerts`. Acceptance: test job enqueued→processed; job failing 3x lands in DLQ; crons fire on schedule in accelerated dev mode.

---

## Phase 1 — Registry (M1, M2)

**T6 · Companies + contacts**
Migrations `companies`, `contacts`; CRUD with CNPJ check-digit validation; list as `DataList` (status + name + regime/city), filters collapsed behind a default view; detail page skeleton with tabs. Acceptance: create/edit/archive; duplicate CNPJ within firm rejected; audit emitted; UX checklist passed.

**T7 · CNPJ enrichment (adapter)**
`CnpjEnrichmentAdapter` + BrasilAPI implementation with throttling, ReceitaWS fallback, cache in `companies.enrichment_data`. "Enrich" action on detail + auto-enrichment on create. Acceptance: valid CNPJ fills legal name/CNAE/address; API failure doesn't break creation (pending with retry).

**T8 · Spreadsheet onboarding**
Wizard (one step per screen): upload CSV/XLSX → per-row validated preview (invalid/duplicated CNPJs highlighted) → confirm → bulk create + enqueue enrichment. Downloadable template. Acceptance: 100-row sheet with 5 errors imports 95 and lists the 5 with reasons.

---

## Phase 2 — Operations (M3, M4)

**T9 · Generic exception queue**
Migration `exception_queue`; screen with default view "Exceções abertas", filters by source/status collapsed; detail drawer rendering JSONB context in plain pt-BR and pre-filled suggestion; resolve/ignore actions recording resolution; wire T5 DLQs here. Acceptance: exception from a failed job appears; resolving records author and data; sidebar badge shows open count.

**T10 · Tasks + handoff**
Migration `tasks`; state machine in core (pure + tests); list (default "Minhas tarefas de hoje") and kanban; ≤5 visible columns, rest in drawer; completing a task with `handoff_to` creates the next department's task + in-app notification. Acceptance: invalid transition rejected in core and UI; handoff creates linked task.

**T11 · Recurring tasks**
Migration `recurring_tasks`; template CRUD (title, department, generation day, target: all/selection/by regime); `recurrences-monthly` cron generates the period's tasks idempotently. Acceptance: running the cron twice doesn't duplicate; a template for 200 companies generates 200 tasks with correct period.

---

## Phase 3 — Documents and panels (M5, M6)

**T12 · Document repository**
Migration `documents`; storage paths `firm/{id}/company/{id}/{period}/{department}/`; single and bulk upload (drag-and-drop, progress, hash dedup); hierarchical navigation + search by type/period/name; PDF/image/XML preview. Acceptance: 50-file upload lands organized under chosen company/period; duplicate flagged by hash.

**T13 · Dashboard and traffic-light panels**
Dashboard: max 6 `StatCard`s (open/overdue tasks, exceptions, deadlines, requests), each clicking through to its filtered list. General panel: one `DataList` row per company with `TrafficLight` + 2 facts. Individual panel: header with light; tabs consuming ready modules. Single parametrized panel componentization. Acceptance: aggregation rule verified by tests; general→individual navigation; UX checklist passed on all three.

---

## Phase 4 — Deadlines (M7)

**T14 · Monitored documents**
Migration `monitored_documents`; CRUD (kind from config taxonomy, due date, trigger_days defaulting from config, optional link to a repository document); status derived by pure core function. Acceptance: past/near/future/absent dates produce correct statuses.

**T15 · Deadline cron + alerts**
`deadlines-daily` cron: recompute statuses, emit alerts (in-app + e-mail via MessagingAdapter) on transitions to due_soon and overdue, auto-create task "Renovar {kind} — {company}" on overdue (config toggle). Feed panel traffic lights. Acceptance: simulated date rollover emits alerts and creates the task exactly once (idempotent).

---

## Phase 5 — Document requests (M8)

**T16 · Requests + public page**
Migrations `document_requests`, `document_request_events`; create request (ask for a document OR make one available); signed access token with configurable expiry; **public route** `/s/{token}`: view/download or upload (goes to triage), logging timestamp/IP/user-agent → transitions to viewed/received. Public page must be the simplest screen in the product: logo, one sentence, one action. Acceptance: opening the link changes status and logs the event; expired token shows expiry page; upload via link lands in repository with source `request`.

**T17 · Delivery and follow-up**
`MessagingAdapter` with `resend-email` (template with link) + copy-link button; follow-up screen with status timeline per request and resend; automatic reminder (cron `alerts`) for requests stuck in `sent` for N days (config). Acceptance: real e-mail in dev sandbox; reminder fires after N simulated days; state machine respected.

---

## Phase 6 — Mapping rules (M9)

**T18 · Rules engine**
Migration `mapping_rules`; resolution with precedence level 1 (specific) → level 2 (general) → no match = pending in `exception_queue` (source `rules`); pure core function `resolve(domain, key) → value | pending` with tests; resolving a pending offers "save as rule" (level and scope chosen). Acceptance: precedence chain covered by tests; resolved pending becomes a rule and auto-resolves the next identical case.

**T19 · CFOP case + rules screen**
Domain `cfop` (key: origin_cfop + optional supplier_cnpj; value: entry_cfop); rules CRUD with spreadsheet import; on NF-e XML upload (deterministic parser in core extracting CFOP/issuer — no LLM), apply resolution and write to `documents.metadata.entry_cfop` (XML untouched). Acceptance: test XML with a rule → metadata filled; without → pending carrying XML data; parser covered by tests with anonymized real XMLs.

---

## Phase 7 — AI triage (M10)

> Prerequisite: taxonomy and routing map validated with the partner (config from T4).

**T20 · Classification pipeline**
LangGraph graph in the worker (consumer of `triage`): extract_text (PDF/image via vision; XML → parser, LLM bypass) → classify_type (config taxonomy) → extract_cnpj → resolve_company → route (config map) → file | exception (confidence < threshold OR company not found, with pre-filled suggestion). Migration `classifications`; Langfuse instrumenting every node. Acceptance: 10 mixed test documents — clear ones classified, ambiguous ones in exceptions; all visible in Langfuse.

**T21 · Triage ↔ product integration**
Bulk "inbox" upload (no company/folder chosen) → enqueues triage → documents appear filed with "classificado por IA" badge and "corrigir" action (correction emits event + stores example in `classification_examples`); public-page uploads (T16) also flow through triage. Acceptance: full flow upload→classification→filing→correction; correction stored as example.

---

## Phase 8 — Export (M11)

**T22 · Export batches**
Migration `export_batches`; `ErpAdapter` with `manual-export` implementation; screen: filters (companies, period, types) → build batch (job on `export`): renames files by configurable convention, generates JSON/CSV manifest (list, hashes, applied CFOPs), zips and offers download; marks documents exported (re-export warns). Acceptance: 100-XML batch across 10 companies downloadable with correct manifest; files with pending CFOP excluded with notice.

---

## Phase 9 — Quality and deployment

**T23 · E2E critical flows**
Playwright: spreadsheet onboarding; upload→triage→exception→resolution; request→public link→viewed; deadline→overdue→task; XML→CFOP rule→exported batch. Acceptance: suite green on CI.

**T24 · Hardening**
RLS review table by table (PR checklist); rate limit and validation on the public route; sweep of worker queries asserting `firm_id` filter (custom lint or assertive grep on CI); error pages; Supabase Cloud backups confirmed (PITR on prod project). Acceptance: documented completed checklist.

**T25 · M Rocha deployment**
Provision prod instance (dedicated Supabase Cloud project + Railway + domain), documented env vars, initial config in `clients/mrocha`, production seed (firm, users, departments), deployment runbook in `clients/mrocha/RUNBOOK.md` (reproducible step-by-step for client #2). Acceptance: production environment working end to end with realistic test data.

---

## Backlog (DO NOT execute — reference)

AlterData connector (API/RPA) · SIEG/PlugStorage capture · WhatsApp Cloud API · inbound e-mail monitoring · A1 certificate vault · automatic CNDs (Infosimples/Dootax) · Integra Contador · city systems (Giss/São Vicente) · tax-calculation validation · full client portal · core extraction (week 1 of client #2).
