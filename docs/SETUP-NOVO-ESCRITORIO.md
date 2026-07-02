# Setup de um novo escritório + permissões + o que ainda falta

> Referência prática: como provisionar uma nova firma, como funcionam os deploys
> (Vercel/Railway/Supabase), como funcionam os papéis e a gestão de usuários, e o que
> ainda não existe no produto. Complementa `clients/demo/RUNBOOK.md` (passo a passo
> operacional) e `docs/ONBOARDING.md`.

---

## 1. Modelo mental: **single-tenant por escritório**

Cada firma roda num **stack isolado próprio**. Não é "um sistema só e você adiciona uma
linha de firma" — é um conjunto separado de infraestrutura por cliente:

```
Escritório A → Supabase project A + web (Vercel) + worker (Railway) + domínio A
Escritório B → Supabase project B + web (Vercel) + worker (Railway) + domínio B
```

O **código** é multi-tenant-ready (`firm_id` em toda tabela e query), mas o **deploy é
single-tenant**: isolamento no nível de infraestrutura → residência de dados em SP,
PITR/backup por firma, raio de dano contido, sem chance de vazar dado entre clientes.

---

## 2. Dúvida frequente: para cada cliente é um novo deploy na Vercel? É o repositório inteiro?

**Sim, um novo deploy por cliente — mas do MESMO repositório, sem fork.**

- Você **não** copia/forka o repo por cliente. Todos os deploys apontam para o **mesmo
  repositório git**. O que muda entre clientes são as **variáveis de ambiente** (qual
  projeto Supabase, quais credenciais) — o código é idêntico.
- Por cliente você cria **um projeto Vercel novo** (para o `web`) e **um serviço Railway
  novo** (para o `worker`), ambos conectados ao mesmo repo, cada um com seu conjunto de
  env vars apontando para o Supabase daquele cliente.

Sobre "o repositório inteiro": é um **monorepo**. O deploy usa só a parte relevante:

| Deploy | Onde | Root / comando | O que publica |
| --- | --- | --- | --- |
| **web** | Vercel | Root Directory = `apps/web` | Só o app Next.js. O Vercel instala o workspace inteiro (precisa de `packages/*` como dependências), mas **builda e serve apenas `apps/web`**. |
| **worker** | Railway | roda `apps/worker` (`start:prod`) | O processo Node de filas/crons/IA. Não vai para a Vercel (é um processo longo, não serverless). |

Ou seja: **1 repositório → 2 deploys por cliente** (web na Vercel + worker na Railway),
para N clientes = N pares de deploys, todos do mesmo código, diferindo só em
env/Supabase. Um push no repo pode redeployar todos (cada projeto Vercel/Railway observa
o mesmo repo) — versione com cuidado ou use branches por ambiente.

> **E se um dia quiser multi-tenant de verdade** (várias firmas num único Supabase/deploy)?
> O schema já suporta (RLS isola por `firm_id` do JWT). Bastaria semear várias firmas e
> setar o `firm_id` certo por usuário. O único ponto que hoje assume single-tenant é a
> **resolução de firma do webhook do WhatsApp** (`FIRM_ID` ou a única linha de `firms`) —
> precisaria mapear `phone_number_id → firm`. Ver §5 ("o que falta").

---

## 3. Passo a passo de um novo escritório

Resumo do `clients/demo/RUNBOOK.md` (lá tem o detalhe e as tabelas de env vars).

1. **Novo projeto Supabase** — região `sa-east-1` (SP), senha forte, **PITR ligado**.
   Copiar `Project URL`, `anon key`, `service_role key` (secreto) e o `DATABASE_URL`
   (session pooler, porta 5432, senha URL-encoded).
2. **Aplicar o schema** (migrations idempotentes e versionadas):
   ```bash
   supabase link --project-ref <ref-prod>
   pnpm --filter @hub/db db:push      # tabelas, RLS, bucket Storage, filas pgmq, RPCs
   pnpm --filter @hub/db db:types
   ```
   (Sem a CLI: `node apps/worker/apply-pending-migrations.mjs` com `DATABASE_URL` de prod.)
3. **Seed da firma + usuários** — em `packages/db/src/seed.ts`, trocar `FIRM_ID` (novo
   UUID), `FIRM_NAME` e os e-mails; rodar com senha forte:
   ```bash
   SEED_PASSWORD='<senha-prod>' pnpm --filter @hub/db seed
   ```
   Depois trocar por e-mails/senhas reais no **Supabase Auth** (ou usar a nova tela de
   Usuários — §4 — para criar o resto da equipe).
4. **Config inicial** — aplicar `clients/<firma>/config.json` em `firms.config` (pela tela
   Configurações ou um `update`). O que faltar cai nos defaults de `packages/config`.
   ⚠️ Validar **taxonomia + roteamento** com o parceiro antes de confiar na triagem por IA.
5. **Credenciais externas** (cada uma atrás de um adapter → sem a chave, vira no-op):
   `ANTHROPIC_API_KEY` (IA), `RESEND_*` (e-mail), `WHATSAPP_*` (entrada/atendimento — as
   **mesmas quatro em web e worker**), `IMAP_*` (e-mail de entrada, só no worker).
6. **Provisionar compute** — `web` na Vercel (Root `apps/web`) + `worker` na Railway
   (`start:prod`, persistente). Env vars por serviço no RUNBOOK §5.
7. **Domínio + `APP_BASE_URL`** — subdomínio da firma apontando para o web; `APP_BASE_URL`
   no worker igual à URL (para links `/s/{token}` e e-mails de lembrete).
8. **Smoke test** dos fluxos críticos (RUNBOOK §7).

