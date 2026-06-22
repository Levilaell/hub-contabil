# GO-LIVE.md — Roadmap até vender e operar

Estado atual: **código completo (T1–T25), testes verdes, tudo validado contra o ambiente
de DEV** (Supabase dev + worker, dados sintéticos). Produção nunca foi provisionada.
Sistema renomeado para "demo" genérico.

Legenda: 👤 = você/externo · 🤖 = a IA consegue fazer aqui no repo · ⏱️ esforço (P/M/G)

---

## ⚡ Prioridades imediatas (faça primeiro)

- [ ] 👤 **Rotacionar os 3 segredos expostos no chat** ⏱️P — `service_role` e senha do banco
      (Supabase → Settings) e a **chave Anthropic** (console Anthropic). Foram colados aqui;
      trate como vazados. Atualize os `.env` locais depois.
- [ ] 👤 **Colocar o código em git + GitHub** ⏱️P — hoje **não é um reppositório git**. É
      pré-requisito pra deploy (Vercel/Railway puxam de um repo) e pra ter histórico/CI.
      `git init` → commit → push para um repo privado.
- [ ] 👤 **`pnpm install`** na sua máquina e rodar `pnpm typecheck && pnpm lint && pnpm test`
      (com `packages/db/.env` apontando pro dev) ⏱️P — confirmar verde fora deste ambiente.

---

## Fase 1 — Deixar demonstrável (para começar a vender)

- [ ] 🤖 **Seed de dados de demo crível** ⏱️M — popular empresas, contatos, tarefas, prazos
      (alguns vencidos/amarelos pro farol acender), documentos, 1–2 exceções, uma solicitação
      e regras de CFOP. Hoje o ambiente está vazio; demo vazio não vende.
- [ ] 🤖 **Roteiro de demonstração** ⏱️P — passo a passo narrado dos fluxos (farol → exceção →
      triagem por IA → solicitação por link → exportação) pra você apresentar com segurança.
- [ ] 👤+🤖 **Validar a IA em documentos reais** ⏱️M — rodar 10–20 PDFs/imagens reais de notas/
      guias pela triagem para medir **precisão** e **custo por documento**. Você fornece os
      docs (anonimizados); eu monto o teste e a leitura dos resultados. É o maior risco de
      produto — você precisa saber o que mostrar e os limites antes de prometer.
- [ ] 👤 **Subir um ambiente de demo** ⏱️M — pode ser o próprio projeto dev + deploy do web
      (ver Fase 2); o importante é ter uma URL estável pra demonstrar.
- [ ] 👤 **Treinar os fluxos** ⏱️P — você navegando até fazer a demo "no automático".

---

## Fase 2 — Provisionar produção (seguir `clients/demo/RUNBOOK.md`)

Tudo 👤 (são suas contas/cartão/domínio); o runbook é o passo a passo reproduzível.

- [ ] **Supabase prod** ⏱️M — novo projeto, região São Paulo (sa-east-1), **ligar PITR/backups**.
- [ ] **Migrations + types + seed em prod** ⏱️P — `db:push`, `db:types`, seed com senha forte
      (não a default de dev).
- [ ] **Web na Vercel** ⏱️M — importar o repo, Root Directory `apps/web`, env
      `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`.
- [ ] **Worker em host persistente** ⏱️M — Railway/Render/Fly (NÃO Vercel — é processo sempre
      ligado; ver nota de hosting no RUNBOOK §5). Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
      `DATABASE_URL`, `APP_BASE_URL`, `CRON_ACCELERATED=false`, `ANTHROPIC_API_KEY`, `RESEND_*`.
- [ ] **Domínio + DNS + `APP_BASE_URL`** ⏱️P — subdomínio do app apontando pro web; `APP_BASE_URL`
      no worker = mesma URL (links públicos e e-mails de lembrete dependem disso).
