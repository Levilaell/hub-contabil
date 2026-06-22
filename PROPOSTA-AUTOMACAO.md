# Proposta de Automação — Integrações

Documento de apoio comercial. Separa **o que o sistema já faz nativamente** do **que pode
ser integrado** (add-ons), com o que cada item automatiza, o que exige e o esforço relativo.

## Como o sistema automatiza (o princípio)

O fluxo é um funil: **captura → triagem (IA) → arquivamento/roteamento → ações** (prazos,
cobranças, exportação). Dois pilares de confiança: nada falha em silêncio (todo erro de
automação cai numa **fila de exceções** com sugestão para um humano resolver) e **toda ação,
humana ou robô, é auditada**.

Ponto-chave para a proposta: **cada integração externa entra por um "adaptador"**. Ativar uma
nova (WhatsApp, SIEG, CND…) **não reescreve o núcleo** — o produto já foi construído com esses
encaixes prontos. Isso reduz risco e prazo de cada ativação.

Esforço relativo: **P** = pequeno · **M** = médio · **G** = grande.

---

## 1. Nativo — já incluso no produto

| Recurso | O que automatiza | Trabalho manual que elimina |
|---|---|---|
| **Enriquecimento de CNPJ** (BrasilAPI + ReceitaWS) | Preenche razão social, CNAE, endereço e situação cadastral ao cadastrar/importar empresa | Digitar o cadastro à mão |
| **Triagem por IA** (Anthropic) | Lê o documento, **classifica o tipo**, **extrai o CNPJ**, identifica a empresa e **arquiva no departamento certo** | Separar, renomear e arquivar documento por documento |
| **Leitura de XML de NF-e + motor de regras de CFOP** | Lê CFOP e emitente do XML (determinístico, sem IA) e aplica o **de-para de CFOP de entrada** | Conferir e lançar CFOP manualmente |
| **Motor de prazos** (rotina diária) | Recalcula o status de certidões/licenças, **alerta antes de vencer** e **cria a tarefa de renovação** sozinho | Controlar planilha de vencimentos |
| **Tarefas recorrentes** (rotina mensal) | Gera as tarefas do mês por empresa/regime, sem duplicar | Recriar as mesmas tarefas todo mês |
| **Solicitação de documentos + link público** | Cobra o documento do cliente por link seguro, **registra a visualização** e **reenvia lembrete** automático | Cobrar por e-mail/WhatsApp na mão e controlar quem respondeu |
| **E-mail transacional** (Resend) | Envia alertas de prazo e links de solicitação | Disparar e-mails manualmente |
| **Lotes de exportação** | Renomeia por convenção, gera **.zip + manifesto** (lista, hashes, CFOPs) pronto para o ERP | Renomear e organizar arquivos para importar |
| **Fila de exceções + auditoria** | Centraliza erros de qualquer automação (nunca trava o lote) e registra todo histórico | Caçar o que falhou e por quê |

> A **triagem por IA já é a automação principal**. O que as integrações abaixo somam é
> sobretudo a **captura automática** que alimenta essa triagem — fazendo o fluxo virar
> "mão na roda" de ponta a ponta — além de novos canais de cobrança.

---

## 2. Integrações possíveis (add-ons)

Cada uma já tem o **encaixe (adaptador) pronto** no código ou é um conector novo bem
delimitado. Marcado "🔌 semente pronta" quando a interface já existe (hoje em modo
manual/desligado) e a ativação é plugar a implementação real.

### Captura de documentos (alimentam a triagem por IA)

- **Captura automática de XML — SIEG / PlugNotas/PlugStorage** 🔌 (adaptador de fonte de XML;
  hoje: upload manual)
  - *Faz:* puxa NF-e / NFC-e / CT-e (e NFS-e) **direto da SEFAZ**, sem ninguém subir arquivo.
  - *Elimina:* upload manual de milhares de XML por mês.
  - *Precisa:* conta no SIEG/PlugNotas (serviço pago) + **certificado A1** das empresas.
  - *Esforço:* **M**.

- **WhatsApp — Meta Cloud API** 🔌 (adaptador de mensagens; hoje: e-mail + link)
  - *Faz:* (a) cliente **manda o documento pelo WhatsApp** e ele cai direto na triagem; (b)
    envia **alertas de prazo e solicitações** pelo WhatsApp (onde o cliente realmente lê).
  - *Elimina:* pedir documento por e-mail e ter que baixar/subir; cobrança manual.
  - *Precisa:* conta Meta Business + número aprovado (direto ou via BSP), **aprovação de
    templates** e **custo por conversa**.
  - *Esforço:* **M**.

- **Monitoramento de e-mail de entrada**
  - *Faz:* uma caixa dedicada do escritório recebe anexos e eles **entram sozinhos na triagem**.
  - *Elimina:* baixar anexo do e-mail e subir no sistema.
  - *Precisa:* caixa/serviço de inbound (IMAP ou serviço tipo Postmark).
  - *Esforço:* **M**.

### Obrigações e certidões (governo)

