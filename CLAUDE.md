# CLAUDE.md — Hub Contábil · Base Product (v1)

Permanent instructions for Claude Code in this repository. Read before any task.

## What this project is

Base product for accounting firms: client panel, tasks with handoff, document repository, AI triage, deadline engine, document requests with read tracking, and mapping-rules engine. First client: Contabilidade M Rocha. Single-tenant deployment (one instance per firm), but **multi-tenant-ready schema and code**.

## Golden rules (non-negotiable)

1. **`firm_id` on every domain table and in every query.** Even with a single firm in the database. The worker uses the service role (bypasses RLS) and MUST explicitly filter by `firm_id` in all queries. No exceptions.
2. **Customization enters via adapter, config, or plugin — never by editing core.** No client-specific logic hardcoded (names, rules, CNPJs). Anything that varies per firm goes to config tables or adapter implementations.
3. **Every external integration sits behind an interface** (`XmlSourceAdapter`, `MessagingAdapter`, `ErpAdapter`, `CndProviderAdapter`), even if v1 ships only a manual/upload/no-op implementation.
4. **Authorized fiscal XML is immutable.** Never modify the file. Derived data (entry CFOP, classifications) is stored separately, referencing the document.
5. **AI never decides alone on ambiguous cases.** Confidence below threshold → exception queue with pre-filled suggestion. Human resolution feeds back examples/rules.
6. **Every automation dumps errors into the generic exception queue** — never blocks the batch, never fails silently.
7. **Every relevant action (human or robot) writes to `audit_events`**: who, what, when, JSONB context.
8. **Business values live in config, not code:** deadline triggers, status vocabularies, document taxonomy, AI confidence thresholds.
9. **One task at a time.** Execute only the requested task from TAREFAS.md, stop, and wait for review. Do not work ahead.
10. **No new dependencies without justification** (one line: why, alternative considered).
11. **CLAUDE.md, PLANEJAMENTO.md, and TAREFAS.md override any memory from previous sessions.** When a remembered fact conflicts with these documents, the documents win.

## Language rules

- **All code, database objects, comments, commits, and docs-in-code: English.** Tables, columns, variables, functions, types, file names — English only.
- **All UI copy: Brazilian Portuguese**, centralized in per-feature `copy.ts` modules (no pt-BR strings scattered in JSX). Domain terms users know stay pt-BR in the UI (CNPJ, CFOP, competência, certidão).
- Error messages shown to users: pt-BR. Logs and internal errors: English.

## Stack (fixed — do not propose changes)

- **Database/Auth/Storage/Realtime/Queues:** Supabase **Cloud only** (Postgres 15+, RLS, Storage, pgmq). No local Supabase, no Docker database, no other DB. Migrations applied to the cloud project via Supabase CLI (`supabase db push` / versioned migrations). Separate cloud projects for `dev` and `prod` per firm; connection strings via env vars only.
- **Backend/worker:** Node 20 + strict TypeScript, deployed on Railway (connects to Supabase Cloud via connection pooler).
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui.
- **AI:** LangGraph.js (triage pipeline) + Anthropic API; observability via Langfuse.
- **Transactional e-mail:** Resend (behind `MessagingAdapter`).
- **Validation:** Zod at every boundary (API routes, jobs, webhooks, parsing).
- **Tests:** Vitest (unit), Playwright (E2E for critical flows).

## UX principles (mandatory for every screen)

The #1 product risk is visual overload — previous projects failed here. Every screen must pass this checklist:

