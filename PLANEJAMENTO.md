# PLANEJAMENTO.md — Hub Contábil · Base Product (v1)

## 1. Vision

Base product for accounting firms, deployed single-tenant (one instance per firm), with multi-tenant-ready code. The base is the visible destination of automations: registry, tasks, documents, panels, queues, deadlines, document requests, and rules. External integrations (ERP, XML capture, WhatsApp, CND, eCAC, city systems) are **per-client adapters** — out of this v1, with interfaces prepared.

First client: Contabilidade M Rocha (250–500 companies, 5,000+ invoices/month, AlterData, SIEG as source, Giss Online/São Vicente city systems). In v1 the ERP bridge is manual: input via upload, output via **organized export batches** ready for manual import into AlterData.

**Product-defining constraint:** the UI must be radically simple and visual. Previous projects failed by cramming information. The UX principles in CLAUDE.md are part of the spec, not a style suggestion. Code 100% in English; UI copy in pt-BR. Database: Supabase Cloud only.

## 2. v1 scope (modules)

| # | Module | Summary |
|---|---|---|
| M1 | Company registry | CNPJ as key; enrichment via public API; contacts, tax regime, departments; spreadsheet onboarding |
| M2 | Users, roles, audit | Owner/manager/staff per department; `audit_events` records every action |
| M3 | Task manager | Per company/period; monthly recurrence; status; automatic handoff between departments |
| M4 | Exception queue | Single generic queue for errors from any automation, with context and resolution action |
| M5 | Document repository | Hierarchical storage firm → company → period/department; search; preview |
| M6 | Panels | Macro dashboard; general panel with per-company traffic light; individual panel |
| M7 | Deadline engine | Monitored documents with due dates; daily cron; configurable triggers; alerts |
| M8 | Document requests | State machine requested→sent→viewed→received; public client-access page (proof of viewing); e-mail/link delivery |
| M9 | Mapping-rules engine | Generic engine with 3-level precedence + pending queue; first case: CFOP |
| M10 | AI triage | Type classification + CNPJ extraction + routing, over uploads; ambiguous → exception queue |
| M11 | Export batches | XMLs/documents packaged per company/period, renamed, with manifest, ready for ERP import |

## 3. Architecture

```
[Next.js web] ──┐
                ├── Supabase CLOUD (Postgres + RLS + Auth + Storage + pgmq)
[Node worker] ──┘         │  (no local DB; dev and prod are separate cloud projects)
   │  crons: deadlines, recurrences, alerts
   │  consumers: triage (LangGraph→Anthropic), export, e-mail
   └── Langfuse (AI observability)
[Public client page] → web (public route with signed token)
```

- Web uses anon key + RLS (`supabase-js`). Worker uses service role + **mandatory `firm_id` filter** (`postgres.js` over the connection pooler; no ORM). Database types generated via Supabase CLI.
- pgmq queues: `triage`, `export`, `notifications`. Each DLQ feeds the exception queue.
- Crons (worker): `deadlines-daily` (06:00), `recurrences-monthly` (day 1), `alerts` (hourly).
- Deployment: **one Railway project per firm with two services (`web` and `worker`)**, both pointing to that firm's Supabase Cloud project — single platform keeps the T25 runbook simple.

## 4. Data model (core) — all tables prefixed by `firm_id`, RLS on

- `firms` (id, name, config JSONB — triggers, vocabularies, thresholds, taxonomy, routing map)
- `users` (auth.users + profile: role) + `user_departments` (junction user ↔ department; staff access is scoped to their departments, owner/manager have access to all)
- `companies` (cnpj UNIQUE per firm, legal_name, tax_regime, enrichment_data JSONB, status)
- `contacts` (company_id, name, email, phone, preferred_channel)
- `documents` (company_id, period, department, doc_type, storage_path, source [upload|triage|request], hash, metadata JSONB)
- `tasks` (company_id, period, department, title, status, assignee_id, recurring_task_id?, handoff_to?)
- `recurring_tasks` (task template: title, department, generation_day, target rule, active)
- `exception_queue` (source [triage|export|rules|deadlines|requests], context JSONB, suggestion JSONB, status [open|resolved|ignored], resolution JSONB)
- `monitored_documents` (company_id, doc_kind [federal CND, license…], due_date, trigger_days, status [valid|due_soon|overdue|needs_update|no_date], document_id?)
- `document_requests` (company_id, description, status [requested|sent|viewed|received], access_token, channel) + child `document_request_events` (timestamp/IP/user-agent)
- `mapping_rules` (domain ['cfop'…], level [1 specific|2 general], key JSONB, value JSONB, origin [manual|resolution]) — "level 3" is not a rule, it is the pending queue
- `classifications` (document_id, suggested_type, extracted_cnpj, confidence, model, decided_by [ai|human]) + `classification_examples`
- `export_batches` (company_id?, period, filters JSONB, manifest JSONB, zip storage_path, status)
- `audit_events` (actor [user_id|'robot'], action, entity, entity_id, context JSONB)

