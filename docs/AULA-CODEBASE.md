# Aula completa — Como o Hub Contábil é construído

> Material de estudo do código. Lê de cima pra baixo na primeira vez; depois usa como
> referência. Todo caminho de arquivo aqui foi conferido contra o repositório real.
> Convenção: `caminho/arquivo.ts:linha` aponta direto pro trecho.

---

## 0. Como usar esta aula

O projeto é grande, mas **muito regular**: as mesmas 6 ideias se repetem em toda
feature. Se você entender as ideias uma vez, lê o resto no automático.

As 6 ideias-núcleo (decore estas e o resto decorre):

1. **`firm_id` em tudo.** Toda tabela e toda query são isoladas por escritório.
2. **Domínio puro no `core`.** Regra de negócio mora em funções sem IO, testadas. Tela e robô chamam a _mesma_ função.
3. **Integração externa sempre atrás de uma interface (adapter).** Nunca importa SDK direto.
4. **Valor de negócio é configuração, não código.** Prazos, taxonomia, threshold de IA → `firms.config` (JSONB validado por Zod).
5. **Nada falha em silêncio.** Erro de automação vira item na fila de exceções; IA incerta vira exceção com sugestão pré-preenchida.
6. **Tudo audita.** Toda ação (humana ou robô) escreve em `audit_events`.

Roteiro de leitura sugerido (segue a direção de dependência, de dentro pra fora):
`config → core → db → adapters → worker → ui → web`. As seções abaixo estão nessa ordem.

---

## 1. O que é o produto

Produto-base para **escritórios de contabilidade**. Um escritório tem dezenas a
centenas de empresas-clientes, quatro setores (Fiscal, Contábil, Departamento
Pessoal, Compliance) e um ciclo mensal por _competência_. As dores que o produto
ataca:

- **Visibilidade** — onde está cada empresa? (metáfora central: o **farol** 🟢🟡🔴⚪)
- **Prazos** — certidões/obrigações que vencem sem ninguém ver.
- **Documentos** — achar nota/guia/certidão sem caçar em pasta e WhatsApp.
- **Cobrança com prova** — pedir documento ao cliente e provar que ele viu/enviou.
- **Trabalho braçal** — triar e classificar documento que chega solto (a IA ajuda).

Primeiro cliente: **Contabilidade M Rocha**. Modelo de entrega: **single-tenant**
(uma instância isolada por escritório), mas com **schema e código multi-tenant-ready**
(todo dado já carrega `firm_id`). Isso permite escalar pro cliente #2 sem reescrever nada.

