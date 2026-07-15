# Considerações de produto e implementação — antes de vender

> **Documento interno** (não é para clientes). Análise crítica, com olhos de negócio e
> implementação, do que está pronto de verdade, do que é integração por cliente a
> construir, e do que não pode passar antes de apresentar aos clientes. Escrito em
> 2026-07-02; **atualizado em 2026-07-10 com as decisões de produto** (exportação ERP,
> storage, captura de NF, guias, CND), tomadas sobre a pesquisa de mercado consolidada
> em `docs/PARECER-CONSIDERACOES-PRODUTO.pdf`. Complementa `docs/ADAPTERS.md`,
> `docs/guias/` e `docs-pend/PROPOSTA-AUTOMACAO.md`.

## Resumo em uma frase

O que está pronto hoje é um **painel de gestão + triagem por IA do que CHEGA + cobrança
de documentos + atendimento**. A camada de automação de entrada/saída deixou de ser
incógnita: **exportação para Domínio/AlterData é viável e mapeada**, captura de NF será
**"traga seu hub"** (integramos o que o escritório já usa), **CND automática é o primeiro
módulo de automação do roadmap**, e **emissão de guias está fora do produto** por decisão
de fronteira (é papel do ERP).

---

## Decisões tomadas (2026-07-10)

| Tema | Decisão |
|---|---|
| **Exportação ERP** | Alvo: **Domínio e AlterData**. Fase 1: lote de XMLs organizado no padrão de importação dos dois. Fase 2: geradores de TXT de lançamentos (`dominio-export`, `alterdata-export`). Fase 3: push via API oficial do Domínio. |
| **Storage** | **Hospedar e não cobrar por GB** (padrão do mercado inteiro). Posicionar como "repositório do que flui pelo sistema" + **guarda legal de XML (5 anos) como feature nomeada**. Migração de acervo antigo = serviço pago à parte, nunca promessa. |
| **Captura de NF** | **Modelo "traga seu hub"**: integramos a conta (API key) do hub que o escritório já usa, via uma implementação de `XmlSourceAdapter` por hub. Sem hub → recomendamos contratar um homologado (SIEG/Qive). Sem contrato-mestre nosso por ora. |
| **Guias (DAS/DARF)** | **Fora do produto.** Emitir guia pressupõe apuração, e apuração é papel do ERP (que já embute o Integra Contador). Nosso papel é o que já existe: distribuir a guia ao cliente final com prova de leitura e prazo. |
| **CND** | Lançamento: manual com task/prazo (estado atual já cobre). **Automação via Infosimples = módulo 1 do roadmap** — a integração mais barata (sem certificado, sem procuração, ~R$0,20/consulta) com alto valor percebido. |

---

## 1. Exportação para ERP — viável, mapeada, decidida

A descoberta central da pesquisa: **para NF-e/NFC-e/CT-e, o formato de importação
universal do Domínio e do AlterData é o próprio XML da SEFAZ** — os dois importam
arquivos `.xml` em pasta, direto no módulo fiscal. Não há conversão a fazer; o export
fiscal é 90% **organização** (pasta por empresa/competência/tipo). O `ErpAdapter` atual
(zip + manifesto) está mais perto do produto final do que se assumia.

O que cada ERP aceita:

- **Domínio (Thomson Reuters):** XML SEFAZ via "Importação Padrão"; lançamentos
  contábeis via **"Leiaute Domínio Sistemas com Separador"** (TXT delimitado por pipe,
  registros 0000/1000/2000/3000/6000-6100 — spec oficial pública, Solução 672) ou
  CSV/Excel; **API oficial de integração** (credenciamento por e-mail em ~1 dia útil,
  OAuth, chave por CNPJ) que empurra XMLs direto para a Escrita Fiscal.
- **AlterData Pack:** XML SEFAZ por diretório; lançamentos via TXT simples (10 campos
  entre aspas, separados por vírgula) ou Excel; aceita SPED EFD como formato de carga;
  API só via nf-stock (doc não pública, contato comercial).
- **NFS-e é o ponto fraco dos dois** (sem padrão nacional universal): XML
  ABRASF/Padrão Nacional onde existir; layouts municipais como fallback.

A abordagem é prática consolidada de mercado: **Nibo** (Importador Universal, 60+
sistemas), **Conta Azul** (integração oficial com o Domínio via API) e **Omie** fazem
exatamente isso. O trabalho real não é o arquivo — é o **de-para** (plano de contas,
acumuladores, códigos), configurado uma vez por cliente: caso de uso direto do motor de
mapping-rules que já existe.

**Posicionamento de venda:** não prometer "qualquer ERP"; prometer **"exportação pronta
para Domínio e AlterData"** como módulo. Pergunta obrigatória em toda venda: **"qual ERP
você usa?"**

