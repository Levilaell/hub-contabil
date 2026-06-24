# Guia de Domínio do Produto — Hub Contábil

> **Para que serve este documento:** dar a você (que não é contador nem programador)
> domínio completo do sistema, para conduzir conversas de venda e demonstrações com
> propriedade. Ele explica **o mundo do cliente**, **o que o sistema faz**, **por quê**,
> **qual tarefa manual cada parte substitui** e **como vender**.
>
> **Como ler:** as Partes 1 a 5 e 7 não têm nada de técnico — leia tudo. A Parte 6
> (“camada técnica”) é opcional: serve só para você responder perguntas mais fundo.
> A Parte 8 é a verdade interna sobre o que já está construído (não precisa mostrar ao cliente).
> A Parte 9 é um glossário — consulte quando ouvir um termo que não conhece.

---

## Sumário

- **Parte 1 — O mundo do cliente:** como funciona um escritório de contabilidade e onde dói.
- **Parte 2 — O que é o Hub Contábil:** a ideia central em uma página.
- **Parte 3 — Os módulos, um a um:** o que cada parte faz e que trabalho manual elimina.
- **Parte 4 — Um mês na vida do escritório usando o Hub:** tudo conectado, em narrativa.
- **Parte 5 — Tabela “tarefa manual → o que o Hub faz”:** sua cola rápida de venda.
- **Parte 6 — Como é construído (camada técnica, opcional).**
- **Parte 7 — Comercial:** para quem é, diferenciais, concorrentes, objeções, preço, demo.
- **Parte 8 — Estado atual da construção (controle interno).**
- **Parte 9 — Glossário.**

---

# Parte 1 — O mundo do cliente (escritório de contabilidade)

Para vender, você precisa entender a rotina de quem vai comprar. Vou explicar do zero.

## 1.1 O que um escritório de contabilidade faz

Um escritório de contabilidade é terceirizado por **dezenas ou centenas de empresas**
para cuidar de três grandes frentes, todo mês, dentro de prazos legais rígidos:

1. **Impostos** (área Fiscal) — calcular quanto cada empresa cliente deve de imposto e
   gerar a guia de pagamento; entregar as “declarações” obrigatórias ao governo.
2. **Contabilidade** (área Contábil) — registrar formalmente tudo que a empresa
   movimentou (vendas, compras, banco) e fechar os relatórios contábeis (balanço, etc.).
3. **Folha de pagamento / pessoal** (área Pessoal, ou “DP”) — calcular salários, férias,
   13º, admissões e demissões, e as guias de encargos (FGTS, INSS).

E uma quarta frente menor, mas crítica:

4. **Societário / Legalização / Compliance** — abrir/alterar/fechar empresas, manter
   contratos sociais e procurações, e renovar **certidões** e **licenças** (documentos que
   provam que a empresa está “limpa” perante o governo e que **vencem** periodicamente).

> O escritório é, na prática, uma **fábrica de obrigações com prazo**. O produto dele é
> “estar em dia com o governo”. Errar prazo gera multa para o cliente — e o cliente culpa
> o escritório. Por isso, **organização e prazo são vida ou morte** nesse negócio.

## 1.2 Os quatro departamentos (você vai ouvir esses nomes)

| Departamento | Apelido | O que faz, em uma frase |
| --- | --- | --- |
| **Fiscal** | Fiscal | Calcula impostos sobre faturamento/vendas e emite as guias (DAS, DARF, GARE…). |
| **Contábil** | Contábil | Faz a escrituração (o “diário” oficial) e fecha balancetes/balanço. |
| **Pessoal** | DP | Folha de pagamento, eSocial, férias, admissão/demissão, encargos (FGTS/INSS). |
| **Societário** | Compliance/Legalização | Abertura/alteração de empresas, contratos, procurações, certidões e licenças. |

No sistema, isso aparece como **“departamentos”**, e cada empresa cliente passa por vários
deles no mesmo mês. Uma tarefa muitas vezes “anda” de um departamento para o outro — o
**handoff** (veja Módulo de Tarefas).

## 1.3 O ciclo mensal — “competência”

Quase tudo na contabilidade é **mensal** e amarrado a um mês de referência chamado
**competência** (ex.: “competência 05/2026” = movimento de maio de 2026, processado em junho).

Um mês típico:

1. **Início do mês:** chegam os documentos do mês anterior — notas fiscais de venda e de
   compra, extratos bancários, folha. Tudo isso vem **espalhado**: e-mail, WhatsApp, portais,
   pendrive, “o cliente vai mandar”.
2. **Processamento:** Fiscal lança as notas e apura imposto; Contábil escritura; DP roda folha.
3. **Prazos:** ao longo do mês vencem dezenas de **guias** (pagar imposto) e **obrigações
   acessórias** (entregar declarações). Cada empresa tem seu conjunto. Cada dia 20, dia 25, etc.
4. **Entregas e cobrança:** o escritório entrega as guias aos clientes e **cobra documentos
   que faltaram** (“cadê o extrato de maio?”).

Multiplique isso por **250 a 500 empresas** (porte do primeiro cliente, M Rocha) e por
**milhares de notas por mês**. Esse volume é o problema central.

## 1.4 Onde dói hoje (a dor que o produto ataca)

Converse com qualquer dono de escritório e você vai ouvir alguma combinação disto:

- **“Não sei o status de cada empresa.”** Quem está em dia, quem está atrasado, o que falta?
  A informação está na cabeça das pessoas e em planilhas paralelas.
- **“Vivo apagando incêndio de prazo.”** Uma certidão venceu, uma obrigação passou, e só
  descobriram quando veio a multa.
- **“Documento é um caos.”** Notas e arquivos chegam por mil canais e ficam espalhados;
  ninguém acha nada; retrabalho pedindo de novo ao cliente.
- **“Cobro documento do cliente o tempo todo, e ele diz que não recebeu.”** Sem prova de
  quem mandou, quando, e se o cliente viu.
- **“Tudo depende de pessoas-chave.”** Se o funcionário X falta ou sai, o conhecimento vai junto.
- **“Erro de robô some.”** Quando tentam automatizar algo e falha, ninguém vê — vira surpresa depois.
- **“Triagem de documento é trabalho braçal.”** Alguém abre cada PDF para descobrir “que
  documento é esse, de qual empresa, para qual setor vai”.