1. **One question per screen.** Each screen answers a single primary question ("what needs my attention?", "what is this company's status?"). If a screen answers three questions, split it.
2. **Progressive disclosure.** Lists show the minimum: status indicator + name + 1–2 key facts. Everything else lives in a detail drawer/page, one click away. Tables: **max 5 visible columns**; the rest goes to the drawer.
3. **Status is a visual language, never raw text or color alone.** One shared `<StatusBadge>` component everywhere: color + icon + short pt-BR label. Semantic tokens only (`success`, `warning`, `danger`, `neutral`, `muted`); color is reserved for status, never decoration.
4. **The traffic light (farol) is THE central visual metaphor.** One shared `<TrafficLight>` component, identical everywhere (panels, lists, dashboard). Aggregation rule: red if any overdue; yellow if any upcoming and none overdue; green if all ok; gray if no data.
5. **One primary action per screen**, visually dominant. Secondary actions live in menus/secondary buttons.
6. **Numbers before tables.** Dashboard = max 6 large stat cards, each clickable to the filtered list behind it. Never a dense table on the dashboard.
7. **Empty, loading, and error states are designed, not accidental.** Empty states say what the absence means and what to do ("Nenhuma exceção pendente — tudo em dia ✅"). Loading = skeletons, not spinners. Errors = plain pt-BR with a retry action.
8. **Default views over filters.** Every list opens on an opinionated default ("Minhas tarefas de hoje", "Exceções abertas"); filters exist but are collapsed.
9. **Human dates and quantities.** "Vence em 5 dias", "há 2 horas" (absolute date on hover). Badges with counts on nav items that represent queues (exceptions, requests).
10. **Plain pt-BR, zero tech jargon in UI.** No "JSONB", "payload", "queue", "tenant". A contadora who never saw the system must understand any screen in 5 seconds.
11. **Navigation: single sidebar, max 7 items**, icon + label, queues with count badges. No nested menus in v1.
12. **Forms: sensible defaults, advanced options collapsed**, inline validation with pt-BR messages.
13. Responsive: dashboard, tasks, and exception queue must work on mobile (the firm owner checks on the phone).

UI definition of done (every screen task): checklist 1–13 verified + empty/loading/error states implemented + `<StatusBadge>`/`<TrafficLight>` reused (never re-implemented).

## Repository structure (pnpm monorepo)

```
/apps
  /web          → Next.js (panels, internal screens, public client-access page)
  /worker       → Node: pgmq consumers, crons, AI pipeline
/packages
  /db           → SQL migrations, generated types, seed
  /core         → pure domain: entities, use cases, state machines (no IO)
  /adapters     → interfaces + implementations (manual-upload, resend, manual-export…)
  /config       → Zod schemas for per-firm configuration
  /ui           → shared design system: StatusBadge, TrafficLight, StatCard, EmptyState, DataList, DetailDrawer, tokens
/clients
  /mrocha       → ONLY config and overrides for this deployment (never core logic)
```

Allowed dependency direction: `clients/*` → `packages/*`. Never the reverse. `core` does not import from `adapters`. `web` consumes `ui` for all status/layout primitives.

## Conventions

- Migrations: versioned SQL in `packages/db/migrations`, idempotent, purpose comment at top, applied to Supabase Cloud via CLI.
- Table names: English snake_case (`firms`, `companies`, `tasks`, `exception_queue`, `mapping_rules`, `monitored_documents`, `document_requests`, `audit_events`, `export_batches`).
- Every table: `id uuid pk default gen_random_uuid()`, `firm_id uuid not null`, `created_at`, `updated_at`. Soft delete (`deleted_at`) only where specified.
- RLS enabled on EVERY domain table; policies by `firm_id` via JWT claim `firm_id`.
- State machines: valid transitions centralized in `packages/core` (pure function + tests). UI and worker call the same function.
- pgmq jobs: Zod-validated payload, exponential retry, DLQ → exception queue.
- Conventional commits in English (`feat: deadline engine — daily cron`).

## Definition of done (every task)

1. Migration applied to Supabase Cloud and typed; 2. RLS tested (cross-tenant query must fail); 3. Domain unit tests passing; 4. Functional screen meeting the UI definition of done; 5. Audit event emitted; 6. Lint + typecheck clean; 7. Short summary of what was done and how to test manually.

## What NOT to do in v1

- ERP connector (AlterData) — only `ErpAdapter` with a `manual-export` implementation exists.
- Automatic XML capture (SIEG/PlugStorage), WhatsApp, inbound e-mail monitoring, automatic CNDs, Integra Contador, certificate vault, full client portal, BI.
- Do not create abstractions for those beyond the specified adapter interfaces.
