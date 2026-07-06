# Relatório — Fase 1.1 · Resposta ao documento do Paulo

*06/07/2026 · referente a `hub-contabil-fase-1.2.docx` ("Especificação de melhorias — Fase 1.1")*

> **Adendo (06/07, após as respostas do Paulo):**
>
> 1. **Departamento de boleto/comprovante/planilha depende do conteúdo** — implementado:
>    esses tipos não têm mais rota fixa; a IA lê o documento e sugere o departamento
>    pelo conteúdo (ex.: comprovante de folha → DP, boleto de imposto → Fiscal). O mapa
>    de roteamento continua valendo como regra fixa para quem quiser, e a trava de
>    confiança continua mandando os casos duvidosos para um humano.
> 2. **"Busca de arquivo pelo chat"** — o item veio do documento do Paulo ("busca de
>    arquivo no servidor pelo próprio chat"); o que entendemos: o cliente pede um
>    documento na conversa (ex.: "me manda o DAS de junho") e o robô localiza no
>    repositório e envia. Aguardando o Paulo confirmar se era isso — e vale a ressalva
>    de segurança: só faz sentido depois de consolidar o vínculo telefone↔empresa.
> 3. **Menu de recepção (URA) — implementado**: novas conversas no WhatsApp são
>    recebidas com o menu numerado de departamentos (boas-vindas, opções e rótulos
>    configuráveis em Configurações → Menu de recepção; "voltar" reabre o menu, "fim"
>    encerra). A escolha marca a conversa com o departamento, e o Atendimento agora
>    mostra e filtra por departamento. Vem **desligado por padrão** — é ligar e
>    cadastrar as opções (formato "Rótulo | departamento").
> 4. **Kanban deixar de ser padrão** — ok do Paulo registrado; entra na proposta da
>    tela "Obrigações do mês" (Etapa A), que ainda depende do workshop de estados.

## Resumo executivo

Todos os itens dos blocos **1 (Cadastro)**, **3 (Documentos)** e **4 (Atendimento)** foram
implementados ou corrigidos e **já estão em produção** (web na Vercel, worker no Railway,
migrations aplicadas no Supabase Cloud). Do bloco **2**, os três sub-itens objetivos
(tarefas por regime no cadastro, filtro de mês, filtro de departamento) estão prontos;
a **unificação Tarefas/Prazos/Solicitações não foi implementada** — é decisão de
arquitetura e há um parecer no final deste documento.

**Uma única ação pendente do Levi destrava o WhatsApp inteiro: gerar o token permanente
da Meta** (o atual era temporário e expirou em 01/07 — ver §4).

---

## 1. Cadastro

### 1.1 Novos campos (não obrigatórios) — ✅ feito

Todos os campos pedidos existem no cadastro, nenhum obrigatório: natureza jurídica,
enquadramento (porte), regime de tributação (já existia), inscrição estadual, inscrição
municipal, NIRE + data, data de início das atividades, data de início da prestação de
serviço, endereço completo (logradouro, número, complemento, bairro, CEP, cidade, UF),
capital social, CNAE (código + descrição) e **sócios** (cadastro próprio, com
qualificação, CPF/CNPJ, participação % e data de entrada — nada obrigatório além do nome).

- Na tela da empresa, os campos ficam em **"Mais dados cadastrais"** (colapsado — a tela
  principal continua enxuta) e os sócios têm seção própria na aba Dados.
- O enriquecimento por CNPJ agora **preenche automaticamente** natureza jurídica, porte,
  capital social, data de início, CNAE, endereço completo e o **quadro societário (QSA)**
  — sem apagar nada preenchido à mão (regra: só completa campo vazio).
- Ficam manuais (as APIs públicas não fornecem): inscrição estadual, inscrição municipal,
  NIRE e data de início da prestação de serviço.

**Enriquecimento "não funciona"** — o motivo real: no import em massa de 29/06, as APIs
bloquearam por excesso de chamadas (BrasilAPI 403 + ReceitaWS 429, que só aceita 3/min)
e 11 empresas ficaram travadas em "enriquecendo". Corrigido: espaçamento por fonte
(ReceitaWS a cada 21s), correção de um bug de timeout que abortava chamadas na fila, e as
11 empresas foram reprocessadas em produção.

### 1.2 CNPJ primeiro — ✅ feito

A tela "Nova empresa" agora começa **só com o CNPJ**: digita → "Buscar dados do CNPJ" →
o formulário aparece **inteiro preenchido** (razão social, endereço, CNAE, capital,
sócios…) para revisar e salvar. Se a API estiver fora, um aviso aparece e o preenchimento
manual continua funcionando. O cadastro também dispara na hora as tarefas recorrentes do
mês (ver §2).

### 1.3 Contato por departamento — ✅ feito

Cada contato pode ser marcado com os departamentos que atende (Fiscal, Contábil, DP,
Societário/Compliance) — **sem marcação = "Todos"**. Como combinado, é regra
determinística de cadastro, não IA:

- Ao **enviar uma solicitação de documento**, o sistema sugere o contato do departamento
  responsável pelo tipo de documento pedido (ex.: guia de imposto → contato Fiscal).
  O mais específico vence o "Todos"; entre iguais, vence o contato principal.
- Quem envia **sempre pode trocar** o destinatário na hora (campo de e-mail livre).
- Os **lembretes automáticos** de solicitação usam a mesma regra.

---

## 2. Tarefas, prazos e solicitações

### Sub-itens — ✅ feitos

- **Regra automática por regime**: ao cadastrar (ou importar) uma empresa, as tarefas
  recorrentes do mês atual que se aplicam a ela (por regime, seleção ou "todas") são
  criadas **na hora** — antes só no dia 1º do mês seguinte. Ex.: template "Apuração
  mensal" para Simples Nacional → empresa do Simples já nasce com a tarefa.
  *Observação: os templates são cadastrados em Tarefas → Recorrentes. Se quiserem
  padrão PGDAS/DAS por regime já configurado, é criar os templates lá (5 min).*
- **Filtro padrão = mês atual com setas**: a tela de tarefas abre em « Julho 2026 » com
  navegação ‹ ›, atalho "voltar ao mês atual" e opção "todos os meses". Tarefas sem
  competência continuam sempre visíveis.
- **Filtro de departamento para o Sócio/Owner**: chips de um clique (Todos · Fiscal ·
  Contábil · DP · Societário) na própria tela.

### Unificação dos três módulos — ⏸ não implementada (decisão pendente)

Ver o **parecer** no final do documento.

---

## 3. Documentos

### "Falta busca" — ✅ corrigido (a busca existia, mas estava invisível)

A busca estava dentro de um painel de filtros colapsado — na prática, não existia para o
usuário. Agora:

- **Barra de busca sempre visível**, inclusive **antes de escolher empresa** (busca em
  todas as empresas de uma vez, mostrando de qual empresa é cada resultado).
- **Filtro de departamento sempre visível** dentro da empresa (o item "filtrar por
  departamento" já existia parcialmente — mesma causa: filtro escondido).
- Competência e tipo continuam em "Mais filtros" (colapsado), como filtros avançados.
- **"Caixa de entrada"**: documentos que a triagem não conseguiu arquivar em uma empresa
  ficavam **invisíveis** (não apareciam em lugar nenhum do repositório). Agora aparecem
  numa seção própria com contador, com atalho para resolver nas Exceções.

### "Classificação por IA errada" — ✅ corrigido nas causas raiz

Diagnóstico importante: **a IA estava classificando bem** (NF-e com 99% de confiança,
DAS com 98%, contrato social com 92% nos casos reais de produção). O que estava quebrado
era o que acontecia **depois** da classificação:

1. **O laço de aprendizado nunca fechava.** Quando um humano resolvia uma exceção, a
   correção não era aplicada ao documento nem virava exemplo para a IA. Agora a exceção
   de triagem tem o botão **"Arquivar documento"**: você confirma/ajusta tipo, empresa e
   departamento, o documento é arquivado ali mesmo, e a decisão vira **exemplo que a IA
   passa a consultar** nas próximas classificações (few-shot). Quanto mais correções,
   melhor ela fica.
2. **Três tipos não tinham departamento**: boleto, comprovante de pagamento e planilha
   não estavam no mapa de roteamento — mesmo com 98% de certeza caíam em exceção.
   Ganharam rota padrão → **Contábil** (⚠ confirmar com o Paulo se é o destino certo;
   é configurável por escritório).
3. **XML que não era NF-e virava "outros"** sem passar pela IA (NFS-e, CT-e em XML).
   Agora cai no classificador por texto.
4. A tela de exceções mostrava a sugestão da IA como **código JSON cru** — agora mostra
   "das · confiança 98% · CNPJ 50.332…" e o motivo em português ("Empresa não encontrada
   pelo CNPJ").
5. Detalhe honesto: a maioria das exceções reais era **"empresa não encontrada"** — o
   CNPJ do documento não estava cadastrado no sistema. Isso não é erro da IA; com a
   carteira completa cadastrada, esses casos somem.

---

## 4. Atendimento (WhatsApp)

### Causa raiz encontrada — os dois bugs eram a mesma coisa

**O token de acesso do WhatsApp expirou em 01/07 às 22h (PDT).** Era um "token temporário"
do painel da Meta, que dura 24h. Com ele vencido:

- **respostas falhavam** (`401 Authentication Error` — confirmado nos logs e no banco:
  toda resposta até 01/07 = entregue, toda resposta depois = falha);
- **documentos recebidos não eram triados** — o download da mídia usa o mesmo token, o
  arquivo nunca chegava à triagem (por isso "a triagem não identifica o documento").

Respondendo o `[verificar]` do Paulo: **(a) a integração JÁ É a API oficial da Meta**
(WhatsApp Cloud API — bibliotecas não-oficiais são proibidas no projeto) e **(b) a
triagem JÁ ESTAVA implementada para o canal** — anexo do WhatsApp entra na mesma fila
da triagem do upload manual. Não é problema de arquitetura; era credencial vencida.

### 🔑 Ação necessária do Levi (única pendência que bloqueia)

Gerar um **token permanente** (não expira) e substituir o temporário:

1. [business.facebook.com](https://business.facebook.com) → **Configurações do negócio**
   → Usuários → **Usuários do sistema** → criar (ou usar) um usuário do sistema *admin*.
2. **Adicionar ativos** → o app do WhatsApp → acesso total.
3. **Gerar token** → selecionar o app → marcar as permissões
   `whatsapp_business_messaging` e `whatsapp_business_management` → expiração: **nunca**.
4. Atualizar `WHATSAPP_ACCESS_TOKEN` **nos dois lugares**: Railway (worker) e Vercel (web),
   e redeployar os dois.

### Correções de código feitas (além do token)

- **Falha silenciosa eliminada**: sem credenciais configuradas, o sistema marcava a
  resposta como "entregue" sem enviar nada. Agora marca **"falha no envio"** e abre
  exceção — nunca mais finge sucesso.
- **Janela de 24h da Meta**: o WhatsApp só aceita texto livre até 24h após a última
  mensagem do cliente. Respostas fora da janela agora falham **na hora, com motivo
  claro**, em vez de erro críptico da API. (Enviar fora da janela exige *templates
  pagos* aprovados pela Meta — fica como decisão futura, ver perguntas ao Paulo.)
- **Documento aparece na conversa**: anexo recebido por WhatsApp agora gera uma linha na
  conversa do atendimento ("📎 Documento recebido: nota.pdf — enviado para a triagem
  automática", com a legenda que o cliente escreveu). Antes, o documento ia direto para
  a triagem e a conversa ficava "muda" — parte da sensação de que nada acontecia.
- **Respostas automáticas configuráveis**: o FAQ do escritório agora existe de verdade —
  em Configurações → Atendimento, uma resposta pronta por linha
  (`Pergunta | Resposta`). A IA usa **somente** o FAQ + os dados da empresa; nunca
  inventa política do escritório. (O campo existia no código, mas estava fixo em vazio.)

### Extras do chatbot pedidos — parcial, com pontos para discutir

- ✅ Respostas automáticas configuráveis (FAQ acima).
- ⏸ **Busca de arquivo pelo próprio chat**: não implementei de propósito. Hoje a
  identidade do remetente é só o número de telefone; entregar documentos do escritório
  por chat sem vínculo forte telefone→empresa é risco real de vazar documento para a
  pessoa errada. Proposta: implementar depois que o vínculo contato↔empresa estiver
  consolidado, e limitado a documentos da empresa do contato. Discutir com o Paulo.
- ⏸ **"Filtro por departamento" do chatbot**: não ficou claro o que significa (rotear
  ticket para departamento? IA responder só sobre certos assuntos?). Precisa de um
  exemplo do Paulo antes de construir.

### Pergunta aberta do Paulo ("repensar o WhatsApp inteiro?")

Minha leitura: **não repensar agora.** A arquitetura está certa (API oficial, adapter
isolado, mesma triagem para todos os canais). Os problemas eram uma credencial vencida
+ lacunas de produto que este ciclo fechou. Vale reavaliar só depois de 2–4 semanas de
uso com o token permanente — aí sim com dados reais (ex.: se a janela de 24h incomodar
muito, o próximo passo é template pago da Meta, não trocar de solução).

---

## Parecer sobre o item 2 (unificação) — para decisão

**O diagnóstico do Paulo está certo; a prescrição, como está escrita, eu não implementaria
de olho fechado.** Em detalhe:

**Por que ele tem razão:** para o contador, "tarefa", "prazo" e "solicitação" são a mesma
coisa — *uma obrigação com ciclo de vida* — e hoje isso está espalhado em 3 telas com 3
vocabulários. A dor é real e a direção (uma visão única por departamento) é boa.

**Por que não dá para implementar literalmente sem especificar:**

1. Os três objetos têm **comportamentos irredutíveis diferentes**: solicitação tem link
   público com token e expiração; tarefa tem repasse entre departamentos (handoff);
   prazo tem status derivado de data (o farol). Fundir as tabelas cria um "super-objeto"
   em que a maioria dos campos não se aplica à maioria das linhas — mais bugs, RLS e
   worker inteiros refeitos.
2. O ciclo citado ("Sem data → Próximo → Protocolado → Vencido / Regularizado") **não
   existe em nenhum documento do projeto** — "Protocolado" e "Regularizado" nunca foram
   especificados. O que é "Protocolado" para uma solicitação de documento? Precisa de
   comprovante anexado? Quem pode marcar "Regularizado"? Sem essas respostas, qualquer
   implementação vai errar.

**O que eu recomendo (caminho em 2 etapas):**

- **Etapa A — unificação de experiência** (custo ~1/5, reversível): uma tela nova
  **"Obrigações do mês"**, por departamento, que agrega os 3 tipos num único fluxo com
  vocabulário unificado por cima dos dados atuais (ex.: prazo vencido e tarefa atrasada
  aparecem juntos como "Vencido"). O kanban deixa de ser a tela padrão. Entrega
  exatamente o que o Paulo descreveu — "um item, um status, uma tela por departamento" —
  sem mexer no modelo de dados.
- **Etapa B — só se a Etapa A não bastar**: unificação real de modelo, especificada com
  os casos que a Etapa A revelar.

**Próximo passo sugerido:** 1h com o Paulo para (1) validar a Etapa A com um rascunho de
tela e (2) definir estado a estado o ciclo por departamento (inclusive "Protocolado" e
"Regularizado"). Com isso escrito, a Etapa A é implementável em um ciclo curto.

---

## Pendências e avisos operacionais

| # | O quê | Quem | Status |
|---|-------|------|--------|
| 1 | Token permanente do WhatsApp (passo a passo no §4) + atualizar Railway e Vercel | **Levi** | 🔴 bloqueia o WhatsApp |
| 2 | `CRON_ACCELERATED=true` está ligado em produção (worker roda TODAS as rotinas a cada 10s — inofensivo, mas gasta recurso e polui log). Recomendo desligar quando o período de teste do Paulo acabar | Levi | 🟡 recomendação |
| 3 | Chave do Resend segue pendente → e-mails de solicitação/lembrete ainda em no-op (não são enviados; o link copiado funciona) | Levi | 🟡 já era conhecido |
| 4 | Rotas padrão: boleto/comprovante/planilha → **Contábil**. Confirmar destino | Paulo | 🟢 configurável |
| 5 | Workshop de 1h: unificação (Etapa A) + estados por departamento | Levi + Paulo | 🟢 agendar |
| 6 | Busca de arquivo pelo chat: definir regra de identidade antes de construir | Levi + Paulo | 🟢 discutir |

## O que foi verificado

- `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test` limpos (241 testes, incluindo
  novos testes de sugestão de contato, enriquecimento estendido, janela de 24h e nota de
  documento na conversa).
- 4 migrations aplicadas no Supabase Cloud (campos de cadastro + sócios, departamentos
  de contato, tarefas recorrentes no cadastro, aplicação de sugestão de triagem).
- Deploy: web na Vercel (`hub-contabil-eight.vercel.app`, READY) e worker no Railway
  (SUCCESS, logs saudáveis).
- As 11 empresas com enriquecimento travado foram reprocessadas em produção com sucesso
  (21 empresas enriquecidas no total, 19 sócios importados do QSA automaticamente) e as
  11 exceções antigas de enriquecimento foram fechadas.
- Sobra 1 documento de WhatsApp preso de 02/07 (download falhou com o token vencido):
  depois de atualizar o token, é só o Paulo reenviar o arquivo — ou me pedir para
  reprocessar a mensagem presa.

## Como testar (roteiro rápido para o Paulo)

1. **Cadastro**: Empresas → Nova empresa → digitar um CNPJ real → "Buscar dados do CNPJ"
   → conferir formulário preenchido + sócios → salvar → ver "Mais dados cadastrais" e a
   seção Sócios na aba Dados. Se a empresa for do Simples e houver template recorrente
   por regime, a tarefa do mês já aparece em Tarefas.
2. **Contatos**: abrir uma empresa → Contatos → editar um contato e marcar "Fiscal" →
   criar uma solicitação de guia → ao enviar, o e-mail sugerido é o do contato Fiscal
   (e dá para trocar).
3. **Tarefas**: a tela abre no mês atual « Julho 2026 » com chips de departamento.
4. **Documentos**: barra de busca na primeira tela (busca em todas as empresas);
   dentro da empresa, busca + departamento à vista.
5. **Exceções**: abrir uma exceção de triagem → "Arquivar documento" → escolher
   tipo/empresa → o documento aparece no repositório da empresa e a IA aprende.
6. **WhatsApp** (após o token novo): mandar um PDF → aparece na conversa do atendimento
   E na triagem; responder um ticket → entrega (dentro de 24h da última mensagem do
   cliente).
