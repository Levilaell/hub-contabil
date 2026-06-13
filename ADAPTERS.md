# ADAPTERS.md — Biblioteca de Integrações · Viabilidade e Custos

**Versão 1.0 · Junho/2026.** Catálogo oficial de adapters do produto. Cada adapter implementa uma interface do `packages/adapters`. Esforços estimados em dias úteis de desenvolvimento com Claude Code (inclui testes e tela de config quando aplicável). Preços marcados **[cotar]** dependem de proposta comercial; valores ~ são estimativas a substituir.

---

## 1. `XmlSourceAdapter` — captura de documentos fiscais

| Implementação | Como funciona | Viabilidade | Custo variável | Esforço | Pré-requisitos |
|---|---|---|---|---|---|
| `manual-upload` ✅ v1 | Upload individual/massa na UI | Total | R$ 0 | pronto (base) | — |
| `sieg` | API key + e-mail; endpoints de download/upload, tags, **autenticidade (status SEFAZ)**; NFS-e padronizada de 1.200+ municípios | **Alta** — API madura; M Rocha já é cliente SIEG | **[cotar]** — preço não público, venda consultiva; estimar ~R$ 1–4/CNPJ/mês | 4–6 d | Vault A1 (certificados ficam no SIEG do escritório); conta SIEG ativa do escritório |
| `plugstorage` (TecnoSpeed) | DistDFe + monitoramento de e-mail com XML + armazenamento; contrato por licença p/ software house; módulo SPED (Fase 2) | **Alta** — modelo B2B2B feito para o nosso caso | **[cotar]** — por licença, sem custo por nota | 4–6 d | Vault A1; parceria TecnoSpeed |
| `qive` | API REST por papel na nota (received/emitted/...), manifestação, OCR p/ NFS-e sem webservice | Alta (técnica); fit comercial menor (foco deles migrou p/ empresas) | **[cotar]** | 4–6 d | Vault A1 |
| `dfe-distribution` (própria) | Web service nacional DistDFe, polling por NSU com A1 do cliente | **Média** — gratuito, mas NÃO cobre NFS-e e exige manutenção a cada mudança da SEFAZ | R$ 0 (infra própria) | 10–15 d + manutenção contínua | Vault A1 obrigatório; só faz sentido em escala, como redução de custo |

**Decisão pendente:** cotação SIEG × PlugStorage (cenários 50/200/500 CNPJs). Para a M Rocha, `sieg` é o caminho natural (já é cliente).

---

## 2. `ErpAdapter` — ponte com o sistema contábil

| Implementação | Como funciona | Viabilidade | Custo variável | Esforço | Pré-requisitos |
|---|---|---|---|---|---|
| `manual-export` ✅ v1 | Lote .zip renomeado + manifesto p/ importação manual | Total | R$ 0 | pronto (base) | — |
| `alterdata-nfstock` | **nf-stock (Alterdata)** tem API de envio/recebimento de documentos fiscais (NF-e, NFC-e, NFS-e, CT-e, NFCom) com token de autenticação, voltada a software houses | **Média-alta, condicionada ao plano** — o briefing diz "API liberada no plano"; confirmar se inclui nf-stock e se a importação seta CFOP | **[validar]** — possível custo de módulo no plano Alterdata do cliente | 8–15 d | Doc oficial da API; nf-stock no pacote do escritório |
| `alterdata-eplugin` | **ePlugin/eContador**: API para lançamentos contábeis (TXT no layout do Contábil via base64), DP (admissões, rubricas, rescisões) | Média — serve às fases Contábil/DP, não ao fiscal de notas | **[validar]** | 8–12 d | Plano com eContador/ePlugin |
| `alterdata-rpa` | Automação de browser na interface web do AlterData | **Baixa-média** — frágil, quebra a cada update; último recurso | R$ 0 | 15–25 d + manutenção alta | Homologação cuidadosa; nunca prometer SLA |
| `dominio-onvio`, `outros` | Catálogo futuro por demanda de cliente | a avaliar por caso | — | 10–20 d cada | — |

**Decisão pendente (bloqueante do upsell M Rocha):** obter documentação oficial das APIs Alterdata e confirmar: importação de XML em lote? CFOP na importação? geração de guias/SPED?

---

## 3. `MessagingAdapter` — envio e canais