> **Resumo da dor:** falta de **visibilidade**, perda de **prazo**, **bagunça de documentos**,
> **retrabalho de cobrança** e **trabalho braçal de triagem**. É exatamente isso que o Hub ataca.

## 1.5 O que o Hub **NÃO** é (importante para não vender errado)

O Hub é a **camada de gestão, organização e controle** do escritório. Ele **não**:

- **não substitui o ERP contábil** (AlterData, Domínio, Questor…) — o ERP é onde os
  lançamentos e cálculos fiscais “oficiais” acontecem. O Hub **organiza e alimenta** o ERP.
- **não calcula imposto** nem transmite declarações ao governo;
- **não emite nota fiscal**.

Ele faz o que o ERP **não** faz bem: dar visão clara de status, controlar prazos, organizar
documentos, cobrar o cliente com prova, e tirar o trabalho braçal de triagem e classificação.
Pense nele como o **“painel + linha de produção organizada”** que fica em volta do ERP.

---

# Parte 2 — O que é o Hub Contábil (em uma página)

**Frase de uma linha:**
> Um painel único onde o escritório vê o status de cada empresa, nunca perde um prazo,
> encontra qualquer documento, cobra o cliente com prova de leitura, e deixa a inteligência
> artificial fazer a triagem dos documentos que chegam.

**A metáfora central — o farol (semáforo):**
Cada empresa tem uma “luz”: 🟢 verde (tudo em dia), 🟡 amarelo (algo vence em breve),
🔴 vermelho (algo atrasado), ⚪ cinza (sem dados). Essa mesma luz aparece em todo lugar —
no painel geral, na lista de empresas, na empresa individual. **Em 5 segundos** o dono do
escritório bate o olho e sabe onde está o problema. Esse é o coração visual do produto.

**Os três pilares:**

1. **Organizar** — empresas, tarefas, documentos e responsáveis num lugar só, com setores
   e handoff entre eles.
2. **Não perder prazo** — um motor que vigia vencimentos (guias, certidões, licenças,
   obrigações) e avisa antes, todo dia, automaticamente.
3. **Automatizar a entrada** — IA que recebe os documentos, descobre o que são e de quem
   são, e arquiva no lugar certo; o que ela não tiver certeza vira uma pendência clara para
   um humano resolver (e ela aprende com a resposta).

**O diferencial de experiência (e por que importa):**
A maior razão de sistemas assim **fracassarem** é virar uma tela poluída que ninguém usa.
O Hub foi desenhado com uma regra dura: **uma pergunta por tela, número antes de tabela,
status sempre visual, uma ação principal por tela**. Uma contadora que nunca viu o sistema
entende qualquer tela em 5 segundos. Isso é um argumento de venda real — não é enfeite.

---

# Parte 3 — Os módulos, um a um

Para cada bloco: **o que é**, **qual fluxo contábil resolve** e **qual trabalho manual substitui**.

## Bloco A — Cadastro e entrada de empresas

### Cadastro de empresas (e contatos)
- **O que é:** a “agenda” central de todas as empresas-clientes do escritório. A chave é o
  **CNPJ**. Cada empresa tem regime tributário, cidade, setores e contatos.
- **Diferencial prático — enriquecimento automático de CNPJ:** você digita só o CNPJ e o
  sistema busca sozinho, em bases públicas, a razão social, o endereço, a atividade (CNAE) e
  a situação cadastral. Não precisa digitar tudo à mão.
- **Substitui:** a planilha-mestre de clientes mantida à mão, sempre desatualizada, e a
  digitação manual de cada cadastro.

### Onboarding por planilha
- **O que é:** um assistente passo a passo para **importar todas as empresas de uma vez** a
  partir de uma planilha (CSV/Excel). Ele valida linha por linha, destaca CNPJs inválidos ou
  duplicados, importa o que está certo e lista o que deu erro com o motivo.
- **Substitui:** o trabalho de cadastrar 250–500 empresas uma a uma ao migrar para o sistema.
  Tira a maior barreira de adoção: “vou ter que digitar tudo de novo?” — não, sobe a planilha.

### Usuários, papéis e auditoria
- **O que é:** cada pessoa do escritório tem um **papel** (dono, gerente, ou funcionário de um
  setor) e enxerga só o que lhe cabe. Tudo que qualquer pessoa **ou robô** faz fica registrado
  num **histórico de auditoria** (quem, o quê, quando).
- **Substitui:** o “quem mexeu nisso?” sem resposta, e a falta de controle de acesso.
- **Venda:** segurança e rastreabilidade — importante para escritório que lida com dado fiscal.

## Bloco B — Operação diária

### Tarefas com handoff entre setores
- **O que é:** o trabalho do mês vira **tarefas** por empresa e por competência (ex.: “Apurar
  Simples — Padaria X — 05/2026”). Cada tarefa tem responsável e status. Quando um setor
  termina, a tarefa **passa automaticamente** para o próximo setor (o **handoff**) e a pessoa
  certa é notificada.
- **Fluxo contábil que resolve:** o caminho típico de um documento dentro do escritório —
  Fiscal lança → Contábil escritura → DP/Compliance complementam. Hoje isso é combinado “no
  grito”, por e-mail ou WhatsApp.
- **Substitui:** o controle de “quem está fazendo o quê” em planilha/quadro/cabeça, e o
  retrabalho de avisar manualmente o próximo setor.

### Tarefas recorrentes
- **O que é:** como quase tudo é mensal, você cria um **modelo** uma vez (ex.: “Toda empresa
  do Simples gera a tarefa de apuração no dia 1”) e o sistema **gera as tarefas do mês
  sozinho**, para todas as empresas que se encaixam.
- **Substitui:** recriar manualmente, todo mês, a mesma lista de tarefas para centenas de empresas.

### Fila de exceções (o conceito “nada se perde”)
- **O que é:** uma **caixa única** onde cai **qualquer erro de qualquer automação** do sistema
  — com o contexto explicado em português e, quando possível, uma **sugestão pronta** de como
  resolver, em um clique. Um documento que a IA não soube classificar, uma cobrança que falhou,
  um prazo sem data: tudo vira um item visível aqui, nunca um erro silencioso.
- **Substitui:** o pior cenário do escritório — automação que falha **escondido** e vira
  problema só quando já é multa. Aqui, todo erro é **visível e acionável**.
- **Venda:** este é um diferencial filosófico forte — “**o robô nunca decide sozinho no escuro,
  e nada some**”.

## Bloco C — Documentos

