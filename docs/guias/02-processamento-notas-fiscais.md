# Guia 02 — Processamento/digitação de notas fiscais

**Status:** explicação + roadmap de valor · **Data:** jun/2026 · **Depende de:** `nfe.ts` (parser nativo), `mapping-rules.ts` (M9), `XmlSourceAdapter`, `ErpAdapter`.

> Pergunta que este guia responde: como o sistema processa nota fiscal hoje, onde está o limite, e como adicionar valor sem virar ERP.

---

## 1. Como funciona hoje

Há **dois caminhos**, e a diferença entre eles é a chave de todo o produto:

### 1.1 XML estruturado (NF-e, NFC-e, CT-e) — **automação total, sem IA**
- Parser determinístico em `packages/core/src/nfe.ts`: lê o XML e extrai emitente, CNPJ, chave de acesso, itens, **CFOP por item**, valores.
- **Nunca passa por LLM** (decisão cravada: XML é estruturado, IA seria custo e risco desnecessários).
- O XML autorizado é **imutável por lei** — nunca alteramos o arquivo. Dados derivados (CFOP de entrada, classificações) ficam em tabela separada referenciando o documento.
- O motor de regras de mapeamento (`mapping-rules.ts`, M9) traduz CFOP de origem → CFOP de entrada com precedência de 2 níveis (específica → geral); o que não casar vai para a **fila pendente** (o "nível 3"), nunca para um chute.

Resultado: para XML, o sistema **já faz a "digitação"** — extrai e estrutura tudo, sem humano. É o que um ERP tradicional faz na importação, só que com o motor de regras configurável por firma.

### 1.2 PDF / imagem (foto da nota, DANFE escaneado, NFS-e em PDF) — **classificação, não extração estruturada**
- A IA de visão (`packages/adapters/src/classification.ts`, Anthropic) **classifica o tipo** do documento e **extrai o CNPJ** para rotear.
- **Não extrai os campos** (itens, valores, CFOP). Ou seja: organiza e encaminha, mas a digitação fiscal em si ainda é manual.
- Confiança abaixo do threshold → fila de exceção com sugestão pré-preenchida.

**É exatamente aqui que está o limite atual** — e a oportunidade de valor.

---

## 2. Onde está a dor real do escritório

Para um escritório como a M Rocha (5.000+ notas/mês), a digitação manual relevante quase nunca é de NF-e — **o XML já existe e é capturável**. A dor mora em:
1. **NF-e cujo XML o escritório não tem** (cliente só mandou a foto/DANFE). → captar o XML resolve melhor que "ler a imagem".
2. **NFS-e (serviços):** fragmentada em milhares de prefeituras, muitas sem XML padronizado, frequentemente só PDF. **Esta é a digitação manual mais cara e real.**
3. **Notas de serviço tomado, recibos, faturas** sem padrão.

Conclusão estratégica: **o maior valor não é "OCR melhor da imagem" — é garantir o XML.** Ler imagem é o plano B para quando o XML não existe.

---

## 3. Como oferecer mais valor — três frentes

### Frente A — Captar o XML na fonte (maior alavanca, já mapeado)
Em vez de digitar/ler imagem, **trazer o XML automaticamente** via `XmlSourceAdapter`:
- `sieg` (M Rocha já é cliente SIEG), `plugstorage` (TecnoSpeed), ou DistDFe própria.
- Inclui **manifestação do destinatário** e **status de autenticidade na SEFAZ**.
- Cobre NFS-e padronizada de 1.200+ municípios (no caso SIEG).
- Detalhes/custos: `ADAPTERS.md` §1. Custo ~R$ 1–4/CNPJ/mês.

Efeito: a "digitação" de NF-e/NFC-e/CT-e/NFS-e padronizada **desaparece** — vira fluxo automático. Sobra só o resíduo realmente não estruturado.