O escopo v1 são 11 módulos (M1–M11), construídos em 25 tarefas (T1–T25). O mapa
tarefa→código está na [seção 14](#14-mapa-de-tarefas-t1t25).

---

## 2. Arquitetura em camadas

```
clients/demo        → SÓ config/override do deploy (sem lógica de negócio)
      │
      ▼
apps/web (Next.js)            apps/worker (Node)
  telas + server actions        filas pgmq + crons + pipeline de IA
      │        │                       │
      ▼        ▼                       ▼
packages/ui  packages/db  ◄────────────┘   (queries; cada uma isola firm_id)
(design sys)     │
                 ▼
          packages/core  ◄── packages/adapters     packages/config
          (domínio PURO       (interfaces de          (schemas Zod da
           sem IO)             integração)             config por firm)
```

**Regra de dependência (inviolável):** `clients/* → packages/*`, nunca o contrário.
`core` não importa de `adapters` nem de `db`. `web` consome `ui` para todo primitivo
de status/layout. Isso mantém o domínio puro testável e troca de integração sem tocar core.

Grafo real de imports entre workspaces:

```
apps/web      → @hub/ui, @hub/core, @hub/db, @hub/config, @hub/adapters
apps/worker   → @hub/adapters, @hub/config, @hub/core
@hub/adapters → @hub/core
@hub/db       → @hub/config  (+ @hub/core em devDependency)
@hub/ui       → (nenhum dep interno)
@hub/config   → (só zod)
@hub/core     → (só zod)
```

Repara: `core` e `config` só dependem de `zod`. São as folhas do grafo — por isso são
puros e rápidos de testar.

---

## 3. Monorepo e tooling

**pnpm workspaces + Turborepo.** Membros do workspace em `pnpm-workspace.yaml`:
`apps/*`, `packages/*`, `clients/*`. Pacotes se referenciam por nome (`@hub/core`,
`@hub/db`, …) com `workspace:*` — sem registry.

**`turbo.json`** define os pipelines:

- `build` tem `dependsOn: ["^build"]` → um pacote é buildado antes de quem depende dele.
- `dev` é `persistent` e sem cache (roda indefinidamente).
- `lint`, `typecheck`, `test` rodam em paralelo (sem deps).

**TypeScript estrito** (`tsconfig.base.json`, herdado por todos): `strict`,
`noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`,
`isolatedModules`, `noEmit`. Ou seja: indexar array/objeto te obriga a tratar `undefined`.

**Comandos** (da raiz; Turbo fan-out para os workspaces):

| Comando                                      | O que faz                                     |
| -------------------------------------------- | --------------------------------------------- |
| `pnpm dev`                                   | web + worker em watch contra o Supabase Cloud |
| `pnpm build` / `lint` / `typecheck` / `test` | qualidade em todo o repo                      |
| `pnpm --filter @hub/db db:push`              | aplica migrations no projeto cloud linkado    |
| `pnpm --filter @hub/db db:types`             | regenera `database.types.ts` do schema        |
| `pnpm --filter @hub/db seed`                 | cria firm + usuários (usa `SEED_PASSWORD`)    |
| `pnpm --filter @hub/web test:e2e`            | Playwright nos fluxos críticos                |

`.env*` é git-ignorado; só os `*.env.example` são versionados. **Supabase Cloud only** —
sem banco local, sem Docker. Migrations versionadas aplicadas via Supabase CLI.

---

## 4. Multi-tenancy — a regra de ouro

Esta é a coluna vertebral de segurança. Existem **dois caminhos** de acesso ao banco,
com mecânicas diferentes:

### 4.1 Caminho autenticado (web) — RLS automática

Toda tabela de domínio tem `firm_id uuid not null` e **RLS ligada**. A função-chave
(`packages/db/supabase/migrations/20260613042105_rls.sql:9`):

```sql
create function current_firm_id() returns uuid language sql stable as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'firm_id', ''),  -- setado na criação do user
    nullif(auth.jwt() ->> 'firm_id', '')
  )::uuid;
$$;
```

E toda policy é `using (firm_id = current_firm_id())`. O `firm_id` é lido **do JWT
assinado**, nunca de um lookup em tabela (que recursaria na própria RLS) e nunca do
input do usuário. Resultado: um `select * from companies` já volta filtrado pelo
escritório do chamador. Um usuário **não consegue** ver dado de outro escritório nem
que tente.

### 4.2 Caminho de serviço (worker) — filtro manual obrigatório

O worker usa o **service role**, que tem `BYPASSRLS`. Logo a RLS _não_ o protege — ele
**tem que filtrar `firm_id` na mão em toda query**. Isso é testado estaticamente:
`apps/worker/src/firm-scope.test.ts` varre o código-fonte do worker e **quebra o build**
se algum `insert/update/delete into public.*` não mencionar `firm_id` por perto. Leituras
cross-firm (ex.: iterar todos os escritórios no cron) são intencionalmente liberadas; o
perigo é _escrever_ no escritório errado.

### 4.3 Auditoria à prova de fraude

`audit_events` é **server-write-only**: a migration `..._audit_server_write_only.sql`
faz `revoke insert ... from authenticated`. Ninguém escreve auditoria direto. Toda
escrita passa pela RPC `log_audit(action, entity, entity_id, context)`
(`..._firm_config_update_and_log_audit.sql:23`), que é `security definer`,
`set search_path = ''` (hardening) e carimba `firm_id := current_firm_id()` e
`actor_id := auth.uid()` **no servidor**. Você não consegue forjar quem fez a ação.

O teste `packages/db/src/rls.test.ts` prova as três coisas: (a) vejo meu firm,
(b) não vejo o firm alheio (volta vazio), (c) não consigo inserir na trilha de auditoria.

> **Padrão recorrente:** ações que cruzam a fronteira de RLS (handoff entre setores,
> resolver exceção, rotacionar token público) são feitas por **RPCs `security definer`**
> que validam o escopo do firm internamente antes de escrever. Ver seção 7.

---

## 5. `packages/config` — configuração por escritório

Arquivo central: `packages/config/src/firm-config.ts`. Define um **schema Zod**
(`firmConfigSchema`) com _defaults inteligentes_: um firm recém-criado com `config = '{}'`
ainda parseia para uma config completa e válida.

Exportações principais:

- `parseFirmConfig(raw)` → preenche faltantes com default (merge).
- `validateFirmConfig(raw)` → retorna o **primeiro erro em pt-BR** (ex.: _"O prazo de alerta deve ser de pelo menos 1 dia."_).

O que é configurável (= valores de negócio que saem do código):

| Chave                                                                                         | Significado                                  | Default                              |
| --------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------ |
| `deadlineTriggers.defaultDays`                                                                | dias antes do vencimento → alerta "due_soon" | 30                                   |
| `deadlineTriggers.autoRenewalTask`                                                            | criar tarefa de renovação ao vencer          | true                                 |
| `aiThreshold`                                                                                 | confiança mínima da IA para arquivar sozinha | 0.85                                 |
| `aiModel`                                                                                     | modelo usado na triagem                      | `claude-opus-4-8`                    |
| `requestTokenExpiryDays` / `requestReminderDays`                                              | validade do link público / quando lembrar    | 7 / 3                                |
| `exportBatch.fileNameConvention`                                                              | convenção de renome no lote                  | `{cnpj}_{period}_{type}_{seq}.{ext}` |
| `departments`, `taxRegimes`, `monitoredKinds`, `taxonomy`, `routingMap`, `statusVocabularies` | vocabulários e mapa tipo→setor               | conjuntos default                    |

Persistência: `firms.config` JSONB. A tela `/configuracoes` lê/edita com validação
(opções avançadas recolhidas). É a materialização da regra de ouro #8.

---

## 6. `packages/core` — domínio puro

A regra do `core`: **sem IO, sem relógio, sem rede, sem banco.** Datas entram como
parâmetro (`today: string`), nunca `Date.now()`. Cada módulo tem seu `.test.ts` ao lado —
**ler o teste primeiro é o atalho** para entender a intenção. Tela e worker chamam as
mesmas funções, então UI e banco nunca divergem.

### 6.1 `cnpj.ts` — validação de CNPJ

`isValidCnpj` / `normalizeCnpj` / `formatCnpj`. O dígito verificador usa módulo-11 com
pesos ciclando 2..9 da direita pra esquerda (`cnpj.ts:22`). Detalhe esperto: rejeita
explicitamente sequências repetidas (`00000000000000`, etc.) que passam na matemática
mas nunca são registros reais (`cnpj.ts:37`).

### 6.2 `task.ts` — máquina de estados de tarefa

Fonte única da verdade das transições — espelhada pela RPC SQL `handoff_task`.

```ts
const TRANSITIONS = {
  pending: ['in_progress', 'canceled'],
  in_progress: ['done', 'canceled'],
  done: [], // terminal
  canceled: [], // terminal
};
```

`canTransitionTask(from,to)`, `allowedTaskTransitions(from)`, `canHandoffTask(status)`
(só `pending`/`in_progress`). Progressão linear, cancelar de qualquer estado aberto,
terminais sem saída.

### 6.3 `request.ts` — máquina de estados da solicitação

7 estados: `requested → sent → viewed → received|downloaded` (+ `expired`, `cancelled`).
Sutileza importante (`request.ts:67`): no **reenvio**, `statusAfterResend` mantém `viewed`
como `viewed` — nunca regride para `sent`, senão apagaria o fato "o cliente já abriu".

### 6.4 `monitored.ts` — status de prazo (deriva o farol)

`deriveMonitoredStatus(dueDate, triggerDays, today)` → `no_date | valid | due_soon | overdue`.
Aritmética de data 100% determinística em UTC (`subtractDays`). A janela de alerta é
`[due - trigger, due]`. O 5º status `needs_update` é setado pelo fluxo de exceção (humano),
não pela função. `monitoredToDeadlineSignal` traduz status → sinal do farol
(`overdue/needs_update → 🔴`, `due_soon → 🟡`, `valid → 🟢`, `no_date → sem sinal`).

### 6.5 `mapping-rules.ts` — resolvedor genérico com precedência

Coração do motor de regras (usado primeiro no caso CFOP). `resolveMappingRule(rules, domain, queryKey)`:

- Filtra por `domain` e por _match de chave_ (`keyMatches`): um campo `null/''` na
  regra significa **"qualquer valor"**; um campo preenchido tem que bater exato.
- Ordena por **nível 1 (específico) antes do nível 2 (geral)**, depois por especificidade
  (mais campos restringidos ganha), depois desempate determinístico.
- Sem match → `{ status: 'pending' }` → vai pra fila de exceções (regra de ouro #5).

Exemplo CFOP: regra nível 1 `{originCfop:'1102', supplierCnpj:'...199'}` vence a regra
nível 2 `{originCfop:'1102', supplierCnpj:null}` quando o fornecedor bate; se não bate,
cai na geral; se nem a origem bate, vira pendência.

### 6.6 `nfe.ts` — parser determinístico de NF-e (sem LLM)

`parseNfe(xml)` extrai `issuerCnpj`, `accessKey` (chave de 44 dígitos) e `items[].cfop`
via regex sobre o layout NF-e 4.00. **Nunca usa IA** (regra de ouro #4: confiança = certa)
e **nunca modifica o XML** (imutável). Invariante crítica: o CNPJ vem do bloco `<emit>`,
nunca do `<dest>` (`nfe.ts:35`) — senão pegaria o comprador. Trata produtor rural (CPF no
emit → issuer null).

### 6.7 `triage.ts` — a decisão da IA (mas a IA não decide sozinha)

`decideTriage({confidence, threshold, companyFound, department})` → `file | exception`,
nesta ordem de prioridade:

1. empresa não encontrada → exceção (`company_not_found`) — o mais acionável pro humano
2. `confidence < threshold` → exceção (`low_confidence`)
3. sem setor de roteamento → exceção (`no_route`)
4. tudo ok → arquiva (`ok`)

`routeDepartment(routingMap, docType)` resolve o setor pelo mapa da config. Threshold na
igualdade conta como confiante.

### 6.8 Os demais

- `import.ts` — validador da planilha de onboarding: normaliza cabeçalhos (tira acento), valida CNPJ/regime/UF, detecta duplicado **na planilha** e **já cadastrado**, anota cada linha com motivo em pt-BR. `IMPORT_COLUMNS` é a fonte única que template e parser compartilham (não divergem).
- `export.ts` — `buildExportManifest(docs, convention)`: ordena determinístico, renomeia por convenção (tokens `{cnpj}/{period}/{type}/{seq}/{ext}`), **exclui documento com CFOP pendente** (com motivo, nunca dropa em silêncio), dedup de nomes, e `manifestToCsv` para o operador do ERP.
- `audit.ts` — `buildAuditEvent`: valida com Zod e converte camelCase→snake_case. Não faz IO; quem insere é o chamador (web/worker).
- `request-email.ts` — `buildRequestEmail`: monta assunto/texto/HTML em pt-BR (com escape anti-injeção), variando por tipo (upload/oferta) e se é lembrete.

---

## 7. `packages/db` — schema, queries e RPCs

Duas metades: as **migrations SQL** (`supabase/migrations/`, idempotentes, versionadas)
e os **módulos de caso de uso** (`src/*.ts`), que são funções recebendo um client
Supabase já escopado.

### 7.1 Inventário de tabelas (todas com `id`, `firm_id`, `created_at`, `updated_at` + RLS)

| Tabela                                         | Para quê                                                  | Tarefa  |
| ---------------------------------------------- | --------------------------------------------------------- | ------- |
| `firms`                                        | raiz do tenant; `config` JSONB                            | T3      |
| `users`, `user_departments`                    | perfil sobre `auth.users` + escopo de setor               | T3      |
| `audit_events`                                 | trilha de auditoria (server-write-only)                   | T3      |
| `companies`, `contacts`                        | cadastro de empresas + pessoas; `enrichment_data` JSONB   | T6/T7   |
| `exception_queue`                              | fila genérica de exceções (source: triage/export/rules/…) | T9      |
| `tasks`, `notifications`                       | tarefas com handoff + alertas in-app                      | T10     |
| `recurring_tasks`                              | templates de geração mensal                               | T11     |
| `documents`                                    | metadados de arquivo (arquivo no Storage privado)         | T12     |
| `monitored_documents`                          | obrigações datadas (CND, alvará…)                         | T14     |
| `document_requests`, `document_request_events` | solicitações + timeline público                           | T16/T17 |
| `mapping_rules`                                | regras de precedência                                     | T18     |
| `export_batches`, `export_batch_documents`     | lotes de exportação                                       | T22     |
| `classifications`, `classification_examples`   | resultado da IA + correções (few-shot)                    | T20/T21 |
| `inbound_messages`                             | mensagens recebidas (WhatsApp/IMAP); âncora de idempotência | §17     |
| `support_tickets`, `support_messages`          | atendimento: conversa por contato + mensagens             | §17     |

Detalhes que valem citar:

- FKs **compostas** `(firm_id, company_id)` impedem apontar para empresa de _outro_ firm — isolamento no nível do schema.
- `documents.storage_path` tem `CHECK` de prefixo `firm/<firm_id>/...`; o bucket Storage tem RLS por `firm_id` na pasta. Soft delete via `status`, nunca hard-delete em `companies`.
- `documents` não tem `UPDATE` para `authenticated`: derivados (ex.: `entry_cfop`) entram só via RPC `apply_cfop_metadata` → mantém a nota imutável.
- Idempotência da geração mensal: índice único parcial `(recurring_task_id, company_id, period)`.

### 7.2 pgmq (filas) — `..._queues_pgmq.sql`

Cria as filas `triage`, `export`, `notifications`, `enrichment` e seus `*_dlq`
(dead-letter). Todo payload carrega `firm_id`. Enfileiramento costuma vir de RPCs
`security definer` (ex.: `create_export_batch` insere o lote, faz `pgmq.send('export', …)`
e audita — tudo numa transação).

### 7.3 O padrão dos módulos `src/*.ts` (vale para ~15 arquivos)

Exemplo canônico em `companies.ts` (criar empresa):

1. `loadFirm(supabase)` — `select ... from firms limit 1` (a RLS já limita à 1 linha visível → é o firm do chamador, seguro pra carimbar).
2. validar input (CNPJ via `@hub/core`, regime contra a config).
3. `insert({ firm_id: firm.id, ... })` — **firm_id carimbado do firm carregado, nunca do input**.
4. tratar violação de unique (`23505`) com mensagem pt-BR (ex.: "CNPJ já cadastrado / arquivado").
5. `supabase.rpc('log_audit', …)`.
6. retornar união discriminada `{ ok:true, id } | { ok:false, message }`.

Mapeamento de linha: o banco fala snake_case, o domínio fala camelCase. Há sempre um
`mapXxx(row)` convertendo (`companies.ts` `mapCompany`).

### 7.4 RPCs `security definer` notáveis

- `handoff_task(p_task_id)` — valida que o chamador é gestor _ou_ dono do setor da tarefa, marca a origem como `done`, **cria a tarefa do próximo setor** (cruzando a RLS de setor), notifica e audita — atômico.
- `resolve_exception(p_id, p_status, p_note)` — carimba `resolution` com `resolvedBy/resolvedAt` e audita.
- `get_request_by_token(p_token)` / `record_request_upload(...)` / `rotate_request_token(...)` — acesso público por token: **só o hash SHA-256 do token é guardado** (o token cru nunca toca o banco), validações (expiração, tipo, dono do path) ficam dentro da RPC. Ver seção 11.4.
- `apply_cfop_metadata(p_document_id, p_entries)` — única via de escrever `documents.metadata`.

---

## 8. `packages/adapters` — integrações atrás de interface

Regra de ouro #3. Cada integração externa é uma **interface** + uma ou mais
implementações + uma **factory** que escolhe pela env. O worker nunca importa Anthropic
ou Resend direto.

| Adapter              | Interface                          | Implementações                                                                                            | Factory escolhe por              |
| -------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `classification.ts`  | `ClassificationAdapter.classify()` | `AnthropicClassificationAdapter` / `HeuristicClassificationAdapter` (fallback confiança 0 → vira exceção) | `ANTHROPIC_API_KEY`              |
| `messaging.ts`       | `MessagingAdapter.sendEmail()`     | `ResendMessagingAdapter` / `NoopMessagingAdapter` (só loga)                                               | `RESEND_API_KEY` + `RESEND_FROM` |
| `erp.ts`             | `ErpAdapter.buildBatch()`          | `ManualExportErpAdapter` (zip via `fflate` + manifests)                                                   | sempre manual (v1)               |
| `cnpj-enrichment.ts` | `CnpjEnrichmentAdapter.enrich()`   | `BrasilApiEnrichmentAdapter` (com fallback ReceitaWS)                                                     | sempre BrasilAPI                 |
| `whatsapp.ts`        | `WhatsappAdapter` (parse webhook + download mídia + envio) | `MetaWhatsappAdapter` (Cloud API oficial) / `NoopWhatsappAdapter` (parse/verify ainda funcionam)         | `WHATSAPP_ACCESS_TOKEN`+phone+secret |
| `inbound-imap.ts`    | `ImapInboundAdapter.fetchUnseen()` | `ImapFlowInboundAdapter` (imapflow+mailparser, import preguiçoso) / `NoopImapInboundAdapter`              | `IMAP_HOST`+user+password        |
| `support-assistant.ts` | `SupportAssistantAdapter.answer()` | `AnthropicSupportAssistant` / `HeuristicSupportAssistant` (escala tudo p/ humano)                       | `ANTHROPIC_API_KEY`              |

Pontos finos:

- **Throttle compartilhado** no enrichment: um _gate_ (`Promise` encadeada) serializa
  todas as chamadas mesmo com vários consumidores, respeitando a API (`ENRICHMENT_THROTTLE_MS`, default 1000ms).
- **Classificação força tool use** no Claude: schema `classify_document` com `docType`
  (enum da taxonomia), `confidence` (0–1) e `cnpj`; system prompt em pt-BR; trata
  `stop_reason === 'refusal'` retornando confiança 0 (→ exceção). Suporta PDF (`document`)
  e imagem (`image`) em base64.

A factory injeta a implementação certa no boot do worker; os jobs recebem o adapter por
parâmetro (dependency injection) — testes injetam fakes.

---

## 9. `apps/worker` — filas, crons e o pipeline de IA

Processo Node longo (Railway), service role, roda "para sempre".

### 9.1 Boot — `src/index.ts`

`loadEnv()` (Zod, `src/env.ts`) → conexão postgres (`prepare:false` p/ pooler) → client
Supabase service role (Storage) → instancia os adapters **uma vez** (singletons) →
registra as filas com concorrência/visibility por fila (triage `qty=3, vt=120s`;
export `qty=1, vt=300s`; enrichment `qty=5, vt=90s`) → `JobRunner` (poll 2s) →
`startCrons()` → heartbeat 30s → shutdown gracioso em SIGINT/SIGTERM.

### 9.2 Runner de filas — `src/queue/runner.ts` + `src/queue/payloads.ts`

Todo payload estende `basePayloadSchema = { firm_id: UUID }` (Zod). Payload sem `firm_id`
nem parseia → vai pro DLQ. Loop por mensagem:

```
pgmq.read(fila, vt, qty)
  → Zod.parse(payload)
  → handler(payload)
      sucesso → pgmq.delete
      falha:
        readCt < 3 → backoff exponencial 2^(readCt-1)s, re-tenta
        readCt >= 3 → pgmq.send(<fila>_dlq, {payload, error, read_ct}) + delete + sink
```

O _sink_ (`jobs/exception-sink.ts`) extrai o `firm_id` do payload e grava na
`exception_queue` (source = nome da fila). Se nem `firm_id` tiver, **loga alto** e deixa
na DLQ pra inspeção manual — nunca engole (regra de ouro #6).

### 9.3 Crons — `src/cron/scheduler.ts`

Três crons (em dev, `CRON_ACCELERATED=true` força tudo a cada 10s):

| Cron                  | Quando (prod)   | Faz                                                                        |
| --------------------- | --------------- | -------------------------------------------------------------------------- |
| `deadlines-daily`     | 06:00           | recalcula status de prazos, alerta em transições, cria tarefa de renovação |
| `recurrences-monthly` | dia 1, 00:00    | gera tarefas do período a partir dos templates                             |
| `alerts`              | de hora em hora | lembra solicitações paradas há N dias                                      |

### 9.4 Jobs (resumo)

- **`triage.ts` (T20) — o mais rico.** Pipeline funcional sequencial (não LangGraph; por escolha de simplicidade): `carrega doc+config → extrai texto → classifica → extrai CNPJ → resolve empresa → roteia → decide → arquiva | exceção`. XML vai pelo `parseNfe` (sem LLM, confiança 1); PDF/imagem vão pelo `ClassificationAdapter`. **Sempre** grava em `classifications` (auditoria + few-shot). Em `file`: atualiza o documento sem sobrescrever `company_id` já existente. Em `exception`: grava na fila com **sugestão pré-preenchida** (`{docType, department, cnpj}`).
- **`deadlines.ts` (T15)** — varre `monitored_documents`, aplica `deriveMonitoredStatus` com a data de hoje em São Paulo, em transição para `due_soon`/`overdue` emite notificação + e-mail; em `overdue` cria "Renovar {kind} — {empresa}" **idempotente** (checa se já existe tarefa aberta linkada).
- **`recurrences.ts` (T11)** — para cada template ativo, gera tarefas com `NOT EXISTS` por `(recurring_task_id, company_id, period)` → rodar 2x não duplica. Join sempre escopado `c.firm_id = template.firm_id`.
- **`enrichment.ts` (T7)** — chama o adapter, monta envelope `enrichment_data`, atualiza a empresa **não-destrutivamente** (`coalesce`, só preenche vazio), audita com `actor_id` nulo (ação de robô).
- **`export.ts` (T22)** — carrega lote, `buildExportManifest`, baixa os incluídos do Storage, zip via `ErpAdapter`, sobe o zip, marca `ready` (em erro: `failed` e re-tentável).
- **`request-reminders.ts` (T17)** — para cada firm, acha solicitações `sent` velhas, **rotaciona o token antes de reenviar**, manda e-mail (reminder), carimba `last_reminded_at` nos dois ramos (sucesso/exceção) → no máximo um lembrete por janela.

---

## 10. `packages/ui` — design system

O risco #1 do produto é **sobrecarga visual**. O `ui` existe para que nenhuma tela
reinvente status/farol. Tokens semânticos (`success/warning/danger/neutral/muted`) — cor
**só** comunica status, nunca decora.

| Componente                 | Para quê                                                       |
| -------------------------- | -------------------------------------------------------------- |
| `StatusBadge`              | o único badge de status (cor + ícone + label pt-BR)            |
| `TrafficLight`             | o farol, idêntico em toda parte                                |
| `StatCard`                 | número grande clicável (dashboard: "números antes de tabelas") |
| `DataList` / `DataListRow` | linha de lista: indicador + título + até 2 fatos + chevron     |
| `DetailDrawer`             | gaveta lateral (Radix Dialog) — disclosure progressivo         |
| `EmptyState`               | estado vazio desenhado (ícone + título + ação)                 |
| `PageHeader`               | título + **uma** ação primária                                 |
| `Skeleton`/`SkeletonList`  | loading com skeleton, nunca spinner                            |
| `AppShell`                 | sidebar única (máx 7 itens, badge de contagem) + responsivo    |

A **lógica de agregação do farol** é pura e centralizada (`packages/ui/src/lib/traffic-light.ts`):
`aggregateTrafficLight(signals)` → `red` se houver algum vencido; `yellow` se houver a vencer
e nenhum vencido; `green` se tudo ok; `gray` se sem dado. Tem teste provando a precedência.
Worker, painel e dashboard computam o farol do mesmo jeito.

---

## 11. `apps/web` — Next.js (App Router)

### 11.1 Padrão geral

- **Server Components** buscam dados (query no servidor, sem camada de API). **Client Components** cuidam de interatividade (drawer, transições).
- **`copy.ts` por feature** centraliza TODO texto pt-BR (nada de string solta no JSX). Termos de domínio (CNPJ, CFOP, competência) ficam em pt-BR.
- **Server Actions** (`actions.ts`) são wrappers finos sobre os casos de uso do `@hub/db`: extraem `FormData` → chamam a função do db → `revalidatePath` → retornam `{ok,message}`. A validação real mora no `@hub/db` (fonte única).

### 11.2 Auth e shell

- `apps/web/src/middleware.ts` → `lib/supabase/middleware.ts`: roda em toda rota, valida sessão com `getUser()`, **protege por padrão** (só `/login`, `/`, `/design`, `/s/*` são públicas), redireciona sem sessão pra `/login`.
- `app/(app)/layout.tsx`: Server Component que busca em paralelo as contagens de badge (exceções, solicitações) e notificações, e entrega ao `AppNav` (client, que usa `usePathname` pro item ativo).

### 11.3 Rotas (verificadas)

Protegidas (grupo `(app)`): `inicio`, `empresas` (+ `nova`, `[id]`, `[id]/editar`,
`importar`, `importar/modelo` route handler do CSV), `tarefas` (+ `recorrentes`),
`documentos`, `atendimento` (§17), `excecoes`, `solicitacoes`, `regras`, `exportacao`,
`configuracoes`, `ajuda`. A sidebar é limitada a 7 itens (regra UX #11): quando
`atendimento` entrou, **`configuracoes` saiu para o topo** (engrenagem ao lado do
tutorial) — Configurações é ação de conta, não fila do dia.
Públicas/raiz: `login`, `s/[token]`, `design`, `page.tsx` (bootstrap), `layout.tsx`.
Route handler de máquina (sem sessão): `api/webhooks/whatsapp` (§17).
Cada pasta de feature segue o mesmo conjunto: `page.tsx` + `copy.ts` + `actions.ts` +
componentes client + `loading.tsx`.

### 11.4 A rota pública `/s/[token]` (a tela mais simples do produto)

Sem sessão de firm — o **token na URL é a credencial**. `export const dynamic = 'force-dynamic'`.
Resolve tudo por RPCs por token (`getRequestByToken`), com **rate limit por IP**
(`lib/rate-limit.ts`, janela fixa em memória). Estados desenhados: link inválido, link
expirado, upload pendente (dropzone), já recebido, ou download. Upload do cliente cai na
`documents` com `source = 'request'` e é **enfileirado pra triagem**.

### 11.5 Como as regras de UX viram código

Uma ação primária por tela (`PageHeader`), disclosure progressivo (lista → `DetailDrawer`),
máx 5 colunas (resto na gaveta), views default (tarefas = "minhas"; empresas = "ativas";
exceções = "abertas"), skeleton no loading, `EmptyState` com mensagem do que fazer,
sidebar com no máx 7 itens e badge de contagem.

---

## 12. Fluxos fim-a-fim (juntando as camadas)

Estes são os melhores roteiros para "ver tudo se conectar". Siga um arquivo de cada vez.

### 12.1 Documento chega → triagem por IA

1. `documentos` (upload inbox, sem empresa) **ou** `/s/[token]` (cliente) → grava em `documents` (`source` triage/request) e `pgmq.send('triage', {firm_id, document_id})`.
2. Worker `jobs/triage.ts`: classifica (XML→`parseNfe`; PDF/imagem→`ClassificationAdapter`) → `resolve_company` por CNPJ → `decideTriage`.
3. Confiante + empresa achada + roteável → arquiva com setor; grava `classifications` e audita.
4. Caso contrário → `exception_queue` (source `triage`) com sugestão.
5. Humano em `/excecoes` resolve (e pode "salvar como regra"). Correção vira `classification_examples`.

### 12.2 Tarefa + handoff entre setores

`/tarefas` cria tarefa → `task.ts` valida transição → concluir com `handoff_to` chama a RPC
`handoff_task` → cria a tarefa do próximo setor (cruzando RLS) + `notifications` + auditoria.

### 12.3 Prazo vence → alerta + tarefa

Cron `deadlines-daily` recalcula com `deriveMonitoredStatus` → transição emite alerta
in-app + e-mail (via `MessagingAdapter`) → `overdue` cria tarefa de renovação idempotente →
alimenta o farol do painel.

### 12.4 Solicitação → link público → upload

`/empresas/[id]` (aba solicitações) cria pedido → RPC gera token (guarda só o hash) →
`/s/[token]` registra view (status→`viewed`) → upload do cliente → RPC valida e grava o
documento (`source request`) + enfileira triagem. Cron `alerts` lembra se ficar parado.

### 12.5 XML → regra CFOP → lote de exportação

Upload de NF-e → `parseNfe` extrai CFOP/emitente → `resolveMappingRule` (nível 1→2) →
`apply_cfop_metadata` grava `entry_cfop` no metadata (XML intacto) ou gera pendência →
`/exportacao` monta lote: `buildExportManifest` **exclui** docs com CFOP pendente, zip +
manifest JSON/CSV pra download.

---

## 13. Testes

| Camada                 | Tipo                                       | Onde                                                  |
| ---------------------- | ------------------------------------------ | ----------------------------------------------------- |
| `core`, `config`, `ui` | unit puro (rápido, sem rede)               | `*.test.ts` ao lado do módulo                         |
| `db`                   | integração contra o **Supabase Cloud dev** | `packages/db/src/*.test.ts` (sequencial, 30s timeout) |
| `adapters`, `worker`   | unit com fakes injetados                   | `*.test.ts`                                           |
| isolamento             | RLS cross-tenant                           | `packages/db/src/rls.test.ts`                         |
| escopo do worker       | scan estático de `firm_id`                 | `apps/worker/src/firm-scope.test.ts`                  |
| fluxos críticos        | E2E Playwright                             | `apps/web/e2e/*.spec.ts`                              |

E2E cobre os 7 fluxos críticos: smoke público, navegação autenticada, onboarding por
planilha, solicitação→link público→viewed, upload→triagem→exceção→resolução,
lote de exportação (incluído vs CFOP pendente) e varredura de prazo idempotente. O setup
faz login uma vez e salva o `storageState`; specs `*.public.spec.ts` rodam sem auth.
Os testes de worker exigem o worker rodando ao lado.

---

## 14. Mapa de tarefas T1–T25

`docs/TAREFAS.md` tem o detalhe; aqui o resumo por fase:

- **Fase 0 — Fundação:** T1 monorepo · T2 design system + shell · T3 schema+RLS+auth · T4 config layer · T5 filas/crons.
- **Fase 1 — Cadastro:** T6 empresas+contatos · T7 enrichment CNPJ · T8 onboarding por planilha.
- **Fase 2 — Operação:** T9 fila de exceções · T10 tarefas+handoff · T11 recorrentes.
- **Fase 3 — Documentos/painéis:** T12 repositório · T13 dashboard+farol.
- **Fase 4 — Prazos:** T14 prazos monitorados · T15 cron+alertas.
- **Fase 5 — Solicitações:** T16 solicitações+página pública · T17 entrega+follow-up.
- **Fase 6 — Regras:** T18 motor de regras · T19 caso CFOP + parser XML.
- **Fase 7 — IA:** T20 pipeline de classificação · T21 integração triagem↔produto.
- **Fase 8 — Exportação:** T22 lotes.
- **Fase 9 — Qualidade/deploy:** T23 E2E · T24 hardening · T25 deploy M Rocha.

Os 25 itens estão construídos com testes verdes. Riscos abertos registrados nos docs:
IA ainda não validada em documentos reais; ambiente de produção ainda não provisionado;
adapters automáticos (XML/CND/ERP/WhatsApp) são roadmap (backlog em `docs/ADAPTERS.md`).

---

## 15. Deploy (single-tenant) e operação

Modelo: **um deploy isolado por escritório**. Cada firm = projeto Supabase Cloud próprio
(região `sa-east-1`, PITR ligado) + serviços próprios (web na Vercel ou Railway, **worker
sempre na Railway** porque é processo longo) + domínio próprio. O runbook reproduzível
está em `clients/demo/RUNBOOK.md` (§0–§11): provisiona Supabase → `db:push` + `db:types`
→ `seed` (firm + usuários) → aplica `clients/demo/config.json` em `firms.config` →
credenciais (Anthropic, Resend) → deploy web+worker → DNS → smoke test dos 6 fluxos →
checklist de segurança → rollback.

Os **três botões de customização** (`docs/ONBOARDING.md`): (1) infraestrutura por firm,
(2) integrações por env var (factory escolhe adapter — sem chave, vira no-op), (3) config
de negócio em `firms.config` (sem deploy). Cliente #2 = repetir o runbook com novo
`FIRM_ID`, novo `clients/<firm>/config.json` e novo domínio — **sem mudar código**.

`clients/demo/` só tem `config.json`, `RUNBOOK.md`, `README.md` e um `package.json`
placeholder. Nenhuma lógica — coerente com a regra "cliente só carrega config".

---

## 16. Documentos do projeto (onde aprender mais)

| Doc                       | Conteúdo                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `CLAUDE.md`               | regras de engenharia e UX (as 11 regras de ouro + checklist de UX)                   |
| `docs/PLANEJAMENTO.md`    | visão, escopo M1–M11, modelo de dados, máquinas de estado                            |
| `docs/TAREFAS.md`         | as 25 tarefas com critérios de aceite                                                |
| `docs/HARDENING.md`       | checklist de segurança (RLS, rota pública, escopo do worker, backups)                |
| `docs/ONBOARDING.md`      | modelo de setup e os três botões de customização                                     |
| `docs/ADAPTERS.md`        | catálogo de integrações futuras (viabilidade, custo, esforço)                        |
| `docs/GUIA-DO-PRODUTO.md` | conhecimento de domínio + visão comercial (longo)                                    |
| `docs/guias/*`            | guias das fases futuras (entrada de docs, XML, conciliação, atendimento, relatórios) |
| `clients/demo/RUNBOOK.md` | passo a passo de produção                                                            |

---

## 17. Entrada multicanal e atendimento (WhatsApp/IMAP)

Duas features que **somam** ao que já existia sem reescrever o miolo: a triagem por
IA (§9.4) e a fila de exceções continuam idênticas — ganharam só novas **bocas de
entrada** e um destino novo (atendimento). É a aplicação literal da regra "a borda é
adapter, o miolo é nativo" (guias em `docs/guias/`).

### 17.1 A ideia em uma frase

Toda mensagem que chega — foto/PDF no WhatsApp, e-mail com anexo, dúvida em texto —
é **normalizada para um formato único** e roteada por uma função pura do `core`:
anexo → triagem de documento (a mesma de sempre); texto → atendimento; nada → fila de
exceções (nunca some, regra de ouro #6).

```
[webhook WhatsApp]  ─┐                         ┌─► pgmq:triage  → jobs/triage.ts (já existia)
                     ├─ decideInboundRouting ──┼─► pgmq:support → jobs/support.ts (IA responde/escala)
[cron IMAP poll]    ─┘   (@hub/core, puro)      └─► exception_queue (source 'inbound')
```

### 17.2 O domínio puro (`packages/core`)

- `inbound.ts` — `classifyInboundKind({hasAttachment,text})` → `document|question|unknown`
  (anexo vence: foto da nota com legenda ainda é documento) e `decideInboundRouting`
  → `triage|support|exception`. Mais `normalizeInboundPhone`/`normalizeInboundEmail`.
- `support.ts` — máquina de estados do ticket (`open → pending|escalated|resolved`,
  reabre no novo inbound via `statusAfterInbound`), `decideSupportResponse` (a IA só
  responde se **ligada + no escopo + confiante**; senão escala — golden rule #5,
  igual ao `decideTriage`) e `isWithin24hWindow` (janela grátis do WhatsApp). Tudo com
  teste ao lado (`inbound.test.ts`, `support.test.ts`).

### 17.3 Os adapters (`packages/adapters`) — a borda

- `whatsapp.ts` (`MetaWhatsappAdapter`): **Cloud API oficial** (libs não-oficiais são
  proibidas, `docs/ADAPTERS.md` §3). `parseInbound`/`verifySignature` (HMAC do app
  secret) são **puros** e testados; `downloadMedia`/`sendText` usam `fetch`. Um único
  adapter serve três features (entrada, atendimento, e relatórios no futuro).
- `inbound-imap.ts` (`ImapFlowInboundAdapter`): IMAP genérico, `imapflow`+`mailparser`
  carregados por **import preguiçoso** (`import('imapflow' as string)`) — a web nunca
  os empacota; só o cron do worker os usa.
- `support-assistant.ts` (`AnthropicSupportAssistant`): IA que rascunha resposta +
  julga escopo + confiança (tool use forçado, igual `classification.ts`). Fallback
  heurístico escala tudo p/ humano.
- Todos com factory por env e fallback no-op (golden rule #3): **sem chave, a feature
  fica desligada, o app roda igual**.

### 17.4 Banco (`packages/db`, migration `..._inbound_and_support.sql`)

- `inbound_messages` (único `(firm_id, channel, external_id)` = idempotência: re-entrega
  do WhatsApp / re-poll do IMAP vira no-op). `support_tickets` (1 por contato, reusado/
  reaberto) + `support_messages` (FK composta `(firm_id, ticket_id)`). RLS select-only;
  escrita pelo worker ou por RPCs.
- Filas novas: `inbound`, `support` (+ DLQ). `documents.source` e `exception_queue.source`
  ganham `'inbound'`.
- RPCs `security definer`: `record_inbound_message` (webhook captura + enfileira, só
  `service_role`), `reply_support_ticket` (humano responde de `/atendimento` → enfileira
  entrega), `set_support_status` (escalar/resolver). Use cases em `src/support.ts`.

### 17.5 Worker (`apps/worker`)

- `jobs/inbound.ts` — handler da fila `inbound` (WhatsApp: baixa a mídia e roteia) +
  helpers compartilhados `ingestInboundDocument` (→ Storage + `documents` + `pgmq:triage`)
  e `ingestInboundQuestion` (abre/reabre ticket + `pgmq:support`). Idempotente pelo
  `status` de `inbound_messages`.
- `jobs/imap-poll.ts` — cron `inbound-imap` (só agendado se `imapConfigured()`): busca
  não-lidos, grava idempotente, roteia **inline** (já tem os bytes), marca `\Seen`.
- `jobs/support.ts` — handler da fila `support`. `kind:'inbound'`: monta contexto da
  empresa (status, pendências, prazo mais próximo), chama o assistente, `decideSupportResponse`
  → responde no WhatsApp **ou** escala (e, dentro da janela 24h grátis, manda um aviso
  pt-BR). `kind:'deliver'`: envia a resposta humana enfileirada e marca entregue/falha.

### 17.6 Web (`apps/web`)

- `app/api/webhooks/whatsapp/route.ts` — `GET` responde o handshake do Meta; `POST`
  valida a assinatura, chama `record_inbound_message` (service role) e devolve 200
  rápido. Sem sessão de firm: resolve por `FIRM_ID` ou o único `firms`.
- `/atendimento` — fila de tickets no mesmo padrão de `/excecoes`: `DataList` +
  `DetailDrawer` com a conversa, caixa de resposta e botões assumir/resolver. Badge de
  contagem na sidebar (abertos + escalados).
- `/configuracoes` — nova seção "Atendimento": liga/desliga a resposta automática da IA
  e o limite de confiança (persistidos em `firms.config.support`).

### 17.7 O que é manual no deploy (precisa de credencial real)

Aplicar a migration no Cloud (`pnpm --filter @hub/db db:push` + `db:types`); criar o
WABA/número no Meta Business e preencher `WHATSAPP_*`; apontar o webhook para
`/api/webhooks/whatsapp`; preencher `IMAP_*` da caixa do escritório. Sem isso, os
adapters ficam em no-op e o resto do produto roda normal.

---

## 18. Glossário rápido

- **Competência** — mês de referência fiscal/contábil (ex.: `2026-06`).
- **CNPJ** — identificador da empresa (14 dígitos com dígito verificador).
- **NF-e / XML** — nota fiscal eletrônica; o XML autorizado é imutável.
- **CFOP** — código fiscal da operação; mapeado de "origem" para "entrada" por regra.
- **Certidão / prazo monitorado** — obrigação datada que o motor de prazos vigia.
- **Handoff** — passar a tarefa concluída para o próximo setor.
- **Triagem** — classificar e arquivar documento que chegou solto.
- **Entrada multicanal** — bocas de entrada (WhatsApp/IMAP) que normalizam a mensagem e alimentam a triagem ou o atendimento (§17).
- **Atendimento / ticket** — conversa de dúvida do cliente; a IA responde o trivial e escala o resto para um humano.
- **Farol** — 🟢🟡🔴⚪, a metáfora visual central de status.
- **Exceção** — item na fila genérica quando uma automação não pôde decidir sozinha.
- **Adapter** — interface que esconde uma integração externa atrás de implementações trocáveis.
- **RLS** — Row Level Security do Postgres: isola linhas por `firm_id`.
- **pgmq** — filas dentro do Postgres (Supabase) para o worker consumir.
- **DLQ** — dead-letter queue: para onde vai a mensagem que falhou 3x.

---

_Fim da aula. Próximo passo prático sugerido: abra `packages/core/src/task.test.ts` e
`packages/core/src/task.ts` lado a lado — em 5 minutos você entende o padrão "teste como
especificação" que se repete em todo o `core`._
