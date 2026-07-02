# Guia de teste manual — Hub Contábil (ponta a ponta)

> Roteiro para você validar **todos os módulos como um usuário real** (uma contadora
> usando o sistema). Siga na ordem — é uma "jornada de um mês no escritório". Cada
> cenário tem **Objetivo → Passos → Esperado**. Marque `[x]` conforme for testando.

---

## 0. Antes de começar (setup)

### 0.1 Suba os dois serviços
Em dois terminais, na raiz do repositório:

```bash
pnpm --filter @hub/web dev       # web em http://localhost:3000
pnpm --filter @hub/worker dev    # worker (filas, crons, IA, WhatsApp)
```

> ⚠️ **O worker precisa estar rodando** para os fluxos assíncronos: triagem por IA,
> prazos, solicitações, exportação, enriquecimento e **entrada/atendimento por WhatsApp**.
> Sem ele, você cria as coisas mas nada é processado. Garanta que só há **um** worker
> deste projeto rodando.

### 0.2 Acelere os crons (para testar prazos e lembretes em segundos)
Por padrão os crons rodam em horário de produção (prazos às 06:00, recorrências no dia 1,
lembretes de hora em hora). Para testar sem esperar, edite `apps/worker/.env`:

```
CRON_ACCELERATED=true
```

e **reinicie o worker**. Agora `deadlines-daily`, `recurrences-monthly` e `alerts`
disparam a cada ~10s. (Reverta para `false` quando terminar.)

### 0.3 Entre no sistema
Abra `http://localhost:3000` → você é levado ao **/login**.

| Usuário | E-mail | Papel | Para quê |
| --- | --- | --- | --- |
| Dono | `owner@demo.test` | owner | vê tudo (use este como principal) |
| Gerente | `manager@demo.test` | manager | vê tudo |
| Colaborador | `staff@demo.test` | staff | só vê o(s) setor(es) dele — use para testar **handoff** e **RLS** |

Senha (todos): **`hub-dev-2026!`** (ou o valor de `SEED_PASSWORD`).

### 0.4 Estado inicial
O escritório Demo já vem com dados de exemplo (~21 empresas, algumas tarefas e
documentos). Você pode trabalhar sobre eles ou criar novos. Para um teste "limpo", crie
suas próprias empresas com um prefixo reconhecível no nome (ex.: "ZZ Teste …").

---

## Bloco A — Entrada e visão geral

### A1. Login e proteção de rota
- [ ] **Objetivo:** provar que rota protegida exige sessão.
- **Passos:** deslogado, tente abrir `http://localhost:3000/tarefas` na barra do navegador.
- **Esperado:** redireciona para **/login**. Após logar como `owner@demo.test`, você cai em **/início**.

### A2. Dashboard (farol)
- [ ] **Objetivo:** "números antes de tabelas" + painel de farol.
- **Passos:** na tela **Início**, observe os cards (Tarefas, Exceções, Prazos, Empresas, Documentos, Solicitações). Clique no card **Empresas**.
- **Esperado:** cada card mostra um número; clicar leva à lista filtrada correspondente. Abaixo, o **Painel das Empresas** lista empresas com um **farol** (🟢🟡🔴⚪), ordenadas por gravidade (vermelho primeiro).

---

## Bloco B — Cadastro de empresas

### B1. Criar empresa (validação de CNPJ)
- [ ] **Objetivo:** CRUD + validação de dígito verificador.
- **Passos:** **Empresas → Nova empresa**. Digite um CNPJ **inválido** (ex.: `11.111.111/1111-11`) e tente salvar. Depois corrija para um **CNPJ válido real** (ex.: `47.960.950/0001-21` — Magazine Luiza), preencha a razão social e salve.
- **Esperado:** CNPJ inválido é **rejeitado com mensagem em pt-BR**; CNPJ válido cria a empresa e te leva ao detalhe dela.

### B2. Enriquecimento automático (adapter BrasilAPI)
- [ ] **Objetivo:** o worker preenche dados oficiais pelo CNPJ.
- **Passos:** logo após criar a empresa do B1 (com CNPJ real), aguarde alguns segundos e **recarregue** a página de detalhe. (Se necessário, clique em **Enriquecer**.)
- **Esperado:** razão social, CNAE, cidade/UF aparecem preenchidos a partir da Receita/BrasilAPI. Campos que você já tinha digitado **não são sobrescritos**.