### Frente B — Extração estruturada de PDF/imagem (o resíduo)
Para o que **não tem XML** (NFS-e de prefeitura sem padrão, recibo, fatura), evoluir da *classificação* para a *extração de campos*:
- Mesmo motor de IA (Claude vision), mas com schema de saída por tipo de documento (emitente, tomador, valor, competência, itens quando houver) validado por Zod.
- **AI nunca decide sozinha em ambíguo** (regra de ouro 5): confiança baixa → exceção com campos pré-preenchidos para o humano confirmar; a confirmação vira exemplo few-shot (já temos `classification_examples`).
- Para volume alto e custo previsível, avaliar OCR especializado (Google Document AI / AWS Textract) **atrás de um adapter** — mas começar com Claude vision, que já está integrado e é suficiente no volume residual.

> Cuidado de produto: extração estruturada de imagem **não** é fonte fiscal confiável para SPED — é um acelerador de digitação com revisão humana, não um substituto do XML autorizado. Vender como tal.

### Frente C — Entregar o resultado pronto para o ERP (fechar o ciclo)
O valor não é só extrair — é **entregar lançável**. Hoje o `ErpAdapter` v1 é `manual-export` (.zip + manifesto). Evoluir:
- **Já com CFOP de entrada resolvido** pelo motor de regras (M9) no manifesto.
- Conectores `alterdata-nfstock` / `dominio-onvio` (ADAPTERS.md §2) para importar direto, quando a API do plano do cliente permitir.

O diferencial competitivo é a cadeia **captar XML → classificar/extrair → resolver CFOP por regra da firma → entregar lançável**, com tudo que falhou caindo na mesma fila de exceção. Isso é o que o ERP sozinho não faz e o que justifica o hub.

---

## 4. O que NÃO fazer (limite com o ERP)
- **Não calcular imposto, não gerar SPED, não fazer o lançamento "oficial".** Isso é do ERP (AlterData/Domínio/Questor). O hub **alimenta**, não substitui (princípio do produto).
- Não prometer extração de imagem como equivalente legal ao XML.
- Não criar OCR próprio do zero — é um produto inteiro; usar serviço atrás de adapter se/quando precisar.

---

## 5. Nativo vs Adapter

| Camada | Decisão | Porquê |
| --- | --- | --- |
| Parser NF-e/NFC-e/CT-e (`nfe.ts`) | **NATIVO** | Layout nacional padronizado; igual para todos |
| Motor de regras de CFOP/mapeamento (M9) | **NATIVO** (regras são *config* por firma) | Algoritmo comum; os *valores* das regras variam por firma via tabela |
| Schema de extração por tipo de documento + validação Zod | **NATIVO** | Taxonomia e contrato comuns |
| Fonte do XML (`sieg`, `plugstorage`, DistDFe) | **ADAPTER** | Credencial/contrato específico do escritório |
| Motor de OCR/visão (Claude vs Document AI vs Textract) | **ADAPTER** (`DocumentExtractionAdapter`) | Permite trocar provider por custo/precisão sem mexer no miolo |
| Entrega ao ERP (`alterdata-nfstock`, `dominio-onvio`, `manual-export`) | **ADAPTER** | Cada ERP é um sistema externo distinto |

Padrão: **o que é lei/padrão nacional é nativo; o que é fornecedor/credencial é adapter.** A IA de extração é adapter porque o *provider* pode trocar; o *schema de saída* é nativo porque o contrato é nosso.

---

## 6. Recomendação (ordem de valor)
1. **Captar XML** (`sieg` para M Rocha) — mata a maior parte da "digitação" de uma vez. Prioridade 1.
2. **CFOP no manifesto de export** — fecha o ciclo até o ERP com o que já temos.
3. **Extração estruturada de PDF/imagem** com revisão humana — ataca o resíduo (NFS-e de prefeitura, recibos). Prioridade 2, atrás de adapter de extração.
4. Conector direto de ERP — quando a doc da API do plano do cliente confirmar import com CFOP (validação bloqueante no ADAPTERS.md §11).