## 2. Storage — decidido: hospedar, sem cobrar por GB

O que a pesquisa mostrou:

- **Nenhum player do mercado cobra storage por GB** do escritório; GED é feature
  embutida (pool generoso ou silêncio). A unidade de valor do setor é o documento,
  nunca o byte.
- **O custo real é irrisório:** ~15–60 MB/empresa/mês → **R$0,15–0,30/empresa/mês** no
  pior cenário (100 empresas, 5 anos de retenção ≈ R$30/mês de Supabase para o
  escritório inteiro). Storage é argumento de venda, não item de custo.
- **Guarda legal:** XML de NF-e = 5 anos + ano corrente; a obrigação é **sempre do
  contribuinte** — fornecedores (Arquivei/Qive, SIEG) vendem a infraestrutura da guarda
  sem assumir a obrigação. Faremos igual.
- **Drive/OneDrive no mercado é origem de ingestão, nunca destino.** Não construir
  sincronização com Drive como repositório.

**Posicionamento decidido:** "repositório do que flui pelo sistema" (que na prática vira
o repositório de fato, como em todos os concorrentes) + **guarda de XML por 5 anos como
feature nomeada** no material de venda. Pendências operacionais baratas que viram
diferencial (fechar antes do primeiro pagante):

1. Cláusula de **retenção pós-cancelamento** (proposta: 6 meses + exportação completa
   garantida — mais generoso que o padrão do setor).
2. **DPA simples** (escritório = controlador, nós = operador) — raro no setor.
3. **PITR/backup em prod** — bloqueante.

---

## Mapa honesto: real hoje × decisão/roadmap

| Área | Estado real | Decisão (2026-07-10) |
|---|---|---|
| Painel, farol, tarefas, prazos, exceções | ✅ Pronto | Core sólido |
| Solicitação de documentos + prova de leitura | ✅ Pronto | Diferencial forte |
| Triagem por IA **do que chega** | ✅ Pronto | Upload/inbox/WhatsApp/IMAP → classifica/arquiva |
| Atendimento (WhatsApp) | ✅ Pronto | Em produção |
| Enriquecimento CNPJ | ✅ Pronto | BrasilAPI/ReceitaWS |
| **Exportação p/ ERP** | ⚠️ Genérico (zip + manifesto) | **Núcleo de lançamento:** fase 1 (lote XML organizado) é evolução pequena do adapter atual |
| **CNDs automáticas** | Manual (prazo + upload) — funciona | **Módulo 1** — Infosimples (sem credencial, ~R$2/empresa/mês) |
| **Captura automática de NF-e** | ❌ Não existe | **Módulo 2** — "traga seu hub" (adapter por hub, credencial por firma) |
| **Guias (DAS/DARF) automáticas** | ❌ Não existe | **Fora do produto** (papel do ERP; distribuição rastreada já é nossa) |
| **Conciliação bancária / Open Finance** | ❌ Não existe | Adiado (caro/complexo) |
| **Cofre de certificado A1** | ❌ Não existe | **Não construir** — o A1 mora no hub (terceirizado); explicitar no contrato |

> Confirmado no código: só existem os adapters `classification, cnpj-enrichment,
> erp(manual), inbound-imap, messaging, support-assistant, whatsapp`. Nada de
> SEFAZ / SIEG / certificado / CND.

---

## Como funciona a automação da ENTRADA (modelo decidido)

**Fato técnico que define tudo:** o serviço da SEFAZ que entrega XMLs destinados
(Distribuição DF-e) **só aceita o certificado A1 da própria empresa** — procuração do
escritório não funciona. Logo, não existe captura sem o A1 de cada empresa morar em
algum lugar; a escolha é "cofre nosso" vs "cofre terceirizado (hub)". **Decidido:
terceirizado, no hub do escritório.**

São **dois regimes de credencial** distintos (não confundir):

- **Captura de XML** → A1 de cada empresa, hospedado **no hub** (SIEG, Qive…). O
  escritório já costuma ter esses certificados em mãos.
- **Guias/e-CAC (Integra Contador/Serpro)** → e-CNPJ do escritório + procuração
  eletrônica. Não usaremos por ora (guias fora do produto), mas é o regime certo se a
  caixa postal do e-CAC voltar ao roadmap um dia.

**O fluxo do modelo "traga seu hub":**

1. **No cadastro da firma:** o escritório informa a **API key do hub dele** (config por
   firma). A captura SEFAZ→hub é responsabilidade do hub e da conta do escritório
   (certificados carregados lá).
2. Um **cron por firma/empresa** consulta o cofre do hub a cada X (configurável) e baixa
   os XMLs novos por CNPJ.
3. Cada nota entra na **mesma triagem** existente → repositório, ligada à empresa pelo
   CNPJ. O que não casar → **fila de exceções**.