Para o **cliente nº 2**: repetir §1–§7 com projeto/UUID/domínio novos — **sem editar
`core`**; só config em `clients/<firma>/`.

---

## 4. Permissões dentro do mesmo escritório

Dois níveis, ambos carimbados no **`app_metadata` do Supabase Auth** (que a Supabase
embute no JWT — é o que a RLS lê):

### Nível 1 — Papel (`role`): `owner` | `manager` | `staff`
- `owner` e `manager` → `is_firm_manager()` = **veem/fazem tudo** na firma.
- `staff` → **restrito ao(s) departamento(s)** atribuído(s).

Onde a RLS usa (`packages/db/supabase/migrations/..._tasks_and_notifications.sql`):
```sql
is_firm_manager()  -- role ∈ (owner, manager), lido do JWT
using ( firm_id = current_firm_id()
        and ( is_firm_manager() or department = any(auth_user_departments()) ) )
```
Editar config exige `role ∈ (owner, manager)`; criar template recorrente exige gestor.

### Nível 2 — Departamentos (tabela `user_departments`)
Junção `(firm_id, user_id, department)`. Um `staff` só enxerga tarefas/handoffs do(s)
departamento(s) listado(s) ali. `owner`/`manager` não precisam de linhas (veem tudo). Os
nomes de departamento saem de `firms.config` (`departments`).

### Onde um usuário "existe" (3 lugares, mantidos coerentes)
1. `auth.users.app_metadata` → `{ firm_id, role }` — dirige o JWT/RLS.
2. `public.users` → perfil (email, full_name, role) para exibição/joins.
3. `public.user_departments` → escopo de setor (para `staff`).

`public.users.id` referencia `auth.users(id) on delete cascade`, e `user_departments`
referencia `users(id) on delete cascade` → **apagar o auth user limpa perfil +
departamentos automaticamente**.

> Trocar papel/departamento só passa a valer quando o usuário **refaz login** (ou o token
> renova) — as claims vêm do JWT.

### Como criar/gerenciar usuários (agora com tela própria)
**Configurações → Usuários e permissões** (`/configuracoes/usuarios`), visível para
titular/gestor. Permite:
- **Criar usuário** (nome, e-mail, papel, e departamentos quando `staff`). Gera uma
  **senha temporária** exibida uma vez (não há convite por e-mail ainda — repasse por
  canal seguro).
- **Trocar papel** e **atribuir departamentos** (drawer por usuário).
- **Remover** do escritório (apaga o auth user → cascata).

Guardas de segurança (as ações usam o service role, então revalidam tudo no servidor):
firma fixada pelo JWT do chamador; só titular cria/promove titular; ninguém remove a si
mesmo; o **último titular** é protegido; toda mudança grava em `audit_events`.
Implementação: `apps/web/src/app/(app)/configuracoes/usuarios/` + `packages/db/src/users.ts`
(leitura via RLS) + `apps/web/src/lib/supabase/admin.ts` (Admin API para as escritas).

---

## 5. O que ainda falta (como faltava a gestão de usuários)

**Já construídos** (eram lacunas, agora existem): **gestão de usuários** (Configurações →
Usuários), **edição de config avançada** (Configurações → Configuração avançada:
departamentos, taxonomia, roteamento) e **tela de auditoria** (Configurações → Auditoria).

Coisas **pequenas e construíveis** que ainda faltam (mesmo estilo, não são backlog).
_Revisado em 01/07/2026 por varredura do código._

| Falta | Situação hoje | Impacto |
| --- | --- | --- |
| **Convite / recuperação de senha** | Usuário novo recebe senha temporária manual; não há "esqueci a senha" nem convite por e-mail (magic link) | Onboarding de equipe é manual; depende de configurar SMTP/Resend no Auth |
| **Login: 2FA / SSO** | Login é só e-mail + senha (Supabase Auth); sem MFA nem SSO | Suficiente para v1; enhancement de segurança para escritórios maiores |
| **Fila `notifications` (pgmq) é stub** | O handler só loga (`[notifications] stub`); nada enfileira nela. Notificações in-app (sino) e e-mails já funcionam **direto pelos jobs** (tabela `notifications` + `MessagingAdapter`) | A fila genérica fica reservada/inerte — sem impacto hoje, mas é infra pela metade |
| **Rate limiter compartilhado** | O limitador da rota pública `/s/[token]` é **em memória por instância** | Mantenha o `web` em 1 instância; para escalar horizontal, mover para store compartilhado (Redis/pg) |
| **Observabilidade da IA (Langfuse)** | Previsto, **não plugado** ainda | Sem tracing das chamadas de IA em prod |
| **Multi-tenant real** | Webhook do WhatsApp resolve firma por `FIRM_ID`/única linha | Para várias firmas num só projeto, mapear `phone_number_id → firm` |

**Roadmap intencional (backlog documentado — fora do escopo v1, não são "bugs"):** conector
ERP AlterData, captura automática de XML (SIEG/PlugStorage), CNDs automáticas
(Infosimples/Dootax), Integra Contador, sistemas de prefeitura, cofre de certificado A1,
portal completo do cliente, BI, conciliação bancária. Ver `docs/ADAPTERS.md`,
`docs/TAREFAS.md` (Backlog) e `docs/guias/`.

---

## 6. Ponteiros rápidos

- Deploy passo a passo: `clients/demo/RUNBOOK.md`
- Modelo de customização (3 botões: infra, integrações, config): `docs/ONBOARDING.md`
- Segurança/hardening: `docs/HARDENING.md`
- Guia de teste manual (usuário real): `docs/GUIA-TESTE-MANUAL.md`
- Aula da arquitetura: `docs/AULA-CODEBASE.md`