### Repositório de documentos
- **O que é:** o “arquivo” digital do escritório, organizado em hierarquia
  **escritório → empresa → competência/setor**. Sobe arquivo arrastando (inclusive vários de
  uma vez), com busca e pré-visualização. Detecta duplicado automaticamente.
- **Substitui:** pastas no computador, Google Drive bagunçado, e-mails perdidos, “me manda de
  novo aquele arquivo”. Acaba a garimpagem de documento.

### Solicitações de documentos com prova de leitura
- **O que é:** o escritório **pede um documento ao cliente** (ou disponibiliza um documento
  para ele) por um **link**. O cliente abre uma **página pública simplíssima** (logo, uma frase,
  um botão) e baixa/envia. O sistema registra **quando ele abriu, de qual dispositivo** — uma
  **prova de leitura**. O status anda sozinho: solicitado → enviado → visualizado → recebido.
- **Fluxo que resolve:** a eterna cobrança de documento (“cadê o extrato bancário de maio?”) e
  a disputa “eu mandei / não recebi”.
- **Substitui:** cobrança manual por WhatsApp/e-mail sem rastro, e o retrabalho de ficar
  perguntando. Agora há **linha do tempo e prova**.
- **Venda:** poderoso, porque resolve um atrito diário e dá ao escritório uma defesa
  (“o cliente viu o pedido no dia tal”).

## Bloco D — Visibilidade (o farol)

### Painéis e dashboard
- **O que é:** três telas conectadas, todas usando o **farol**:
  1. **Dashboard** — no máximo 6 cartões grandes com números (tarefas abertas, atrasadas,
     exceções, prazos, solicitações). Cada número é clicável e leva à lista por trás dele.
  2. **Painel geral** — uma linha por empresa: farol + nome + 2 informações-chave.
  3. **Painel individual** — a “ficha” da empresa, com abas: tarefas, documentos, prazos,
     solicitações, regras.
- **Regra do farol:** vermelho se há algo atrasado; amarelo se há algo a vencer e nada atrasado;
  verde se tudo ok; cinza se não há dado.
- **Substitui:** a ausência total de visão gerencial. Hoje o dono não tem um lugar para
  “bater o olho e entender o escritório”. Isto é esse lugar.

## Bloco E — Prazos

### Motor de prazos (documentos monitorados)
- **O que é:** você cadastra **o que tem prazo** para cada empresa — uma **certidão** (CND),
  uma **licença**, um alvará, uma obrigação — com a data de vencimento e quantos dias antes
  avisar. Um **robô roda todo dia de manhã**, recalcula o status de tudo, e quando algo entra
  na zona de risco ele **avisa** (no sistema e por e-mail) e pode **criar automaticamente a
  tarefa** “Renovar tal documento — tal empresa”.
- **Fluxo que resolve:** certidões e licenças **vencem** (validade típica de meses) e precisam
  ser renovadas; obrigações têm data-limite. Perder isso gera multa ou impede a empresa de
  operar.
- **Substitui:** a planilha de controle de vencimentos (quando existe) e a vigilância manual.
  Aqui o controle é **automático e dispara a ação** (cria a tarefa sozinho).
- **Venda:** este é o pilar “**nunca mais perca um prazo**”, fácil de demonstrar e de doer no cliente.

## Bloco F — Inteligência

### Triagem por IA (classificação automática de documentos)
- **O que é:** o escritório recebe **uma enxurrada de documentos** todo mês. Aqui você joga
  tudo numa “caixa de entrada” única, sem organizar, e a **IA faz a triagem**: para cada
  arquivo ela descobre **que tipo de documento é** (nota fiscal, guia de imposto, extrato,
  certidão, contrato…), **de qual empresa** (extrai o CNPJ) e **para qual setor vai** —
  e arquiva sozinha no lugar certo, com um selo “classificado por IA” e um botão “corrigir”.
- **A regra de ouro:** a IA **nunca decide sozinha quando está em dúvida**. Se a confiança for
  baixa (ou ela não achar a empresa), o documento vai para a **fila de exceções** com uma
  sugestão pronta, para um humano confirmar em um clique. E **a correção vira exemplo**: a IA
  melhora com o uso.
- **Fluxo que resolve:** a triagem manual — hoje alguém **abre cada PDF** para decidir o que é,
  de quem é e para onde vai. Em milhares de documentos/mês, isso é horas de trabalho braçal.
- **Substitui:** esse trabalho de “porteiro de documento”. O humano deixa de classificar tudo
  e passa a só **revisar as exceções**.
- **Venda:** é o recurso mais “uau” da demonstração e o maior gancho de eficiência. Mas veja a
  Parte 8 sobre o estado de construção — não prometa data sem checar.
- **Detalhe técnico importante de honestidade:** **nota fiscal eletrônica (XML) não passa pela
  IA** — ela é lida por um leitor exato (determinístico), porque o XML já é estruturado.
  A IA é para PDFs e imagens. Isso é um ponto de **precisão**, não de limitação.

### Motor de regras (primeiro caso: CFOP)
- **O que é:** um motor genérico de **“de tal coisa → faça tal coisa”**, configurável, com
  precedência (regra específica vence regra geral) e uma fila de pendências para o que não tem
  regra ainda. O primeiro uso é o **CFOP**.
- **O que é CFOP (em leigo):** todo item de nota fiscal tem um **código** que diz “que tipo de
  operação é essa” (venda, devolução, transferência…). Quando o escritório recebe a nota de um
  **fornecedor** do cliente, o código que vem na nota (visão de quem vendeu) precisa ser
  **traduzido** para o código correspondente de **entrada** (visão de quem comprou) na hora de
  lançar. Isso é repetitivo e segue padrões — perfeito para uma regra automática.
- **Como funciona:** ao subir o XML da nota, o leitor extrai o CFOP e o fornecedor, e o motor
  aplica a regra para preencher o CFOP de entrada — **sem nunca alterar o arquivo original da
  nota** (a nota fiscal é imutável por lei; o dado traduzido fica guardado à parte). Se não
  houver regra, vira pendência; quando um humano resolve, ele pode “salvar como regra” e os
  próximos casos iguais resolvem sozinhos.
- **Substitui:** a tradução manual de CFOP, nota a nota, item a item — um trabalho clássico e
  chato do setor Fiscal.

## Bloco G — Entrega para o ERP

