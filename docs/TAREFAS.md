# TAREFAS.md — Hub Contábil · Base Product (v1)

Execution: **one task at a time**, in order. When done, stop and wait for review. Every task follows the "definition of done" in CLAUDE.md; every screen task additionally follows the **UI definition of done** (UX checklist 1–13).

---

## Phase 0 — Foundation

**T1 · Monorepo bootstrap**
pnpm monorepo with `apps/web` (Next.js + TS + Tailwind + shadcn/ui), `apps/worker` (Node + TS), `packages/db`, `packages/core`, `packages/adapters`, `packages/config`, `packages/ui`, `clients/demo`. Shared strict tsconfig, ESLint, Prettier, Vitest, dev scripts. Supabase CLI linked to the **cloud dev project** (no local DB). Acceptance: `pnpm dev` runs web and worker against Supabase Cloud; lint and typecheck clean; README with commands and env var list.

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
Provision prod instance (dedicated Supabase Cloud project + Railway + domain), documented env vars, initial config in `clients/demo`, production seed (firm, users, departments), deployment runbook in `clients/demo/RUNBOOK.md` (reproducible step-by-step for client #2). Acceptance: production environment working end to end with realistic test data.

---

## Phase 1.2 — Feedback round (2026-07-10)

> Source: Levi's manual test round of 10/07/2026; full code analysis delivered in-session. (Phase 1.1 — Paulo's spec — was executed outside this file; see `RELATORIO-FASE-1.1.md`.) Same execution rule: **one task at a time, stop for review after each**. Items marked **[decision]** are blocked on the open decisions listed at the end of this phase. Feedback items that needed only explanation (spreadsheet import matching, inbox meaning, CNPJ-based company association) generated no task.

**T26 · Request send integrity (bug)**
A request may only be marked `sent` when the e-mail was actually accepted by the provider. Today `rotate_request_token` flips status/`sent_at` and writes `sent` timeline+audit events before — and regardless of — the send; the copy-link action also marks `sent` with no e-mail involved; and with Resend unconfigured the no-op messaging adapter reports success, so the UI shows "E-mail enviado ✅" with nothing dispatched. Fix: split token rotation from sent-marking; mark `sent` only after adapter success; copy-link stops marking sent (audit `request.link_copied` instead) and the public page must accept opening a still-`requested` link; the send action returns a clear pt-BR error when messaging is not configured; the reminder sweep skips with a log when messaging is not configured. Also verify `RESEND_API_KEY`/`RESEND_FROM` on prod. Acceptance: Resend unset → "Enviar" shows a clear error and status stays `requested`; Resend send fails → status unchanged + error; Resend ok → status `sent` + timeline event; copying a link never produces a `sent` status/event; opening a copied never-sent link still logs `viewed`.

**T27 · AI must stay silent on human-handled tickets (bug)**
The reply gate (`decideSupportResponse`) never reads ticket state, so after escalation — or a human reply — the AI answers the client's next message and even flips the ticket out of `escalated`. Add a human-takeover gate in core (pure + tests): once a ticket is escalated or a human replies, the assistant does not answer until explicitly handed back; add a "Devolver para IA" action in /atendimento; keep the escalation ack on-transition-only. Acceptance: escalated ticket + new inbound → no AI reply and ticket stays escalated; after hand-back the AI answers again when it qualifies; hand-back audited.

**T28 · Task assignment + unassigned queue**
No automatic creation path sets an assignee and the UI cannot assign one afterwards; unassigned tasks are invisible in "Minhas" and have no dedicated view. Add: assignee editing in the task drawer (audited); an "unassigned" view/filter on the board with count; optional default assignee on recurring templates, applied by both generators (registration RPC and monthly cron). Acceptance: an auto-created task gets assigned from the drawer; "Sem responsável" view lists exactly the NULL-assignee open tasks; a template with default assignee generates assigned tasks.