### B3. Onboarding por planilha
- [ ] **Objetivo:** importar várias empresas de uma vez, com validação por linha.
- **Passos:** **Empresas → Importar**. Baixe o **modelo** (CSV), preencha ~5 linhas (inclua 1 CNPJ inválido e 1 repetido de propósito), faça upload → veja a **prévia** → confirme.
- **Esperado:** a prévia marca cada linha (**válida / inválida / duplicada**) com o motivo em pt-BR; só as válidas são importadas; as válidas entram para enriquecimento.

---

## Bloco C — Operação (tarefas)

### C1. Criar tarefa + máquina de estados
- [ ] **Objetivo:** transições válidas/ inválidas.
- **Passos:** **Tarefas → Nova tarefa**. Escolha empresa, setor, título, competência (AAAA-MM). Salve. Abra a tarefa e mova **Pendente → Em andamento → Concluída**.
- **Esperado:** as transições seguem a ordem; não há atalho de Pendente direto para Concluída. Tarefa aparece na coluna certa do quadro.

### C2. Handoff entre setores
- [ ] **Objetivo:** concluir com repasse cria a tarefa do próximo setor + notificação.
- **Passos:** crie uma tarefa com um **setor de destino (handoff)**. Conclua-a com **"Concluir e repassar"**.
- **Esperado:** surge automaticamente uma **nova tarefa no setor de destino**, ligada à anterior, e uma **notificação** (sino no topo). Faça login como `staff@demo.test` do setor de destino e confirme que ele **vê** a tarefa (e **não** vê tarefas de outros setores → RLS).

### C3. Tarefas recorrentes (cron)
- [ ] **Objetivo:** template gera as tarefas do período, idempotente.
- **Passos:** **Tarefas → Recorrentes → Novo template** (título, setor, dia de geração, alvo: todas/seleção/por regime). Com **crons acelerados** (0.2), aguarde ~15s.
- **Esperado:** o cron gera uma tarefa por empresa-alvo para o período atual. Rodar de novo **não duplica**.

---

## Bloco D — Documentos e IA

### D1. Repositório de documentos (upload + dedup)
- [ ] **Objetivo:** upload organizado + detecção de duplicado por hash.
- **Passos:** **Documentos → Enviar**. Suba um PDF escolhendo empresa/competência. Suba **o mesmo arquivo** de novo.
- **Esperado:** o primeiro é arquivado na pasta certa; o segundo é **sinalizado como duplicado** (mesmo hash).

### D2. Triagem por IA (inbox → classifica ou exceção)
- [ ] **Objetivo:** documento "solto" é classificado pela IA ou cai em exceção.
- **Passos:** **Documentos → Inbox** (envio sem escolher empresa). Suba um PDF qualquer. Aguarde alguns segundos (worker).
- **Esperado:** o documento aparece **classificado** (badge "classificado por IA") **ou**, se a IA ficar abaixo do limite de confiança / não achar a empresa, vira um item em **Exceções** com uma **sugestão pré-preenchida**. (A IA nunca decide sozinha em caso ambíguo.)

### D3. Fila de exceções (resolver + "salvar como regra")
- [ ] **Objetivo:** resolver exceção e ensinar o sistema.
- **Passos:** **Exceções** (badge na sidebar mostra a contagem). Abra um item → leia o contexto em pt-BR → **Resolver** (com nota) ou, se for caso de regra, **Salvar como regra**.
- **Esperado:** o item sai de "abertas"; a resolução registra autor e data (auditoria). Se salvou como regra, o **próximo caso idêntico se resolve sozinho**.