### Lotes de exportação
- **O que é:** como o Hub organiza tudo mas **não é o ERP**, ele entrega para o ERP de um jeito
  limpo: você filtra (empresas, competência, tipos), e ele monta um **lote** — renomeia os
  arquivos por um padrão, gera um **manifesto** (lista do que tem, com verificações e os CFOPs
  aplicados), zipa e te dá para baixar. Pronto para **importar manualmente no AlterData**.
- **Fluxo que resolve:** levar os documentos organizados do Hub para dentro do ERP contábil.
- **Substitui:** o garimpo e a renomeação manual de arquivos antes de importar no ERP.
- **Importante:** v1 é **manual** (gera o pacote; você importa no ERP). A integração automática
  com o AlterData é roadmap (veja Parte 8). Isso é proposital: integrar com ERP é caro e frágil;
  o pacote manual entrega 80% do valor sem o risco.

---

# Parte 4 — Um mês na vida do escritório usando o Hub

Junta tudo numa história. É praticamente o seu **roteiro de demonstração**.

1. **Dia 1 — o mês começa sozinho.** O sistema gera automaticamente as tarefas recorrentes do
   mês para todas as empresas (apuração, folha, etc.). O dashboard mostra os números do dia.
2. **Chegam os documentos.** O escritório joga tudo numa caixa de entrada única. A **IA tria**:
   identifica cada documento, de qual empresa, e arquiva no setor certo. O que ficou em dúvida
   cai na **fila de exceções** com sugestão — alguém resolve em um clique de manhã.
3. **Falta documento? O Hub cobra.** Para as empresas que não mandaram o extrato, o escritório
   dispara uma **solicitação por link**. O cliente abre a página, e o status vira “visualizado”
   — com **prova**. Quem não abriu em N dias recebe **lembrete automático**.
4. **O trabalho flui entre setores.** Fiscal termina a apuração e a tarefa **passa sozinha**
   para o Contábil (handoff), que é notificado. Nada combinado “no grito”.
5. **Notas fiscais entram organizadas.** Os XMLs são lidos com precisão; o motor de **CFOP**
   preenche a tradução automaticamente; o que não tem regra vira pendência clara.
6. **Os prazos se vigiam sozinhos.** Toda manhã o robô confere certidões, licenças e
   vencimentos. Uma CND vai vencer em 10 dias → **alerta** + **tarefa de renovação criada
   automaticamente**. O farol da empresa fica **amarelo**; se vencer, **vermelho**.
7. **O dono bate o olho no painel.** Em 5 segundos vê quais empresas estão no vermelho e clica
   para entender. Visão que ele **nunca teve** antes.
8. **Fim do mês — entrega ao ERP.** Filtra a competência, gera o **lote** organizado com
   manifesto e importa no AlterData.

> Em cada passo, **toda ação (de humano ou robô) fica registrada na auditoria**, e **nenhum
> erro some** — tudo que falha aparece na fila de exceções.

---

# Parte 5 — Tabela “tarefa manual → o que o Hub faz”

Sua cola de venda. Cada linha é uma dor concreta que você pode citar.

| Trabalho manual hoje | O que o Hub faz | Quem sente a dor |
| --- | --- | --- |
| Manter planilha de clientes atualizada à mão | Cadastro central + preenchimento automático por CNPJ | Todos |
| Cadastrar centenas de empresas ao migrar de sistema | Importa a planilha inteira, valida e aponta erros | Dono / gerente |
| Recriar a lista de tarefas do mês para cada empresa | Gera as tarefas recorrentes do mês sozinho | Gerente |
| Combinar “no grito” quem faz o quê e avisar o próximo setor | Tarefas com responsável + handoff automático + notificação | Equipe |
| Abrir cada PDF para ver o que é, de quem é, pra onde vai | IA classifica, identifica a empresa e arquiva sozinha | Fiscal / triagem |
| Traduzir CFOP de cada nota, item a item | Motor de regras preenche automaticamente | Fiscal |
| Garimpar arquivos em pastas/Drive/e-mail | Repositório organizado, com busca e antiduplicado | Todos |
| Cobrar documento por WhatsApp sem rastro | Solicitação por link com prova de leitura + lembrete automático | Atendimento |
| Vigiar vencimento de certidões/licenças na unha | Robô diário que alerta e cria a tarefa de renovação | Compliance |
| Não ter ideia do status geral do escritório | Painel com farol por empresa, em 5 segundos | Dono |
| Automação que falha escondido e vira multa | Fila de exceções: todo erro visível e acionável | Dono / gerente |
| Renomear e juntar arquivos para importar no ERP | Lote organizado com manifesto, pronto para o ERP | Fiscal / contábil |
| “Quem mexeu nisso?” sem resposta | Auditoria registra cada ação (humano e robô) | Dono |

---

# Parte 6 — Como é construído (camada técnica — opcional)

Esta parte é só para você responder perguntas mais técnicas. Em linguagem simples.

## 6.1 As peças
- **A “tela” (web):** o site que o escritório usa, feito em tecnologia moderna de frontend
  (Next.js). É onde ficam os painéis, listas e formulários.
- **O “robô” (worker):** um programa que roda em segundo plano fazendo o trabalho automático —
  os robôs diários (prazos, lembretes), a geração de tarefas do mês, a triagem com IA e a
  montagem dos lotes de exportação. O usuário não vê; ele só trabalha.
- **O “cofre de dados” (Supabase/banco de dados na nuvem):** onde tudo fica guardado com
  segurança — empresas, tarefas, documentos, histórico. Também guarda os arquivos.
- **A IA (Anthropic/Claude, via LangGraph):** o cérebro que lê e classifica documentos.
  Há um painel de observação (Langfuse) que registra cada decisão da IA, para auditoria e
  ajuste — nada de “caixa-preta”.
- **E-mail (Resend):** para enviar as solicitações e alertas.

## 6.2 Decisões importantes para a venda (em linguagem de negócio)

- **Uma instalação dedicada por escritório (“single-tenant”).** Cada escritório roda em seu
  **próprio ambiente isolado**, com **seu próprio banco de dados**. Os dados de um escritório
  **nunca** se misturam com os de outro. Para quem lida com dado fiscal sigiloso, isso é um
  **argumento de segurança forte**. (Por baixo, o sistema já é construído pensando em
  multiempresa, então escalar depois é barato — mas a venda hoje é “seu ambiente só seu”.)