**T29 · UX pack A — pt-BR document types, CNPJ search, "Inativa"**
(1) pt-BR label map for the document taxonomy, used everywhere a doc type is rendered (documents filters/list, correction select, exceptions); DB/config keys stay English. (2) Companies search also matches CNPJ digits, formatted or not. (3) Replace "Arquivar/Arquivada" wording with "Inativar/Inativa" (copy only; DB values unchanged). Acceptance: no raw taxonomy key visible anywhere in the UI; pasting a formatted CNPJ in the companies search finds the company; audit labels updated.

**T30 · UX pack B — confirmation dialogs + toasts**
Replace the 9 native `window.confirm` calls with a design-system confirmation dialog in `packages/ui`; add toast feedback for action success/error (new dependency, e.g. sonner — justification: no toast primitive exists in the stack and inline messages are missed after navigation). Acceptance: zero native confirm/alert in `apps/web`; destructive actions confirm via the shared dialog; mutating actions give toast feedback.

**T31 · Requests UX — create from the global page, contact picker, detail everywhere [decision]**
Add "Nova solicitação" (with company selector) to /solicitacoes; recipient becomes a picker listing the company's contacts with the department-routed suggestion pre-selected (free-text still allowed); request rows on the company tab open the same detail drawer as /solicitacoes (copy/resend/cancel — today the link shows once and rows only cancel); present the two kinds (`upload_request` × `document_offer`) as visibly distinct things. Blocked on decision #4 for the separation shape (default proposal: two sections within the tab). Acceptance: request creatable from /solicitacoes; picker shows contacts with the suggested one pre-selected; drawer reachable from both pages.

**T32 · Traceability — visible origin + consistent audit**
Task drawer gains an "Origem" block (created at + how: manual / recurring template / deadline renewal / handoff, with the linked entity); the tasks SELECT starts including the origin columns it already has (`recurring_task_id`, `source_task_id`, `monitored_document_id`); every automatic creation path audits per item (the monthly recurrence cron writes no audit today; registration writes only an aggregate company event); add missing pt-BR audit labels (`tasks.generated_on_registration`, `recurring_task.deactivated`); mark auto-imported partners (QSA) and enrichment-filled fields as such. Acceptance: any task shows when/how it was created; the audit screen shows labeled events for all creation paths.

**T33 · Atendimento — threshold presets, latency, department [decision]**
(1) Replace the two free numeric threshold inputs in /configuracoes with presets (Rigoroso / Equilibrado / Permissivo, custom kept under advanced). (2) Add `support.aiModel` so atendimento can use a fast model independent of triage (default Haiku), and evaluate lowering the worker 2 s poll delay. (3) Allow setting/correcting a ticket's department manually in /atendimento (today only the reception menu sets it). Department-based *visibility* restriction is blocked on decision #1. Acceptance: presets persist the right values; support replies use the configured model; ticket department editable and audited.

**T34 · Contacts — phone normalization, duplicates, linking**
Normalize phone on save (canonical digits form); warn about duplicate phones within the firm, including across companies (inbound matching is already format-tolerant, so duplicates silently win by ordering today); add "Vincular a empresa" on company-less tickets in /atendimento (creating/moving the contact — requires contact-move support in the DB layer, which currently forbids changing `company_id`). Acceptance: same number saved in different formats is detected; an unlinked ticket can be linked from /atendimento and the next message keeps the link; audit emitted.

**T35 · Documents module redesign (spec first) [decision]**
Largest package — write a 1-page spec for approval before implementing: deterministic triage guards (e.g. a PDF is never auto-filed as `nfe` without an NF-e access key; boleto/fatura heuristics), inbox resolution in place (associate company / fix type without jumping to /excecoes), visible origin per document (channel, sender, date), and the module structure review. Acceptance (spec stage): proposal approved by Levi; implementation tasks then appended here. **Spec approved 2026-07-14 → T36–T38 below.**