### D4. Regras / CFOP (NF-e XML, sem IA)
- [ ] **Objetivo:** parser determinístico de NF-e + resolução de CFOP por regra.
- **Passos:** vá em **`/regras`** (por URL) → crie uma regra de domínio **cfop** (ex.: CFOP de origem `5102` → CFOP de entrada `1102`). Depois suba um **NF-e XML** cujo item tenha CFOP `5102`. (Sample abaixo — salve como `nfe-teste.xml`.)
- **Esperado:** o CFOP de entrada é gravado em `documents.metadata` (o XML **não é alterado**). Sem regra que case → vira **pendência** em Exceções (origem `rules`).

<details><summary>Sample NF-e XML mínimo</summary>

```xml
<?xml version="1.0"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe35200147960950000121550010000000031000000017">
<emit><CNPJ>47960950000121</CNPJ></emit>
<det nItem="1"><prod><CFOP>5102</CFOP></prod></det>
</infNFe></NFe></nfeProc>
```
</details>

---

## Bloco E — Prazos (deadline engine)

### E1. Prazo monitorado + vencimento (cron)
- [ ] **Objetivo:** status muda sozinho e cria tarefa de renovação ao vencer.
- **Passos:** abra uma empresa → aba **Prazos** → adicione um documento monitorado (ex.: "Certidão") com **vencimento no passado** (ex.: ontem). Com **crons acelerados**, aguarde ~15s e recarregue.
- **Esperado:** o status vira **Vencido (🔴)**; é emitido **alerta** (notificação + e-mail via adapter) e criada **exatamente uma** tarefa "Renovar Certidão — {empresa}". Rodar de novo **não cria outra** (idempotente). O **farol da empresa** no dashboard fica vermelho.

---

## Bloco F — Solicitações + página pública

### F1. Pedir documento ao cliente
- [ ] **Objetivo:** criar solicitação com link público assinado.
- **Passos:** na empresa → aba **Solicitações** → **Solicitar documento** (título + tipo). Copie o **link** gerado (**Copiar link**).
- **Esperado:** solicitação criada (status "Solicitado/Enviado"); o link tem o formato `/s/{token}`.

### F2. Página pública `/s/{token}` (o cliente)
- [ ] **Objetivo:** a tela mais simples do produto — o cliente vê e envia.
- **Passos:** abra o link copiado em uma **aba anônima** (sem sessão). Faça o **upload** de um arquivo.
- **Esperado:** página limpíssima (logo + 1 frase + 1 ação). Ao abrir, a solicitação passa a **"Visualizado"** (registra data/IP). Após o upload, vira **"Recebido"**, o arquivo entra no repositório com origem `request` e **vai para a triagem**. Link expirado mostra tela de expiração.

### F3. Lembrete automático (cron `alerts`)
- [ ] **Objetivo:** solicitação parada é lembrada.
- **Passos:** com **crons acelerados**, deixe uma solicitação em "Enviado" sem resposta e aguarde alguns ciclos.
- **Esperado:** o worker rotaciona o token e reenvia (ou, sem e-mail de contato, gera exceção com sugestão "adicionar e-mail"). Registra evento na linha do tempo da solicitação.

---

## Bloco G — Entrada por WhatsApp + Atendimento (módulos novos)

> Estes módulos usam a **Meta Cloud API real**. Como o webhook precisa ser alcançável
> pela Meta, use uma das opções abaixo.

### Opção 1 (rápida, sem túnel): simulador assinado
Um helper POSTa um **webhook assinado de verdade** na rota real (e, no modo documento,
sobe um PDF real para a Meta e usa o media id real → o worker baixa da Meta). Rode na
raiz do repo (web + worker de pé):

```bash
node apps/worker/scripts/whatsapp-sim.mjs text "Olá, minha guia deste mês já saiu?"
node apps/worker/scripts/whatsapp-sim.mjs doc            # gera um PDF mínimo
node apps/worker/scripts/whatsapp-sim.mjs doc /caminho/nota.pdf
```

### Opção 2 (100% real): túnel + celular
1. Exponha o web: `npx cloudflared tunnel --url http://localhost:3000` (ou ngrok).
2. No painel da Meta (**WhatsApp → Configuration → Webhook**): Callback URL = `https://<seu-tunel>/api/webhooks/whatsapp`, Verify Token = valor de `WHATSAPP_VERIFY_TOKEN`, assine o campo **messages**.
3. Do seu celular, mande uma mensagem (ou um PDF) para o número de teste **+1 555 656-8634**.