- **Isolamento por construção.** Cada informação carrega a “etiqueta” do escritório dono
  (`firm_id`) e **toda** consulta filtra por ela, com travas de segurança no próprio banco
  (RLS). Mesmo o robô é obrigado a filtrar. Tradução: vazamento entre clientes é barrado
  por desenho, não por confiança.
- **“Tudo cresce por encaixe, sem reescrever o núcleo” (adapters).** Integrações externas
  (captura automática de XML, WhatsApp, certidões automáticas, conexão direta com o ERP) são
  **plugues** que entram quando o cliente precisar — sem mexer no miolo do produto. Hoje os
  plugues são manuais (upload, e-mail, exportação em pacote); amanhã, os automáticos entram no
  mesmo encaixe. Isso significa **evoluir sem quebrar** e **personalizar por cliente sem
  bagunçar o produto-base**.
- **Personalização sem “gambiarra”.** Regras de negócio que mudam por escritório (prazos,
  vocabulário de status, taxonomia de documentos, limites de confiança da IA) ficam em
  **configuração**, não no código. Cada cliente ajusta o seu sem virar um sistema diferente.
- **Nota fiscal é intocável.** O arquivo original da nota (XML) nunca é alterado — exigência
  legal. Tudo que o sistema deriva fica guardado à parte. Bom argumento de **conformidade**.
- **Auditoria de tudo.** Cada ação de pessoa ou robô é registrada (quem, o quê, quando).

## 6.3 Qualidade e operação
- **Testes automatizados** acompanham as partes críticas (regras de negócio, fluxos ponta a
  ponta) para reduzir bugs.
- **Hospedagem:** a tela (web) roda na **Vercel** e o robô (worker) num host persistente
  (**Railway**) — o worker é um processo sempre ligado, que não cabe no modelo serverless da
  Vercel. Ambos conectados ao banco na nuvem (**Supabase**). Há ambientes separados de
  **teste** e **produção**, e **backups**.

> Em resumo técnico para o cliente: “é um sistema web moderno, na nuvem, com **ambiente
> dedicado e isolado para o seu escritório**, IA auditável, e arquitetura que cresce por
> encaixe sem reescrever nada.”

---

# Parte 7 — Comercial

## 7.1 Para quem é (cliente ideal)
- **Escritórios de contabilidade de porte médio a grande** (dezenas a centenas de empresas,
  alto volume de notas), que **já têm um ERP** e sofrem com **gestão, prazo, documento e
  triagem** — não com o cálculo em si.
- Sinais de bom encaixe: reclamam de “falta de visão”, perdem prazo, vivem cobrando documento,
  têm muita gente abrindo PDF para triar, e dependem de pessoas-chave.
- O primeiro cliente (M Rocha: 250–500 empresas, 5.000+ notas/mês, usa AlterData) é o **perfil-modelo**.

## 7.2 Proposta de valor (os argumentos centrais)
1. **Visibilidade em 5 segundos** — o farol e o painel dão ao dono uma visão que ele nunca teve.
2. **Nunca mais perca um prazo** — vigilância automática de certidões, licenças e obrigações,
   que já cria a tarefa de renovação.
3. **Menos trabalho braçal** — IA tria os documentos; o humano só revisa exceções.
4. **Cobrança com prova** — solicitação por link com prova de leitura e lembrete automático.
5. **Nada se perde, nada decide sozinho no escuro** — fila de exceções + IA com humano no laço.
6. **Simplicidade radical** — qualquer pessoa do escritório entende qualquer tela em 5 segundos.
7. **Ambiente dedicado e isolado** — segurança e conformidade para dado fiscal sigiloso.

## 7.3 Concorrentes e alternativas (seja honesto — isso te protege na conversa)

| Alternativa | O que é | Como você se posiciona |
| --- | --- | --- |
| **Planilha + ERP + WhatsApp** (o “concorrente” real da maioria) | O jeito atual: ERP faz o cálculo, o resto é manual | É exatamente a bagunça que o Hub elimina. Seu maior “concorrente” é o **status quo**. |
| **ERPs contábeis** (AlterData, Domínio, Questor, Fortes…) | Onde o cálculo e a escrituração acontecem | **Não somos ERP nem queremos ser.** Ficamos **em volta** dele, organizando e alimentando. Convivência, não substituição. |
| **Gestores de obrigações/workflow** (Acessórias, Gestta, Onvio…) | Controle de tarefas e obrigações para escritórios | **Concorrência mais direta.** Diferencie por: **simplicidade radical** (UX), **IA de triagem**, **ambiente dedicado/isolado**, e **personalização por encaixe** para o escritório. |
| **Captura de XML** (Arquivei, SIEG) | Pegam as notas automaticamente | É **complementar**: hoje entram como upload manual; viram um “plugue” futuro do Hub. Não competimos com a captura; usamos. |
| **ERP de PME / cliente final** (Conta Azul, Nibo) | Software para a empresa-cliente, não para o escritório | Público diferente. Não é o nosso alvo. |

> **Regra de ouro na conversa:** se o prospect disser “já uso o Gestta/Acessórias”, **não negue
> o valor deles** — pergunte onde ainda dói (visão? triagem? simplicidade? a equipe realmente
> usa?). O Hub ganha em **experiência**, **IA** e **isolamento**, não em ter mais botões.

## 7.4 Objeções comuns e como responder

- **“Isso não vai substituir meu ERP?”** → Não, e nem tenta. O Hub organiza e **alimenta** o
  seu ERP. Você continua com o AlterData; só para de sofrer com a parte que ele não resolve.
- **“Vou ter que cadastrar tudo de novo?”** → Não. Você sobe sua planilha de clientes e o
  sistema importa tudo, validando e apontando erros.
- **“IA erra. Vou confiar num robô?”** → A IA **nunca decide sozinha quando está em dúvida**:
  o caso vai para uma fila com sugestão, e um humano confirma em um clique. E ela **aprende**
  com cada correção. Notas fiscais (XML), aliás, nem passam pela IA — são lidas com precisão.
- **“Meus dados ficam misturados com os de outros escritórios?”** → Não. Cada escritório tem
  **ambiente e banco de dados próprios**, isolados por construção.
- **“Minha equipe não vai aprender outro sistema.”** → O produto foi desenhado para ser
  entendido em 5 segundos por tela. Menos é mais: uma pergunta por tela, uma ação principal.
- **“É mais uma tela para minha equipe abrir.”** → É a tela que **substitui** a planilha de
  controle, o grupo de WhatsApp de cobrança e a vigília manual de prazo. Centraliza, não soma.