4. **Tela de status da fonte por empresa** (obrigatória no módulo): CNPJs cadastrados
   aqui × CNPJs presentes no cofre, com alerta para buracos (empresa sem certificado no
   hub, A1 vencido = silêncio, não erro — precisa ficar visível).
5. **Carga inicial:** retroativo (hub guarda até 5 anos) como opção, não default.

**Regras comerciais do modelo:**

- Hub que o escritório usa e já homologamos → plug direto. Hub novo → **integração com
  fee de setup** (um adapter por hub, custo único que vira cobertura de mercado).
- Escritório sem hub → produto funciona sem captura (WhatsApp/e-mail/upload continuam);
  se quiser captura, **recomendamos contratar SIEG ou Qive**.
- Contrato-mestre nosso (agregação de volume) → só reavaliar com ~10+ escritórios e
  números na mão.
- Pergunta obrigatória de venda, junto com o ERP: **"qual ferramenta de XML você usa
  (SIEG/Arquivei-Qive/nenhuma)?"**

**Risco de fornecedor (por que tudo fica atrás de adapter):** o segmento tem churn real
de infraestrutura — a Nuvem Fiscal desliga em 31/07/2026 e a API antiga do SIEG morre na
mesma data. Trocar de hub tem que ser trocar um adapter, nunca reescrever o worker.

---

## Antes de apresentar — o que NÃO deixar passar

1. **Não venda "qualquer ERP" nem "automatiza tudo" como pronto.** Venda o core +
   "exportação pronta para Domínio e AlterData" + automações como **módulos** (com fee
   de setup quando houver integração nova).
2. **Sempre escopar por cliente:** qual ERP? qual hub de XML (ou nenhum)? quais
   obrigações? migra acervo antigo (serviço à parte)?
3. **Precificação tem que cobrir custo variável:** IA (por documento), WhatsApp, CND
   (~R$2/empresa/mês via Infosimples), storage (~R$0,30) e — quando o escritório não
   tiver hub — o custo do hub que ele contratar é dele, transparente. Variável total
   realista: **~R$5–10/empresa/mês** com hub bem negociado (a estimativa anterior de
   R$1–4 para hub era otimista sem volume). + infra fixa por firma (Supabase/Railway/
   Vercel).
4. **Certificado A1: nunca no nosso banco.** O A1 mora no hub; se transitar pela nossa
   API a caminho do hub, é em trânsito, sem persistir. Não eliminamos a
   responsabilidade — terceirizamos para quem tem contrato para isso; **explicitar no
   contrato com o escritório**.
5. **LGPD/DPA + retenção + backup (PITR)** definidos antes de hospedar documento de
   cliente pagante.
6. **A demo roda em ambiente dev/staging.** Prod de verdade ainda pendente.
7. **Automação gera trabalho de exceção:** alguém no escritório precisa trabalhar a fila
   de Exceções — parte do "como funciona", não detalhe. NFS-e de municípios não
   cobertos, CND municipal fora de cobertura e NFC-e destinada são **limites estruturais
   da infraestrutura pública** — dizer isso na venda, e tudo cai na fila de exceções.

---

## Sequência de construção (decidida)

1. **Núcleo de lançamento:** o que existe + **export Domínio/AlterData fase 1** (lote de
   XMLs organizado no padrão de importação dos dois — evolução pequena do `erp-manual`).
2. **Módulo 1 — CND automática (Infosimples):** cron + API REST + PDF/recibo no
   repositório + farol de prazos existente. Sem dependência de terceiros/credenciais;
   vitória rápida e demo forte.
3. **Módulo 2 — Captura de NF via hub do escritório:** adapter do hub do primeiro
   cliente comprador (SIEG ou Qive) + cron de polling + tela de status da fonte por
   empresa.
4. **Export fase 2/3:** TXT de lançamentos (`dominio-export`, `alterdata-export`) →
   depois push via API do Domínio.
5. **Operacionalização:** DPA, cláusula de retenção, PITR em prod.

**Fora do produto (decidido):** emissão de guias (papel do ERP; DAS de MEI via
Infosimples fica como mini-feature possível se houver demanda), cofre de A1 próprio,
conciliação/Open Finance (adiado).

---

## Decisões em aberto (fechar antes de escalar)

- **Precificação final:** números da assinatura por faixa de porte + fee de setup por
  integração + repasse de variável.
- **Modelo de suporte/SLA** quando a automação falha (quem trabalha a fila de exceções,
  em quanto tempo).
- **Quais hubs homologar** além do primeiro (definido pelos primeiros clientes).
- **Contrato-mestre com hub** (modelo agregado): reavaliar com ~10+ escritórios.
- **Texto final** da cláusula de retenção pós-cancelamento e do DPA.
