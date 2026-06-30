# ONBOARDING.md — Modelo de Setup e Onboarding por Escritório

**O que este documento responde:** "tenho o core pronto; quando um escritório novo entra, _o que_ eu provisiono, _onde_ as customizações dele moram, e como deploy/domínio/integrações se encaixam?"

Este é o documento **conceitual** (o _porquê_ e o _quê_). Os dois companheiros operacionais:

- **`clients/demo/RUNBOOK.md`** — o passo-a-passo reproduzível de um deploy (o _como exato_, comando a comando). O §11 dele já parametriza para o cliente #2.
- **`docs/ADAPTERS.md`** — o catálogo de cada integração (viabilidade, custo, esforço, pré-requisitos).

Se você quer executar um deploy, vá no RUNBOOK. Se você quer **entender o modelo** antes de executar, leia aqui.

---

## 1. O modelo em uma frase

> **Um produto (o core), um deploy isolado por escritório.** O mesmo código roda para todos; o que muda por escritório são **três knobs** (infra, credenciais/integrações, configuração de negócio) — nunca o código.

Isto é a arquitetura hexagonal aplicada na prática:

- O **core** (`packages/core`, `packages/db`, `apps/*`) é o produto. Não tem nada de cliente dentro: sem CNPJ, sem nome de firma, sem regra hardcoded (golden rule #2).
- As **integrações externas** ficam atrás de interfaces (`packages/adapters`): `XmlSourceAdapter`, `MessagingAdapter`, `ErpAdapter`, `CndProviderAdapter`, etc. O core conversa com a _porta_; quem entra é o _adaptador_ que aquele escritório contratou.
- A **configuração de negócio** (prazos, vocabulários, taxonomia, thresholds) vive em `firms.config` (JSONB), validada por `packages/config` — nunca em código (golden rule #8).

"Single-tenant deployment, multi-tenant-ready schema" significa: **cada escritório ganha sua própria pilha isolada** (banco + deploy próprios), mas o schema carrega `firm_id` em toda tabela e toda query mesmo assim. Isolar por infra é a garantia de privacidade hoje; o `firm_id` é o que permite, no futuro, juntar firmas num só banco sem reescrever nada.

```
                 ┌─────────────────────────────────────────┐
                 │  MESMO CÓDIGO (core + adapters + config) │
                 └─────────────────────────────────────────┘
                        │                         │
        ┌───────────────┴───────────┐ ┌───────────┴───────────────┐
        │   Deploy do Escritório A   │ │   Deploy do Escritório B   │
        │  Supabase prj A            │ │  Supabase prj B            │
        │  Vercel (web) + Railway    │ │  Vercel (web) + Railway    │
        │  env A  →  adapters A      │ │  env B  →  adapters B      │
        │  firms.config A            │ │  firms.config B            │
        │  app.escritorioA.com.br    │ │  app.escritorioB.com.br    │
        └────────────────────────────┘ └────────────────────────────┘
```

---

## 2. Os três knobs de customização por escritório

Toda diferença entre dois escritórios cai em **exatamente um** destes três lugares. Saber em qual é metade do entendimento.

### Knob 1 — Infraestrutura (onde roda)

Cada escritório tem sua própria pilha isolada:

| Peça | Tecnologia | Papel | Por escritório? |
| --- | --- | --- | --- |
| **Banco / Auth / Storage / Filas** | Supabase Cloud (projeto próprio) | Postgres + RLS + bucket `documents` + pgmq | **Sim — 1 projeto** (prod; + 1 dev se quiser) |
| **Web** | Next.js na **Vercel** | painéis, telas internas, página pública `/s/{token}` | **Sim — 1 projeto Vercel** |
| **Worker** | Node (tsx) no **Railway** | consumidores de fila, crons, pipeline de IA | **Sim — 1 serviço Railway** |

Por que dois deployáveis e não um? O **worker é um processo longo** (poller + cron) que não cabe no modelo serverless da Vercel como está. Daí o split recomendado: **web → Vercel, worker → host persistente (Railway)**. Ambos apontam para o **mesmo projeto Supabase** daquele escritório. (Detalhe e alternativa all-Vercel no RUNBOOK §5.)

### Knob 2 — Credenciais e integrações (o que está ligado)

**Esta é a parte que você perguntou** ("setup das integrações de cada escritório"). A regra-chave:

> **Qual implementação de adapter fica ativa é decidido pela _presença das variáveis de ambiente_ daquele escritório — em runtime, sem mudar código.**

As _factories_ em `packages/adapters` olham o `env` e escolhem a implementação. Se a credencial existe, a integração real liga; se não existe, cai num **fallback que não quebra nada**:

| Integração | Porta (interface) | Liga com… | Sem credencial (fallback v1) |
| --- | --- | --- | --- |
| **E-mail** (Resend) | `MessagingAdapter` | `RESEND_API_KEY` + `RESEND_FROM` | `NoopMessagingAdapter` — link continua funcionando por copiar/colar |
| **Triagem por IA** | `ClassificationAdapter` | `ANTHROPIC_API_KEY` | `HeuristicClassificationAdapter` — manda o que não é determinístico pra fila de exceções |
| **Extração de NF** | `XmlSourceAdapter` | (v1) — | `manual-upload` — upload na UI (única implementação hoje) |
| **Ponte com ERP** | `ErpAdapter` | (v1) — | `manual-export` — lote `.zip` + manifesto |
| **Entrada por WhatsApp** | `WhatsappAdapter` | `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_APP_SECRET` (+ `WHATSAPP_VERIFY_TOKEN`) | `NoopWhatsappAdapter` — entrada de docs só por upload/solicitação |
| **Entrada por e-mail (IMAP)** | `ImapInboundAdapter` | `IMAP_HOST` + `IMAP_USER` + `IMAP_PASSWORD` | `NoopImapInboundAdapter` — cron de polling não é agendado |
| **Atendimento por IA** | `SupportAssistantAdapter` | `ANTHROPIC_API_KEY` (+ `support.autoReply` na config) | `HeuristicSupportAssistant` — escala toda dúvida para humano |

Trecho real do mecanismo (mesma forma para todas):

```ts
// packages/adapters/src/messaging.ts
export function createMessagingAdapter(env = process.env): MessagingAdapter {
  if (env.RESEND_API_KEY && env.RESEND_FROM) {
    return new ResendMessagingAdapter({ apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM });
  }
  return new NoopMessagingAdapter(); // degrada, nunca falha
}
```

Consequência prática para o onboarding: **"configurar a integração X do escritório Y" = setar as env vars de X no deploy (Vercel/Railway) do escritório Y.** Nada de branch, nada de build especial. Ligar Resend depois do go-live é só adicionar duas variáveis e redeploy.

> **Nota de arquitetura (importante).** Hoje a seleção do adapter lê `process.env` — ou seja, é **por instância**. Isso é _exatamente certo_ no modelo single-tenant-por-escritório (1 instância = 1 firma = 1 conjunto de env). Se um dia você rodar **várias firmas numa só instância**, a seleção precisa migrar de `process.env` para `firms.config` (ex.: um campo `integrations` por firma). É um passo conhecido e isolado — não um redesenho.

### Knob 3 — Configuração de negócio (como se comporta)

Valores que variam por escritório mas **não** são segredo nem infra: dias de alerta de prazo, vocabulário de departamentos, taxonomia de documentos, threshold de confiança da IA, modelo Anthropic, validade do link de solicitação, etc. Tudo isso mora em **uma linha**: `firms.config` (JSONB), validada por `firmConfigSchema` (`packages/config/src/firm-config.ts`).

Propriedades que tornam isso seguro:

- **Todo campo tem default.** Uma firma recém-semeada com `config = '{}'` já parseia para uma config completa e válida. Você só precisa preencher o que diverge do padrão.
- **Editável sem deploy.** Muda na tela de Configurações (ou um `update` pontual). Sem release.
- O template inicial de um escritório vive em `clients/<firm>/config.json` — _override parcial_, o resto cai nos defaults. Veja `clients/demo/config.json`.

```jsonc
// clients/demo/config.json — só o que diverge do default
{
  "deadlineTriggers": { "defaultDays": 30, "autoRenewalTask": true, "renewalDepartment": "compliance" },
  "requestTokenExpiryDays": 7,
  "aiThreshold": 0.85,
  "aiModel": "claude-opus-4-8"
}
```

> ⚠️ **Taxonomia de documentos e routing map são config, mas valide com o sócio do escritório antes de confiar na triagem por IA.** São ajustáveis nas Configurações, sem deploy.

---

## 3. Resumo: o que é fixo vs. o que varia por escritório

| | Fixo (o produto) | Varia por escritório |
| --- | --- | --- |
| **Código** | `packages/*`, `apps/*` — idêntico para todos | nada (golden rule #2) |
| **Infra** | a topologia (Supabase + Vercel + Railway) | os _projetos_ (1 de cada por firma) e suas URLs |
| **Integrações** | as interfaces e as factories | **quais env vars existem** → quais adapters ligam |
| **Negócio** | o schema de config e seus defaults | `firms.config` daquele escritório |
| **Identidade** | — | domínio (`app.<firma>`), `FIRM_ID`, usuários, nome |

Mapa mental de onde mexer:

- "Mudar comportamento de _todos_ os escritórios" → código (`packages/*`), release.
- "Ligar/desligar uma integração de _um_ escritório" → env vars do deploy dele (Knob 2).
- "Ajustar uma regra de negócio de _um_ escritório" → `firms.config` dele, na tela de Config (Knob 3).

---

## 4. O ciclo de onboarding de um escritório novo

Sequência conceitual (o passo-a-passo com comandos está no RUNBOOK §1–§7; o §11 é o checklist específico de "cliente #2"). Nenhum passo edita código do core.

```
1. PROVISIONAR INFRA   →  Supabase prj (região sa-east-1, PITR on) + projetos Vercel/Railway
2. APLICAR SCHEMA      →  migrations (idempotentes) → bucket `documents` + RLS criados junto
3. SEMEAR A FIRMA      →  seed: 1 firma (FIRM_ID novo) + usuários por papel  →  trocar p/ e-mails reais
4. CONFIG DE NEGÓCIO   →  aplicar clients/<firma>/config.json em firms.config (resto = defaults)
5. LIGAR INTEGRAÇÕES   →  setar env vars (Knob 2): Resend, Anthropic, WhatsApp Cloud, IMAP, e (fase 2) SIEG/PlugStorage…
   (WhatsApp também exige apontar o webhook do Meta → §6)
6. DOMÍNIO & DNS       →  apontar app.<firma> → web (Vercel); setar APP_BASE_URL no worker
7. SMOKE TEST          →  rodar os fluxos críticos ponta a ponta (espelham os E2E)
8. GO-LIVE             →  checklist de segurança (HARDENING.md) + trocar segredos placeholder
```

O que cada fase _significa_ no modelo:

- **1–2 (infra + schema):** você está clonando a topologia fixa para um novo "espaço" isolado. O schema é o mesmo arquivo de migrations de todos; nada de cliente aqui.
- **3 (semear):** o primeiro dado específico do escritório nasce — o `FIRM_ID` que vai carimbar toda linha daqui pra frente, e os usuários. No RUNBOOK isso usa um `FIRM_ID`/e-mails do Demo; para um cliente real, gere um UUID novo e troque os e-mails (ou parametrize por env antes de rodar o seed).
- **4 (config):** Knob 3. Preenche só o que diverge do default.
- **5 (integrações):** Knob 2. Aqui você decide o que esse escritório tem ligado **agora**. Pode começar magro (só `manual-upload` + link copiável) e ligar Resend/IA/SIEG depois — cada um é só env + redeploy.
- **6 (domínio):** ver §5 abaixo.
- **7–8 (validar + abrir):** os fluxos de smoke espelham os specs E2E em `apps/web/e2e`. Segurança em `HARDENING.md`.

**Ponto-chave:** dá pra colocar um escritório no ar com **zero integrações pagas** (tudo nos fallbacks) e ir ligando integração por integração depois, sem migração e sem release. Onboarding e ativação de integrações são eixos independentes.

---

## 5. Domínio e DNS — como o público enxerga

Por escritório existem dois deployáveis, mas **só a web tem domínio público**:

- **`app.<firma>.com.br` → web (Vercel).** Login, painéis, e a página pública de solicitação de documentos `/s/{token}` (cliente final do escritório abre sem conta).
- **Worker (Railway) não tem domínio público.** Ele só fala com o Supabase e dispara e-mails. Mas ele precisa **saber a URL da web** para montar os links nas mensagens: por isso `APP_BASE_URL` no worker = a mesma URL pública da web. Se isso estiver errado, o link no e-mail de cobrança aponta pro lugar errado.

```
   Cliente final do escritório
            │  abre o link do e-mail
            ▼
   app.<firma>.com.br  ──(CNAME)──►  Vercel (web)  ──►  Supabase prj <firma>
                                                            ▲
   Worker (Railway) ──── envia e-mail com link ─────────────┘
        usa APP_BASE_URL = https://app.<firma>.com.br  (para MONTAR o link)
```

> Limitador de rate da rota `/s/[token]` é **em memória por instância** → mantenha a web em **1 instância**, ou mova o limiter para um store compartilhado antes de escalar horizontalmente (HARDENING / RUNBOOK §8).

---

## 6. As integrações que você citou, no modelo

| Você disse… | É a porta… | Estado v1 | Para ativar a versão "real" |
| --- | --- | --- | --- |
| **Resend** | `MessagingAdapter` | fallback Noop; **Resend pronto** | env `RESEND_API_KEY` + `RESEND_FROM` (verificar domínio remetente) |
| **Extração de NF** | `XmlSourceAdapter` | só `manual-upload` | implementar `sieg`/`plugstorage` — **exige cofre de certificados A1** e contrato; ver ADAPTERS §1 |
| **Recebimento de documentos** | core + canais de entrada | **pronto** | upload/solicitação sempre funciona; **WhatsApp** e **IMAP** ligam por env (Knob 2) e caem na mesma triagem |
| **Atendimento (dúvidas)** | `SupportAssistantAdapter` + tela `/atendimento` | **pronto** | IA responde o trivial (com `ANTHROPIC_API_KEY` + `support.autoReply`) ou escala para humano |

Note a assimetria: o **recebimento** acontece por três caminhos hoje — (1) solicitação → link `/s/{token}` → upload do cliente, (2) **entrada por WhatsApp** (`WhatsappAdapter`), (3) **entrada por IMAP** (`ImapInboundAdapter`). Os dois últimos são adapters de _canal_ que normalizam a mensagem e a jogam na **mesma triagem** do upload. Já **"extração de NF"** é genuinamente uma porta com implementações externas pesadas (SIEG, PlugStorage), todas condicionadas a um cofre A1 que ainda não existe na v1.

> **Webhook do WhatsApp (se ativado).** Com as `WHATSAPP_*` setadas na **web**, o endpoint `/api/webhooks/whatsapp` fica ativo. No painel do Meta (WhatsApp → Configuração): callback URL = `https://app.<firma>/api/webhooks/whatsapp`, verify token = `WHATSAPP_VERIFY_TOKEN`, e **assine o campo `messages`**. O endpoint valida a assinatura `X-Hub-Signature-256` (HMAC com o app secret) — sem isso, nenhuma mensagem entra. A URL precisa ser pública (deploy ou túnel).

Para esforço/custo/pré-requisito de cada implementação futura (SIEG × PlugStorage, Infosimples para CND, Integra Contador, Alterdata), o catálogo é o **`docs/ADAPTERS.md`** — não vou duplicar os números aqui. WhatsApp Cloud e IMAP já estão implementados (ADAPTERS §3/§4).

---

## 7. Onde olhar a seguir

| Pergunta | Documento |
| --- | --- |
| "Quais comandos exatos pra subir um escritório?" | `clients/demo/RUNBOOK.md` (§1–§7); §11 = cliente #2 |
| "Qual integração contratar, quanto custa, o que exige?" | `docs/ADAPTERS.md` |
| "Quais variáveis de ambiente existem e o que cada uma faz?" | RUNBOOK §5 (tabelas de env de web e worker) |
| "Quais campos de negócio são configuráveis?" | `packages/config/src/firm-config.ts` (a fonte da verdade) |
| "Checklist de segurança antes do go-live" | `docs/HARDENING.md` |
| "Regras invioláveis do produto" | `CLAUDE.md` (golden rules) |

---

### Decisões ainda em aberto (não cravadas — apenas sinalizadas)

Estas afetam o onboarding mas dependem de decisão sua / cotação — estão registradas para não se perderem, não como conclusão:

- **Cofre de certificados A1** — pré-requisito de _qualquer_ extração automática de NF e de CND. Não existe na v1; é o que destrava `XmlSourceAdapter` e `CndProviderAdapter` reais.
- **SIEG × PlugStorage** para extração de NF (cotação por faixa de CNPJs) — ADAPTERS §1.
- **Remote GitHub + chave Resend** ainda pendentes de provisionar.
- **all-Vercel vs. web+worker split** — hoje o modelo é split (web Vercel / worker Railway); all-Vercel é possível mas exige reescrever o worker em Vercel Cron + função de drain (RUNBOOK §5).
