# Hub Contábil — Base Product (v1)

Base product for accounting firms: client panel, tasks with handoff, document
repository, AI triage, deadline engine, document requests, and a mapping-rules
engine. Single-tenant deployment (one instance per firm) on a multi-tenant-ready
schema. First client: Contabilidade M Rocha.

See [`CLAUDE.md`](./CLAUDE.md) for the full product spec and engineering rules,
[`PLANEJAMENTO.md`](./PLANEJAMENTO.md) for the plan, and [`TAREFAS.md`](./TAREFAS.md)
for the task list.

## Stack

- **Database / Auth / Storage / Realtime / Queues:** Supabase **Cloud only**
  (Postgres 15+, RLS, Storage, pgmq). No local database, no Docker.
- **Worker:** Node 20 + strict TypeScript (Railway).
- **Web:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui.
- **Tooling:** pnpm workspaces + Turborepo, ESLint, Prettier, Vitest.

## Monorepo layout

```
apps/
  web/          Next.js — panels, internal screens, public client-access page
  worker/       Node — pgmq consumers, crons, AI pipeline
packages/
  db/           SQL migrations, generated types, seed (Supabase CLI)
  core/         pure domain: entities, use cases, state machines (no IO)
  adapters/     integration interfaces + implementations
  config/       Zod schemas for per-firm configuration
  ui/           shared design system (StatusBadge, TrafficLight, …)
clients/
  mrocha/       config and overrides for this deployment only
```

Dependency direction: `clients/* → packages/*`, never the reverse. `core` never
imports from `adapters`; `web` consumes `ui` for all status/layout primitives.

## Prerequisites

- **Node** ≥ 20
- **pnpm** 10.x (`corepack enable` picks up the version pinned in `package.json`)
- **Supabase CLI** (for migrations and type generation) — Supabase Cloud account
  with separate **dev** and **prod** projects per firm

## First-time setup

```bash
# 1. Install dependencies
pnpm install

# 2. Create env files from the templates and fill in the values (see below)
cp apps/web/.env.example     apps/web/.env.local
cp apps/worker/.env.example  apps/worker/.env

# 3. Link the Supabase CLI to the cloud dev project (one-time, per machine)
supabase login
supabase link --project-ref <dev-project-ref>

# 4. Run web + worker against Supabase Cloud
pnpm dev
```

`pnpm dev` starts both apps. The worker logs `connected to Supabase Cloud` once
the database probe succeeds; the web root page shows **"Conectado ao Supabase
Cloud"** when the URL/anon key are reachable.

## Environment variables

Env files are git-ignored (`.env*`); only the `*.env.example` templates are
tracked. Get the values from the Supabase dashboard → **Settings → API / Database**
of the **dev** project.

### `apps/web/.env.local`

| Variable                        | Description                                   |
| ------------------------------- | --------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Project API URL (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (client-side, RLS-protected)  |

### `apps/worker/.env`

| Variable                    | Description                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | Project API URL                                                                                                  |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — **secret**, server-only (bypasses RLS; the worker must still filter every query by `firm_id`) |
| `DATABASE_URL`              | Session pooler connection string (port 5432); URL-encode special characters in the password                      |

## Commands

Run from the repository root (Turborepo fans out to every workspace).

| Command          | What it does                                              |
| ---------------- | --------------------------------------------------------- |
| `pnpm dev`       | Run `web` + `worker` in watch mode against Supabase Cloud |
| `pnpm build`     | Build all apps/packages                                   |
| `pnpm lint`      | ESLint across the workspace                               |
| `pnpm typecheck` | `tsc --noEmit` across the workspace                       |
| `pnpm test`      | Vitest (unit) across packages that define tests           |
| `pnpm format`    | Prettier write across the repo                            |

### Database (Supabase CLI, via `packages/db`)

| Command                               | What it does                                         |
| ------------------------------------- | ---------------------------------------------------- |
| `pnpm --filter @hub/db db:new <name>` | Create a new versioned migration                     |
| `pnpm --filter @hub/db db:push`       | Apply pending migrations to the linked cloud project |
| `pnpm --filter @hub/db db:types`      | Generate TypeScript types from the linked schema     |

## Notes

- **Supabase Cloud only.** No local Supabase, no Docker database. Migrations are
  versioned SQL applied to the cloud project via the Supabase CLI.
- `firm_id` is required on every domain table and in every query — including the
  worker, which uses the service role and bypasses RLS.
- UI copy is Brazilian Portuguese (centralized per feature); code, comments, and
  commits are English.