| Implementação | Como funciona | Viabilidade | Custo variável | Custo fixo | Esforço |
|---|---|---|---|---|---|
| `resend-email` ✅ v1 | E-mail transacional com link rastreável | Total | — | Grátis até ~3 mil/mês; ~US$ 20/mês até 50 mil | pronto (base) |
| `copyable-link` ✅ v1 | Link assinado copiável (escritório cola onde quiser) | Total | R$ 0 | R$ 0 | pronto (base) |
| `whatsapp-cloud` | Cloud API oficial da Meta, WABA do escritório; templates utility p/ guias/cobranças; inbound gratuito alimenta a triagem | **Alta** — caminho oficial único aceitável | **Utility ≈ R$ 0,034/msg**; marketing R$ 0,3125 (evitar); janela 24h e inbound grátis | R$ 0 (sem BSP) | 6–10 d (app Meta, webhooks, aprovação de templates, onboarding multi-WABA) |
| ~~`evolution/z-api`~~ | API não oficial | **PROIBIDA** — ban permanente do número do escritório, sem recurso; viola ToS; prova jurídica frágil | — | — | — |

Onboarding do `whatsapp-cloud` por escritório: verificação Meta Business + número dedicado (3–7 dias de processo do cliente — incluir no wizard e no contrato).

---

## 4. `InboundMailAdapter` + `StorageSyncAdapter` — e-mail de entrada e drive

| Implementação | Como funciona | Viabilidade | Custo | Esforço |
|---|---|---|---|---|
| `ms-graph-mail` | Microsoft Graph monitora caixa do escritório; anexos → triagem | **Alta** — M Rocha usa Microsoft (OneDrive/SharePoint) | Incluso no M365 do cliente | 3–5 d |
| `imap-generic` | Caixas fora do ecossistema Microsoft/Google | Alta | R$ 0 | 2–4 d |
| `onedrive-sync` | Graph espelha pastas do produto no OneDrive/SharePoint do escritório (eles continuam vendo "as pastas de sempre") | **Alta** — reduz fricção de adoção na M Rocha | Incluso no M365 | 4–6 d |

Nota: se `plugstorage` for o hub de XML, parte do e-mail de entrada (XML em anexo) já vem resolvida por lá.

---

## 5. `CndProviderAdapter` — emissão automática de certidões

| Implementação | Cobertura | Viabilidade | Custo variável | Esforço | Pré-requisitos |
|---|---|---|---|---|---|
| `infosimples` | CND Federal (com lógica de 2ª via), Estaduais (API única p/ 27 UFs), CNDT, CRF/FGTS, municipais (capitais/grandes cidades) | **Alta** — developer-first; self-service com R$ 100 de crédito trial | **Por uso, decrescente com volume** (tabela própria + adicional em algumas consultas; calculadora no site); estimar ~R$ 0,30–1,50/emissão | 4–6 d (jobs assíncronos com polling — emissões levam de segundos a horas) | Vault A1 (consultas autenticadas transmitem .pfx) |
| `dootax` | 1.000+ tipos de CND nas 3 esferas; cobertura municipal maior | Alta — perfil enterprise; implantação 15–30 d | **[cotar]** | 6–10 d | Contrato comercial; Vault A1 |
| Scraping próprio | — | **PROIBIDO** — hCaptcha na Receita, instabilidade crônica; é um produto inteiro, não uma feature | — | — | — |

Regra de produto: cobertura municipal é parcial → degradação automática para tarefa humana; **nunca** prometer "qualquer cidade" em contrato.

---

## 6. `TaxAuthorityAdapter` — Receita Federal (Integra Contador / Serpro)

| Implementação | Como funciona | Viabilidade | Custo variável | Esforço | Pré-requisitos |
|---|---|---|---|---|---|
| `integra-contador` | APIs oficiais Serpro+RFB: PGDAS-D (transmitir), DAS (emitir), DEFIS, DCTF, DARF, SITFIS, caixa postal RFB, procurações eletrônicas — 87 serviços | **Alta** — API oficial, sem RPA no eCAC | **Bilhetagem por chamada**: DAS R$ 0,80/envio; emissão completa de DAS ≈ R$ 0,96 (3 chamadas) na faixa inicial; decresce por faixa | 8–12 d (auth com certificado, contratação, fluxos de declaração) | Contratação na Loja Serpro com e-CNPJ; procurações dos clientes finais |

⚠️ **Decisão build-vs-config:** o AlterData já embute o Integra Contador (rotina automática de DAS/DEFIS, R$ 0,80/envio, preço reduzido). Para clientes AlterData, ativar lá pode ser mais barato que construir — o adapter próprio vale para clientes de outros ERPs ou quando o fluxo precisa passar pelo nosso produto (ex.: enviar a guia com prova de visualização).