## 7.5 Precificação (ideias para validar — não são preços fechados)

> Estas são **hipóteses** para você calibrar com os primeiros clientes, não uma tabela oficial.

- **Modelo recomendado: assinatura mensal por porte (faixas por número de empresas)** +
  **taxa de implantação** (setup/onboarding/treinamento).
  - Faixas ilustrativas: até 100 empresas / 100–300 / 300–600 / 600+.
  - A taxa de implantação cobre a importação da base, a configuração inicial e o treinamento —
    e ajuda a “ancorar” o valor.
- **Alternativa: preço por empresa/mês** (ex.: um valor por empresa ativa). Simples de explicar
  e cresce com o cliente, mas pode assustar quem tem muitas empresas — por isso as **faixas**
  costumam vender melhor.
- **Âncora de valor (como justificar o preço):** compare com (a) o **custo de uma multa** por
  prazo perdido, (b) as **horas/mês** gastas em triagem manual e cobrança, (c) o custo de
  **depender de uma pessoa-chave**. O Hub se paga evitando um punhado de multas e liberando horas.
- **Como o ambiente dedicado afeta o preço:** cada cliente é uma instalação isolada — isso tem
  um custo de infraestrutura por cliente, então faz sentido um **piso mensal** que cubra isso,
  mesmo para os menores.

## 7.6 Roteiro de demonstração (siga a Parte 4)
1. Abra o **dashboard** → “em 5 segundos você sabe a saúde do escritório”.
2. Mostre o **painel geral** com o farol → clique numa empresa **vermelha**.
3. Mostre **prazos**: uma certidão vencendo → o alerta e a **tarefa criada sozinha**.
4. Mostre a **caixa de entrada + IA**: jogue documentos, veja a classificação, e mostre um caso
   indo para a **fila de exceções** com sugestão (o “humano no laço”).
5. Mostre uma **solicitação de documento**: gere o link, abra como se fosse o cliente, e mostre
   o status virar “visualizado” com **prova**.
6. Feche com o **lote de exportação** para o ERP → “organizado, com manifesto, pronto”.
7. Frase de fechamento: “tudo isso num lugar só, simples, **seu ambiente isolado**, e **nada se
   perde**.”

---

# Parte 8 — Estado atual da construção (controle interno)

> **Só para você.** Aqui está a verdade sobre o que já está pronto e o que ainda está sendo
> construído, para você **não prometer data do que não existe**. Na conversa de venda você
> apresenta a visão completa (como combinamos); aqui você sabe onde pisar firme e onde dizer
> “está no nosso roadmap próximo”.

O projeto é dividido em 25 etapas (T1–T25). **Todas as 25 estão construídas e com testes
verdes**, validadas contra o ambiente de DEV (Supabase dev + dados sintéticos). Pelo código
existente hoje:

**✅ Construído e demonstrável (todo o produto-base v1):**
- Estrutura base, login, papéis e **auditoria**.
- **Configuração por escritório** (prazos, taxonomia, limites).
- **Cadastro de empresas + contatos** e **enriquecimento automático de CNPJ**.
- **Onboarding por planilha** (importação em massa).
- **Tarefas com handoff** e **tarefas recorrentes**.
- **Fila de exceções** (com infraestrutura de robôs e reprocessamento).
- **Repositório de documentos** (upload, organização, busca, antiduplicado).
- **Painéis e farol** (dashboard, painel geral, painel individual).
- **Motor de prazos** (documentos monitorados, robô diário, alertas, criação de tarefa).
- **Solicitações de documentos + página pública** com prova de leitura, e **lembretes/e-mail**.
- **Motor de regras + CFOP** (M9) — leitor determinístico de XML + de-para com precedência.
- **Triagem por IA** (M10) e sua integração com a caixa de entrada (classifica, identifica a
  empresa, arquiva; em dúvida → fila de exceções; a correção vira exemplo).
- **Lotes de exportação para o ERP** (M11) — .zip renomeado + manifesto.
- **Testes ponta a ponta (E2E)** e **blindagem (hardening)** dos fluxos críticos.

**🚧 Ainda pendente (não é feature faltando — é o que falta para operar de verdade):**
- **Deploy de produção nunca foi provisionado** — tudo rodou só em DEV; produção é a Fase 2
  do `GO-LIVE.md` (Supabase prod, web na Vercel, worker no Railway, domínio, segredos).
- **IA não validada em documentos reais** — precisão e custo por documento ainda não foram
  medidos com notas/guias reais; é o maior risco de produto antes de prometer números.
- **Integrações externas automáticas** (captura de XML via SIEG/PlugStorage, WhatsApp, CNDs
  automáticas, conexão direta com o ERP) — roadmap por encaixe (adapter); ver `ADAPTERS.md`.

**Recomendação prática de venda:** o produto-base inteiro (incluindo IA, CFOP e exportação)
já é demonstrável em DEV — lidere pela promessa central (visibilidade + nunca perca prazo +
nada se perde) e mostre a IA com segurança. Os dois cuidados honestos: (a) **valide a precisão
da IA em documentos reais antes de prometer números** de acerto/custo; (b) **produção ainda
não foi provisionada** — alinhe o cronograma de go-live antes de assinar.

---

# Parte 9 — Glossário (termos que você vai ouvir)

- **Escritório de contabilidade:** empresa que cuida da contabilidade, impostos e folha de
  outras empresas. É o seu cliente.
- **Competência:** o mês de referência de um movimento contábil (ex.: competência 05/2026).
- **Regime tributário:** o “plano de impostos” da empresa. Os três comuns:
  **Simples Nacional** (imposto unificado, guia DAS — pequenas empresas),
  **Lucro Presumido** e **Lucro Real** (mais complexos, empresas maiores).
- **CNPJ:** o “CPF da empresa” — identificador único. É a chave do cadastro.
- **CNAE:** código que diz a atividade econômica da empresa.
- **Nota fiscal eletrônica (NF-e, NFC-e, NFS-e, CT-e):** o documento de uma venda/serviço/frete.
  **NF-e** = venda de produto; **NFC-e** = venda ao consumidor; **NFS-e** = serviço (imposto
  municipal, ISS); **CT-e** = transporte. Vêm como **XML** (arquivo estruturado).