Indexes on (`firm_id`, main FK).

## 5. State machines (centralized in packages/core)

- **Task:** pending → in_progress → done (→ handoff creates/notifies the next) | canceled
- **Document request:** requested → sent → viewed → received (viewed = open on public page with token; logs timestamp/IP)
- **Monitored document:** no_date | valid → due_soon (due_date − trigger) → overdue; needs_update on exception
- **Triage item:** received → classified (confidence ≥ threshold) → routed/filed | → exception (low confidence or company not found)
- **Export batch:** building → ready → downloaded

## 6. AI triage (M10)

LangGraph pipeline: `extract_text` (PDF/image → model vision; XML → deterministic parser, NO LLM) → `classify_type` (closed taxonomy) → `extract_cnpj` → `resolve_company` (lookup) → `route` (type→department map) → `file` or `exception`.

**Initial taxonomy (config — VALIDATE with the partner before Phase 7):** nfe, nfce, nfse, cte, das, darf, gare_gnre, iss_slip, fgts_inss_slip, boleto, bank_statement, card_statement, payslip, certificate (CND), license, articles_of_incorporation, power_of_attorney, payment_receipt, spreadsheet, other.

**Routing map (config):** invoices/tax slips → fiscal; statements → accounting; payroll → hr; certificates/licenses/PoA → compliance; other/low confidence → exception.

Confidence threshold in config (default 0.85). Every decision logged in `classifications` + Langfuse. Human resolution of an exception stores an example for future few-shot.

## 7. Screens (each must pass the UX checklist in CLAUDE.md)

1. Dashboard — max 6 stat cards (open/overdue tasks, exceptions, deadlines by status, requests), each clickable to its filtered list
2. General client panel — one row per company: traffic light + name + 2 facts; click → individual panel
3. Individual company panel — header with traffic light; tabs: tasks, documents, deadlines, requests, rules
4. Tasks — default view "Minhas tarefas de hoje"; list/kanban; visible handoff
5. Exception queue — default "Exceções abertas"; AI suggestion pre-filled; one-click resolve
6. Document repository — hierarchical navigation + search + bulk drag-and-drop upload
7. Deadlines — list with traffic-light grouping + simple create form
8. Document requests — create, follow status timeline, resend
9. Mapping rules — CRUD + pending queue
10. Export batches — build, download, manifest
11. Onboarding — import spreadsheet → preview → enrich → confirm (wizard, one step per screen)
12. **Public page** for the end client (signed token): view/download requested document or upload a file — logs the view
13. Firm settings — triggers, taxonomy, departments, users

## 8. Adapters (interfaces in v1; v1 implementations in parentheses)

- `ErpAdapter` (v1: `manual-export` — builds .zip batch + manifest)
- `XmlSourceAdapter` (v1: `manual-upload`)
- `MessagingAdapter` (v1: `resend-email` + `copyable-link`; future: whatsapp-cloud-api)
- `CnpjEnrichmentAdapter` (v1: BrasilAPI with throttling, ReceitaWS fallback)
- `CndProviderAdapter` (v1: `noop` — interface only)

## 9. Recorded decisions

- Single-tenant per deploy; multi-tenant-ready schema (`firm_id` everywhere) — deploy choice is reversible, schema choice is not.
- Supabase Cloud only; separate cloud projects for dev and prod; no local database.
- Code/db/comments in English; UI copy in pt-BR, centralized per feature.
- Public access page = proof of viewing (independent from channel read receipts).
- XML never goes through an LLM; deterministic parser.
- Shared `packages/ui` design system; `StatusBadge` and `TrafficLight` are the only status representations allowed.
- Extraction pact: week 1 of client #2 = extract commons into core before any new feature.

## 10. Out of scope (v1)

AlterData connector (API/RPA), SIEG/PlugStorage, WhatsApp Cloud API, inbound e-mail monitoring, automatic CNDs, Integra Contador, city systems, A1 certificate vault, tax-calculation validation, full client portal, BI, consolidated multi-tenant.