---

## 7. `CityHallAdapter` — prefeituras (serviços tomados / NFS-e local)

| Implementação | Como funciona | Viabilidade | Custo | Esforço |
|---|---|---|---|---|
| `giss-online` (Santos, Praia Grande) | Importação por arquivo no Giss (layout a obter); geração do arquivo a partir dos dados do produto + upload (API se houver, RPA se não) | **Condicionada** — "existe importação mas ela não sabe usar" (briefing); validar layout antes de prometer | R$ 0 | 4–8 d por prefeitura |
| `sao-vicente` | Sistema próprio; mesmo padrão de validação | Condicionada | R$ 0 | 4–8 d |
| `adn-nfse-nacional` | Ambiente de Dados Nacional da NFS-e (layout único, obrigatório p/ municípios desde 01/2026, adesão gradual) | **Crescente** — tende a substituir integrações municipais ao longo de 2026–27 | R$ 0 | 8–12 d (fase futura) |

Regra: adapter de prefeitura só entra em proposta **depois** de obter o layout oficial — nunca antes.

---

## 8. `CnpjEnrichmentAdapter` — dados cadastrais

| Implementação | Viabilidade | Custo | Esforço |
|---|---|---|---|
| `brasilapi` + `receitaws` (fallback) ✅ v1 | Total p/ volume de onboarding | Grátis (rate limit; fila com throttling) | pronto (base) |
| `cnpja` / `serpro-cnpj` | Total | Pago por consulta (centavos) | 1–2 d |
| `rfb-open-data` (base própria) | Total | Infra própria (dump mensal ~GB) | 5–8 d — só com dezenas de escritórios |

---

## 9. Módulo pré-requisito: `CertificateVault` (não é adapter, é fundação)

Necessário antes de: `sieg`/`plugstorage`/`dfe-distribution`, `infosimples`/`dootax`, `integra-contador`. KMS/secret manager, chave por tenant, auditoria por uso, bloqueio gracioso no vencimento, cláusula contratual de autorização. **Esforço: 5–8 d.** Risco existencial se malfeito — não comprimir.

---

## 10. Tabela consolidada de custos (visão comercial)

Custos variáveis por empresa monitorada/mês (premissas: 4 guias WhatsApp, 4 emissões CND, captura XML ativa):

| Componente | Custo/empresa/mês | Status |
|---|---|---|
| Hub de XML (SIEG ou PlugStorage) | ~R$ 1,00–4,00 | [cotar] |
| CNDs automáticas (4 × ~R$ 0,80) | ~R$ 1,20–6,00 | [cotar — calculadora Infosimples] |
| WhatsApp utility (4 × R$ 0,034) | ~R$ 0,14 | confirmado |
| Integra Contador (1 DAS/mês) | ~R$ 0,80–0,96 | confirmado (avaliar via AlterData) |
| IA de triagem (~10 docs não estruturados) | ~R$ 0,10–0,50 | premissa interna |
| E-mail/Graph/enriquecimento | ~R$ 0 | confirmado |
| **Total variável** | **~R$ 3–12/empresa/mês** | piso da precificação |

Esforço de implantação por adapter (insumo para precificar setup por cliente):

| Pacote de implantação | Adapters | Esforço total |
|---|---|---|
| Essencial | `sieg` + `ms-graph-mail` + `onedrive-sync` | ~12–17 d |
| Comunicação | `whatsapp-cloud` | ~6–10 d |
| Conformidade | `CertificateVault` + `infosimples` | ~9–14 d |
| Federal | `integra-contador` | ~8–12 d |
| ERP | `alterdata-nfstock` (condicionado à doc) | ~8–15 d |
| Prefeituras | `giss-online` / `sao-vicente` (cada) | ~4–8 d |

---

## 11. Validações bloqueantes em aberto (antes de qualquer proposta com adapter)

1. Documentação oficial das APIs Alterdata (nf-stock incluso no plano da M Rocha? importação em lote? CFOP? guias/SPED?).
2. Cotação SIEG × PlugStorage (50/200/500 CNPJs).
3. Cotação Infosimples (calculadora com a lista real de certidões dos leads) × Dootax.
4. Layouts de importação Giss Online e São Vicente.
5. Modelo do WhatsApp por escritório (verificação Meta Business no onboarding).