- **XML:** o formato eletrônico (estruturado) da nota fiscal. É lido com precisão, sem IA.
- **Guia (de imposto):** o boleto para pagar um imposto. **DAS** (Simples), **DARF** (federais),
  **GARE/GNRE** (estaduais/ICMS), **ISS** (municipal), **FGTS/INSS** (encargos da folha).
- **Obrigação acessória:** uma declaração obrigatória ao governo, com prazo (ex.: SPED, eSocial).
  Não é pagar imposto; é **informar**. Perder o prazo gera multa.
- **CFOP:** código que classifica o tipo de operação em cada item de nota. Precisa ser
  “traduzido” de saída (fornecedor) para entrada (cliente) ao lançar. O motor de regras automatiza.
- **Certidão negativa (CND):** documento que prova que a empresa não tem dívidas com um órgão
  (Receita, estado, município, FGTS, trabalhista). **Vence** (validade de meses) e precisa renovar.
- **Licença / alvará:** autorizações para a empresa operar, que também vencem.
- **Handoff:** a passagem de uma tarefa de um setor para o próximo.
- **Triagem:** decidir, para cada documento que chega, o que é, de quem é e para onde vai.
- **ERP contábil (AlterData, Domínio, Questor…):** o sistema onde os lançamentos e os cálculos
  fiscais “oficiais” acontecem. O Hub **não é** o ERP — ele organiza e alimenta o ERP.
- **eCAC / SEFAZ:** portais do governo (Receita Federal / fazenda estadual). Integração é roadmap.
- **SIEG / Arquivei:** serviços que capturam o XML das notas automaticamente. Roadmap (hoje é upload).
- **Single-tenant (ambiente dedicado):** cada escritório roda isolado, com seu próprio banco.
- **Fila de exceções:** a caixa única onde aparecem todos os erros/pendências, de forma visível
  e acionável — “nada se perde”.
- **Farol (semáforo):** a luz 🟢🟡🔴⚪ que mostra o status de cada empresa em todo lugar do sistema.

---

> **Última orientação:** este guia reflete o produto e seu estado em junho/2026. Conforme as
> etapas de IA, regras/CFOP e exportação forem concluídas, atualize a **Parte 8** para mover
> esses itens de “roadmap” para “pronto”. Quando isso acontecer, você poderá liderar a
> demonstração pela IA com total segurança.

---

# Parte 10 — Custos, Infraestrutura e Escala

> **Para que serve esta parte:** te dar domínio sobre **quanto custa rodar o sistema** (para
> calcular preço e margem) e **como ele cresce** sem virar uma bagunça. Também responde, em
> detalhe, perguntas técnicas comuns sobre como cada peça funciona por dentro.
>
> **Conversões:** uso **dólar ≈ R$ 5,50** (estimativa — ajuste pela cotação do dia).
> **Marcação de status:** 🟢 = já funciona hoje · 🚧 = roadmap (custo é projeção, não algo rodando).

## 10.1 Resumo executivo de custos (a tabela que importa)

| Item | Custo | Status |
| --- | --- | --- |
| Enriquecimento de CNPJ (BrasilAPI/ReceitaWS) | **R$ 0** (APIs públicas gratuitas) | 🟢 |
| E-mail transacional (Resend) | **Grátis** até ~3 mil/mês; ~US$ 20/mês até 50 mil | 🟢 |
| IA de triagem (Claude) | **~dezenas a poucas centenas de R$/mês** por escritório | 🟢 (custo a validar em docs reais) |
| WhatsApp (Meta Cloud API oficial) | **~R$ 0,034/msg** de utilidade; entrada do cliente **grátis** | 🚧 |
| Infraestrutura (Supabase + Railway), por escritório | **custo fixo recorrente** — define o piso de preço (ver 10.6) | 🟢 |

**Leitura de negócio:** os custos variáveis (IA, e-mail, WhatsApp) são **pequenos** perto do
valor entregue. O custo que realmente pesa é o **fixo de infraestrutura por escritório**, porque
cada cliente roda isolado (single-tenant). É ele que define o **piso da assinatura**.

## 10.2 Enriquecimento de CNPJ — como funciona e quanto custa 🟢

- **Como:** você digita só o CNPJ; o sistema consulta **bases públicas gratuitas** — **BrasilAPI**
  (principal) e **ReceitaWS** (reserva, entra só se a primeira falhar) — e preenche razão social,
  nome fantasia, CNAE, situação cadastral, opção pelo Simples, e-mail, telefone e endereço.
- **Custo:** **R$ 0.** O “custo” não é dinheiro, é **limite de velocidade**: as consultas são
  espaçadas (1 por segundo) para não serem bloqueadas. Importar 250–500 empresas leva alguns
  minutos, rodando em segundo plano.
- **Ressalva (sem oversell):** API pública gratuita tem limite e às vezes sai do ar (a ReceitaWS
  grátis aceita ~3 consultas/min). Para volume alto com garantia (SLA), dá para plugar um provedor
  pago **no mesmo encaixe (adapter)**, sem mexer no resto. Hoje, gratuito atende.

## 10.3 Como a pessoa é notificada — sistema e/ou e-mail 🟢

- **Dentro do sistema (padrão, sempre):** um “sininho” com contador de não lidas. Dispara no
  **handoff de tarefa** (trabalho passou de setor) e nos **alertas de prazo**.
- **E-mail (eventos externos):** via Resend, para **alertas de prazo** e **solicitações ao cliente**.
- **Resumo:** handoff entre setores = aviso no sistema; prazo vencendo = aviso no sistema **+**
  e-mail; cobrança ao cliente = e-mail/link.
- **Item a finalizar (controle interno):** no alerta de prazo por e-mail, o destinatário ainda está
  como marcador genérico — o encanamento existe, mas “qual e-mail do escritório recebe o alerta”
  é um ajuste a concluir. O aviso **dentro do sistema** já funciona completo.

## 10.4 Custo da IA de triagem (detalhe) 🟢 (custo a validar em docs reais)

**A pergunta central — “todos os documentos vão para a IA?” → NÃO**, e é isso que segura o custo:

1. **Nota fiscal (XML) NÃO passa pela IA.** NF-e, NFC-e e CT-e são lidas por um **leitor exato
   (determinístico)**, sem modelo de linguagem. Como a nota é o documento de **maior volume**
   (na M Rocha, 5.000+/mês), **esse volumão custa R$ 0 de IA**.
2. **Só vão à IA os PDFs e imagens** que precisam ser classificados (guias em PDF, extratos,
   certidões, contratos, comprovantes) — uma **fração** do total.