**T36 · Deterministic triage guards (approved spec, part 1)**
Pure rule in core, applied after AI classification and before the auto-file decision: (1) XML-native types (`nfe`, `nfce`, `cte`) suggested for a non-XML file cap confidence below the firm threshold → exception queue with the pre-filled suggestion (`nfse` exempt — city halls issue PDFs); (2) filename containing an unambiguous term of a conflicting type (`boleto`, `fatura`, `extrato`, `holerite`, `comprovante` — term list in firm config) → same. Exception context records the reason (`implausible_type`), rendered in pt-BR on the exceptions screen. Acceptance: a PDF classified as `nfe` with 0.95 confidence lands in exceptions, not the repository; core rule fully unit-tested; term list editable via config.

**T37 · Inbox resolution in place (approved spec, part 2)**
The documents inbox gains, per item, the same resolution form that lives in /excecoes today: company + type + department pre-filled from the AI suggestion, "Arquivar assim" and "Corrigir e arquivar" actions, reusing the `apply_triage_suggestion` RPC (corrections keep feeding few-shot). Resolving from the inbox resolves the matching exception and vice versa — one pending item, two places to resolve, zero duplicity. Rename "Caixa de entrada" → "Pendentes de arquivamento", now ALWAYS visible as the first section of the documents level-0 page, with count, even when empty. Acceptance: a pending document is filed from the inbox and its exception closes automatically (and the reverse); empty state explains the concept.

**T38 · Visible document origin (approved spec, part 3)**
Migration: `documents.inbound_message_id` (nullable FK). Worker links it when creating a document from an inbound message. Document drawer gains an "Origem" block: channel (WhatsApp/e-mail/upload/request link), sender when known (formatted, linking to the ticket), arrival date, and classification info (AI with confidence + model, deterministic, or human). List rows show "há 2 dias · WhatsApp" instead of technical paths. Acceptance: a WhatsApp-received document shows channel + sender in the drawer; upload/request documents show their origins; migration applied and typed.

**T39 · Deactivating a recurring template offers cancelling open instances (decision #2)**
When deactivating a template in /tarefas/recorrentes, the confirm dialog offers (checkbox, default on) cancelling the template's still-open instances (`pending`/`in_progress`, any period). Cancelled tasks get a terminal `cancelled` status (state machine in core + migration if the enum is a CHECK), are audited per task, and disappear from open views. Acceptance: deactivate with the option on → open instances cancelled + audited; with it off → instances stay; state machine tests updated.

**T40 · Filters open by default (decision #3)**
All list screens render their filters visible by default (no "Mais filtros"/collapsed disclosure); default views stay. UX rule #8 in CLAUDE.md updated to match the decision. Acceptance: /documentos, /tarefas, /excecoes, /solicitacoes, /atendimento and company tabs show filters without an extra click; no regression in mobile layout.

### Open decisions (Levi)
1. ~~Atendimento by department: real access restriction (RLS, like tasks) or filter-only?~~ **Decided 14/07: filter-only** (current behavior since T33). No access restriction.
2. ~~Deactivating a recurring template: also cancel the period's still-open instances, or keep them?~~ **Decided 14/07: yes, offer cancelling** → T39.
3. ~~List filters default-open vs. current UX rule #8?~~ **Decided 14/07: filters open by default** → T40 (CLAUDE.md rule #8 updated).
4. ~~How to separate "solicitações de documentos" from "envios de documentos" in the UI?~~ **Decided 11/07: a separate tab** ("Envios") on the company page — full separation for control over each flow. Implemented in T31.

---

## Backlog (DO NOT execute — reference)

AlterData connector (API/RPA) · SIEG/PlugStorage capture · A1 certificate vault · automatic CNDs (Infosimples/Dootax) · Integra Contador · city systems (Giss/São Vicente) · tax-calculation validation · full client portal · core extraction (week 1 of client #2).

> **Post-base addition (29/06/2026, outside T1–T25):** inbound document entry via **WhatsApp Cloud API** (Meta webhook) and **generic IMAP** (poll cron), plus **atendimento** (support tickets + AI assistant), were implemented as a vertical feature on top of the base and validated live against the cloud. They are no longer backlog. See `AULA-CODEBASE.md` §17, `HARDENING.md` §2/§2.1, and `ADAPTERS.md` §3/§4.