- **CNDs automáticas — Infosimples / Dootax** 🔌 (adaptador de certidões; hoje: desligado)
  - *Faz:* busca **certidões negativas** (Federal, Estadual, Municipal, FGTS, Trabalhista)
    automaticamente, anexa no repositório e **alimenta o motor de prazos**.
  - *Elimina:* emitir certidão portal por portal.
  - *Precisa:* conta Infosimples/Dootax (pago **por consulta**) + certificado quando exigido.
  - *Esforço:* **M**.

- **Integra Contador (Serpro)**
  - *Faz:* integração **oficial federal** (DCTFWeb, procurações eletrônicas, situação fiscal etc.).
  - *Precisa:* contrato com o Serpro + **procuração eletrônica/certificado**.
  - *Esforço:* **G**.

- **Sistemas municipais (Giss Online / São Vicente / outros)**
  - *Faz:* emissão/consulta de **NFS-e municipal**.
  - *Precisa:* a maioria **não tem API** → exige robô (RPA) por município.
  - *Esforço:* **G** (por município).

### ERP

- **Conector AlterData** 🔌 (adaptador de ERP; hoje: lote .zip manual)
  - *Faz:* lança/importa os documentos **direto no AlterData**, fechando o ciclo sem importação manual.
  - *Precisa:* **API do AlterData** (se houver) ou **RPA**; a viabilidade depende do que o
    AlterData expõe (provável import de arquivo ou robô).
  - *Esforço:* **G** — confirmar a superfície de integração antes de prometer prazo.

### Habilitador transversal

- **Cofre de certificado A1**
  - *Faz:* guarda com segurança o **certificado digital** das empresas para o sistema
    autenticar nos portais em nome delas.
  - *Por que importa:* é **pré-requisito** de SIEG, CNDs e Integra Contador.
  - *Esforço:* **M** (sensível — segurança é o ponto central).

---

## 3. O que destrava o quê (dependências)

- **Cofre de certificado A1** → destrava **SIEG**, **CNDs automáticas**, **Integra Contador**
  e parte dos **sistemas municipais**.
- **WhatsApp** e **e-mail de entrada** → não dependem de certificado; alimentam a **triagem por
  IA** (que já é nativa) com novos canais de captura.
- **CNDs automáticas** → alimentam o **motor de prazos** nativo (o farol passa a se atualizar sozinho).

---

## 4. Resumo

| Integração | Categoria | Automatiza | Esforço | Encaixe pronto | Principal dependência |
|---|---|---|:--:|:--:|---|
| Enriquecimento de CNPJ | Nativo | Cadastro | — | ✅ ativo | — (grátis) |
| Triagem por IA | Nativo | Classificar/arquivar | — | ✅ ativo | Chave Anthropic |
| Regras de CFOP (XML) | Nativo | Lançar CFOP | — | ✅ ativo | — |
| Prazos / Recorrentes | Nativo | Vencimentos/tarefas | — | ✅ ativo | — |
| Solicitações + lembrete | Nativo | Cobrança ao cliente | — | ✅ ativo | E-mail (Resend) |
| Lotes de exportação | Nativo | Empacotar p/ ERP | — | ✅ ativo | — |
| Captura de XML (SIEG) | Add-on | Capturar notas | M | 🔌 | Conta SIEG + A1 |
| WhatsApp (Meta Cloud API) | Add-on | Receber doc + avisar | M | 🔌 | Meta Business + custo |
| E-mail de entrada | Add-on | Receber doc | M | — | Caixa inbound |
| CNDs automáticas | Add-on | Emitir certidões | M | 🔌 | Infosimples/Dootax + A1 |
| Conector AlterData | Add-on | Lançar no ERP | G | 🔌 | API/RPA do AlterData |
| Integra Contador (Serpro) | Add-on | Obrigações federais | G | — | Contrato Serpro + procuração |
| Sistemas municipais | Add-on | NFS-e municipal | G | — | RPA por município |
| Cofre de certificado A1 | Habilitador | Autenticar nos portais | M | — | Segurança |

---

## 5. Notas de viabilidade (para alinhar expectativa na venda)

- **Onde há API, a automação é robusta** (SIEG, Infosimples, WhatsApp, Anthropic). **Onde não
  há (muitos portais municipais), depende de RPA**, que é mais frágil — quebra quando o site
  muda e exige manutenção. Priorizar os de API.
- **WhatsApp** tem **custo por conversa** e exige aprovação de templates pela Meta — entra como
  item de custo recorrente na proposta.
- **AlterData**: confirmar a superfície de integração (API vs. import de arquivo vs. RPA)
  **antes** de cravar prazo — é o item de maior incerteza.
- **Certidões e captura de XML** dependem do **certificado A1** do cliente — combinar a guarda
  segura desse certificado é parte do onboarding.
- **Vantagem estrutural:** como tudo entra por adaptador, dá para **vender em fases** — começar
  com o nativo + 1 ou 2 integrações de maior impacto (ex.: SIEG + WhatsApp) e acrescentar o
  resto depois, sem retrabalho no núcleo.