- [ ] **Credenciais externas** ⏱️P — chave Anthropic de prod; **Resend** com domínio de envio
      verificado (`RESEND_API_KEY` + `RESEND_FROM`).
- [ ] **Smoke test de produção** ⏱️P — os 6 fluxos do RUNBOOK §7, manualmente, em prod.
- [ ] **Segredos só nos cofres** ⏱️P — nada de segredo em git/chat; só nos secret stores das plataformas.

---

## Fase 3 — Validar antes de confiar com dinheiro real

- [ ] 👤 **UAT com um contador de verdade** ⏱️G — alguém do ramo usando o fluxo real com
      documentos reais. Os testes automáticos não substituem isso.
- [ ] 👤+🤖 **Validar taxonomia/roteamento** ⏱️M — confirmar com o cliente a lista de tipos de
      documento e qual departamento cuida de cada um (é config, edito na hora).
- [ ] 👤+🤖 **Custo da IA em volume** ⏱️M — estimar custo/mês no volume do cliente (ex.: 5.000+
      notas) e ajustar o limiar de confiança / modelo (`aiModel`) conforme.
- [ ] 👤 **Drill de backup/restore** ⏱️P — testar um restore por PITR antes do go-live.
- [ ] 🤖 **CI (GitHub Actions)** ⏱️M — rodar typecheck/lint/test (e E2E) a cada push, com as
      credenciais de dev como secrets do CI. Hoje os testes só rodam local.
- [ ] 👤 **Decisão de observabilidade** ⏱️M — hoje só logs. Em prod, ao menos alerta de erro
      (Sentry, ou Langfuse pra rastrear a IA, se quiser o painel de custo/latência).
- [ ] 👤 **Rate limiter** ⏱️P — manter o web em **1 instância** (o limitador é em memória) OU
      migrar pra store compartilhado antes de escalar horizontalmente.

---

## Fase 4 — Onboarding de cada cliente que assinar (repetível — RUNBOOK §11)

- [ ] 👤 **Provisionar a instância do cliente** ⏱️M — projeto Supabase + hosts próprios (1 deploy
      por escritório; o schema já é multi-tenant-ready).
- [ ] 👤+🤖 **Importar a carteira de empresas dele** ⏱️M — via o wizard de planilha (já pronto).
- [ ] 👤+🤖 **Configurar firm config** ⏱️P — gatilhos de prazo, departamentos, taxonomia,
      convenção de nome do export, limiar de IA.
- [ ] 👤 **Treinar a equipe do cliente** ⏱️M.
- [ ] 👤 **Plano de suporte** ⏱️— canal, SLA, responsável.

---

## Fase 5 — Comercial / jurídico (paralelo — fora da alçada técnica, mas obrigatório antes de vender)

- [ ] 👤 **LGPD** — dados fiscais/PII: contrato de tratamento, onde os dados ficam, retenção.
- [ ] 👤 **Modelo de preço** — em especial como repassar/absorver o custo da IA.
- [ ] 👤 **Contrato / termos / SLA / suporte**.

---

## Lacunas e limitações conhecidas (transparência)

- **IA não validada em docs reais** — precisão/custo desconhecidos até a Fase 1/3.
- **Langfuse não ligado** — registro da IA vive no banco (`classifications` + `audit_events`);
  sem painel de custo/latência até alguém ligar (opcional).
- **Rate limiter em memória** — ok com web em 1 instância; rever se escalar.
- **Sem CI ainda** — testes existem e passam, mas não rodam automático a cada push.
- **Validado só em DEV** — produção é território novo até a Fase 2.

---

## O que eu (IA) consigo adiantar agora, sem você

1. **Seed de dados de demo** crível (Fase 1).
2. **Roteiro de demonstração** (Fase 1).
3. **Harness pra validar a IA** assim que você me passar documentos reais (Fase 1/3).
4. **CI (GitHub Actions)** com typecheck/lint/test (Fase 3).

Diga qual desses começo.