> ⏰ **O token do WhatsApp é temporário (~24h).** Se as chamadas à Meta começarem a dar
> 401, gere um novo token no painel e atualize `WHATSAPP_ACCESS_TOKEN` em
> `apps/worker/.env` e `apps/web/.env.local`, e reinicie worker + web.

### G1. Pergunta de texto → ticket de atendimento
- [ ] **Passos:** rode o simulador em modo `text` (ou mande uma mensagem real). Abra **Atendimento** na sidebar.
- **Esperado:** um **ticket** aparece (contato "Cliente Teste"), com a mensagem do cliente na conversa. Com auto-reply **desligado** (padrão), o ticket fica **Encaminhado (🔴 "Com você")**. Abra o ticket → escreva uma resposta → **Responder**. A resposta é enfileirada e enviada pelo WhatsApp (worker).

### G2. IA responde sozinha (opcional)
- [ ] **Passos:** em **Configurações**, ligue o **auto-atendimento por IA** (support.autoReply) e defina um limiar. Mande uma pergunta simples pelo simulador.
- **Esperado:** se a IA estiver confiante e no escopo, ela **responde sozinha** (ticket vai para "Aguardando cliente", marcado "Respondido pela IA"); se não, **escala para um humano**. (A IA nunca responde caso ambíguo.)

### G3. Documento por WhatsApp → triagem
- [ ] **Passos:** rode o simulador em modo `doc` (ou mande um PDF real do celular). Abra **Documentos** (e **Exceções**).
- **Esperado:** o worker **baixa o arquivo da Meta**, arquiva com origem `inbound` e **manda para a triagem** — igual a um upload no inbox. Documento sem CNPJ conhecido/baixa confiança cai em **Exceções** (nada se perde).

---

## Bloco H — Exportação para o ERP

### H1. Gerar lote
- [ ] **Objetivo:** empacotar documentos + manifesto, excluindo CFOP pendente.
- **Passos:** vá em **`/exportacao`** (por URL) → filtre (empresas, competência, tipos) → **Gerar lote**. Aguarde o worker (status vira "Pronto") e **baixe o .zip**.
- **Esperado:** o zip traz os arquivos **renomeados pela convenção** + `manifest.json`/`manifest.csv` (com hashes e CFOPs aplicados). Documentos com **CFOP pendente ficam de fora**, listados com aviso.

---

## Bloco I — Configuração, notificações, ajuda

### I1. Configurações refletem no comportamento
- [ ] **Passos:** ícone de engrenagem (topo) → **Configurações**. Mude o **prazo de alerta padrão** (ex.: de 30 para 15 dias) e salve. Coloque um valor inválido para ver a validação.
- **Esperado:** valor válido é salvo e passa a valer; inválido é **rejeitado com mensagem pt-BR**.

### I2. Notificações e badges
- [ ] **Passos:** observe o **sino** no topo (notificações de handoff/alertas) e os **badges de contagem** na sidebar (Atendimento, Exceções, Solicitações).
- **Esperado:** badges refletem as filas abertas; abrir/΄resolver itens atualiza as contagens.

### I3. Ajuda
- [ ] **Passos:** ícone de interrogação (topo) → **Ajuda**.
- **Esperado:** página de ajuda/tutorial carrega.

---

## Encerramento

- [ ] **Reverta `CRON_ACCELERATED=false`** em `apps/worker/.env` e reinicie o worker.
- [ ] Se criou dados de teste ("ZZ Teste …"), arquive/apague pelo próprio sistema.
- [ ] Lembre que o **token do WhatsApp expira em ~24h** — para uso contínuo, troque por um **system-user token** permanente no painel da Meta.

### Checklist de cobertura
Login · Dashboard/farol · Empresa (CNPJ) · Enriquecimento · Planilha · Tarefas · Handoff ·
Recorrentes · Documentos · Triagem IA · Exceções · Regras/CFOP · Prazos · Solicitações ·
Página pública · Lembrete · **WhatsApp texto** · **Atendimento** · **WhatsApp documento** ·
Exportação · Configurações · Notificações · Ajuda.