**Custo por documento que vai à IA:** a triagem é tarefa simples (classificar + extrair CNPJ), então
o modelo certo é o **mais barato (Claude Haiku)**. Por documento (1 página como imagem + instruções
+ resposta curta) fica da ordem de **~US$ 0,005 ≈ R$ 0,03**, e cai mais com cache das instruções fixas.

**Conta para um escritório porte M Rocha** (~3.000 PDFs/imagens por mês à IA):
- 3.000 × ~R$ 0,03 ≈ **R$ 80–100/mês** para o escritório inteiro.
- Mesmo dobrando o volume, fica em **poucas centenas de R$/mês**.

> **Argumento de venda:** a IA é barata **de propósito** — o desenho manda as notas (o grosso) por
> um leitor gratuito e só usa o modelo pago no que sobra, com o modelo mais econômico.

## 10.5 Custo do WhatsApp (Meta Cloud API) 🚧

**“Centenas de mensagens/dia — todas são cobradas?” → Não:**
- **Mensagem que o cliente envia (entrada) = grátis.**
- **Dentro da janela de 24h** aberta por uma conversa iniciada pelo cliente, mensagens de
  **utilidade** (cobrança, aviso de guia) também tendem a ser **grátis**.
- **Você só paga** as de **utilidade enviadas proativamente fora da janela** — e são baratas:
  **≈ R$ 0,034/mensagem**. Evita-se a categoria “marketing” (mais cara, ~R$ 0,31).
- **Conta:** mesmo 300 msgs pagas/dia × 30 × R$ 0,034 ≈ **~R$ 300/mês**, e na prática boa parte cai
  em janela grátis.

**“Todas vão para a IA?” → Não.** Texto que o cliente digita (“ok”, “recebido”) **não é documento**
e não vai à triagem. Só **anexos** entram no fluxo — e XML nem passa pelo modelo.

> **Regra de ouro (do `ADAPTERS.md`):** **somente a API oficial da Meta.** APIs não oficiais
> (Z-API/Evolution) são **proibidas** — banem permanentemente o número do escritório.

## 10.6 Infraestrutura por escritório — o custo que define o preço 🟢

Cada escritório roda **isolado** (single-tenant): seu próprio projeto **Supabase** (banco, storage,
filas) + serviços **Railway** (a tela e o robô). Isso é ótimo para **segurança** (dado de um cliente
nunca encosta no de outro), mas significa que existe um **custo fixo mensal por cliente**, mesmo o
menor — diferente de um SaaS multiempresa onde todos dividem a mesma infra.

**Implicação comercial direta:** defina um **piso de assinatura** que cubra esse custo fixo por
cliente, e some a ele a margem e o valor entregue. Ao calcular o preço (Parte 7.5), trate a infra
como **custo de servir**, não como detalhe técnico. Quando você chegar no passo “estudar infra e
escala”, vale levantar o número exato por faixa de porte (storage e processamento crescem com
volume de documentos), mas a **estrutura** do preço já é esta: **piso de infra + margem**.

## 10.7 Os tipos de nota fiscal — como cada um é tratado

Dois caminhos, pela regra de ouro:

- **Caminho A — estruturados (XML): leitor exato, SEM IA.** NF-e (produto), NFC-e (consumidor),
  CT-e (transporte). É aqui que o **motor de CFOP** (🟢) preenche a tradução **sem alterar o XML
  original** (a nota é imutável por lei).
- **Caminho B — não estruturados (PDF/imagem): IA de visão (🟢).** Guias (DAS, DARF, GARE, ISS),
  extratos, certidões, contratos, comprovantes, folha.

Cada tipo tem **destino configurável**: notas/guias → Fiscal; extratos → Contábil; folha/encargos →
DP; certidões/contratos → Compliance; em dúvida → fila de exceções.

> **Ressalva técnica importante:** a **NFS-e (nota de serviço, municipal)** é o ponto sensível —
> diferente da NF-e, **não tem padrão nacional único**; cada prefeitura faz do seu jeito (há a
> “NFS-e Nacional” entrando aos poucos desde 2026). Pode exigir tratamento por município ou cair na
> IA/visão. **Nunca prometa “lê qualquer NFS-e de qualquer cidade”** sem validar o layout antes.

## 10.8 Exportação para o ERP — sim, é setup por cliente 🟢

O setup tem **duas camadas**, e por isso é “configurado por cliente conforme o ERP”:
1. **Configuração (por escritório):** a **convenção de nome dos arquivos**
   (ex.: `{cnpj}_{competência}_{tipo}_{sequência}`) e o aviso de reexportação já existem na config
   do escritório — ajustáveis **sem mexer no código**.
2. **Adapter (por tipo de ERP):** a ponte é uma interface (`ErpAdapter`). Hoje existe a base
   **`manual-export`** (gera .zip organizado + manifesto para importar à mão no AlterData); versões
   automáticas por ERP (`alterdata-nfstock`, `dominio-onvio`…) entram **no mesmo encaixe**, no futuro.

> **Mesmo produto-base; a saída para o ERP do cliente é questão de configuração + qual adapter de ERP
> está ligado.** (A tela de exportação e o `manual-export` já estão construídos; adapters automáticos
> por ERP — `alterdata-nfstock`, `dominio-onvio`… — é que são roadmap.)

## 10.9 Como o sistema cresce sem virar bagunça (escala)

- **Adapters (encaixes):** novas integrações (captura de XML, WhatsApp, certidões automáticas,
  conexão direta com ERP) entram como **plugues**, sem reescrever o núcleo. O catálogo está no
  `ADAPTERS.md`, com viabilidade, custo e esforço de cada um.
- **Configuração por escritório:** prazos, vocabulário, taxonomia e limites da IA ficam em
  **configuração**, não no código — cada cliente ajusta o seu sem virar um sistema diferente.
- **Multiempresa pronto por baixo:** mesmo vendendo “ambiente isolado”, o código já é escrito
  pensando em multiempresa — escalar depois é barato; a escolha de deploy é reversível.

> **Frase para cliente técnico:** “é um sistema web moderno na nuvem, com **ambiente dedicado por
> escritório**, IA **auditável e barata** (a nota fiscal nem passa pelo modelo), e arquitetura que
> **cresce por encaixe** — adicionamos captura de XML, WhatsApp oficial ou conexão com o ERP sem
> reescrever o produto.”
