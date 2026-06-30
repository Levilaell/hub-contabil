# Guia 01 — Entrada de documentos via WhatsApp e e-mail

**Status:** análise de evolução · **Data:** jun/2026 · **Depende de:** `MessagingAdapter`, novos `InboundChannelAdapter`, pipeline de triagem (M10, já nativo).

> Contexto: hoje a triagem por IA existe e funciona (`apps/worker/src/jobs/triage.ts` → parse → classifica → extrai CNPJ → resolve empresa → arquiva ou exceção). O que **falta** é a *entrada automática*: hoje alguém precisa subir o arquivo na mão. Este guia trata de plugar e-mail e WhatsApp como bocas de entrada que alimentam a triagem que já temos.

---

## 1. Por que isso é o item de maior alavancagem

A triagem já está construída e é o ativo caro. Sem captura automática, o gargalo volta a ser humano ("alguém baixa o anexo e sobe no sistema"). Ligar e-mail/WhatsApp transforma o item 1 do diagnóstico de **parcial → automático** sem reescrever o miolo. É o melhor retorno sobre código já pago.

**Princípio de arquitetura:** o canal é um detalhe de borda. Cada canal é um *adapter* que normaliza qualquer entrada para o mesmo contrato — um `InboundDocument { firm_id, source_channel, sender, received_at, attachments[], raw_ref }` — e enfileira em `pgmq:triage`. A triagem não sabe (nem deve saber) se o PDF veio de um Gmail, de um Outlook corporativo ou de um WhatsApp.

```
[e-mail Graph]  ─┐
[e-mail IMAP]   ─┤
[Gmail API]     ─┼─► InboundChannelAdapter.normalize() ─► pgmq:triage ─► (pipeline nativo já existente)
[WhatsApp Cloud]─┘
```

---

## 2. Canal e-mail

### 2.1 Opções de integração

| Adapter | Quando usar | Como funciona | Custo | Esforço |
| --- | --- | --- | --- | --- |
| `ms-graph-mail` | Escritório no Microsoft 365 (caso M Rocha) | OAuth app-only no tenant do cliente; *subscription* (webhook) ou *delta query* numa caixa/pasta dedicada; baixa anexos | Incluso no M365 do cliente | 3–5 d |
| `gmail-api` | Escritório no Google Workspace | OAuth + Pub/Sub *watch* na caixa; histórico incremental por `historyId` | Incluso no Workspace | 3–5 d |
| `imap-generic` | Caixas fora de Microsoft/Google (provedor próprio, Locaweb, etc.) | IMAP IDLE ou polling; menos robusto, sem webhook real | R$ 0 | 2–4 d |
| `inbound-parse` (Resend/Mailgun/Postmark) | Quando se quer um endereço **do produto** (ex.: `docs+m-rocha@hub…`) | Provedor recebe o e-mail e faz POST do parse (anexos já extraídos) para um webhook nosso | Resend/Postmark: incluso/baixo; ~US$0 até milhares/mês | 2–3 d |

### 2.2 Dois padrões de uso (não confundir)

1. **Monitorar a caixa existente do escritório** (`ms-graph-mail`, `gmail-api`, `imap-generic`): o cliente continua usando o e-mail de sempre; nós lemos uma pasta/rótulo (ex.: `Documentos`). Menor fricção de adoção, **maior risco de ruído** (a caixa tem de tudo). Mitiga-se filtrando por remetente conhecido (contatos das empresas) e por pasta dedicada.
2. **Endereço próprio do produto** (`inbound-parse`): damos um e-mail tipo `documentos@<escritorio>.hubcontabil.com`; o cliente final manda os anexos para lá. Entrada limpa, sem ruído, **mas exige mudar o hábito** de quem envia.

> Recomendação: começar com **(1) monitorar pasta dedicada** no caso M Rocha (já é Microsoft → `ms-graph-mail`, e combina com `onedrive-sync` do ADAPTERS.md), e oferecer **(2) endereço próprio** como upgrade para escritórios que querem canal limpo.

### 2.3 Riscos e regras
- **Deduplicação por hash** do anexo: a mesma NF chega por e-mail e por WhatsApp; o repositório já tem `documents.hash` — usar para idempotência antes de enfileirar.
- **Remetente desconhecido → fila de exceção** (não descartar): "documento recebido de e-mail não reconhecido" vira tarefa.
- **Spam/corpo sem anexo útil:** descartar silenciosamente só com regra explícita; na dúvida, exceção.
- **LGPD/retenção:** definir o que se guarda do e-mail original (metadados sim; corpo, só referência).

---

## 3. Canal WhatsApp

### 3.1 Caminho único aceitável: **WhatsApp Cloud API oficial (Meta)**
API não oficial (Evolution, Z-API, Baileys) é **proibida** — ban permanente do número do escritório, sem recurso, viola ToS. Já está cravado no `ADAPTERS.md` §3. Não reabrir.

### 3.2 Como funciona para *entrada*
- O escritório tem um **WABA** (WhatsApp Business Account) e um número dedicado, verificados no Meta Business (processo de 3–7 dias do cliente — entra no wizard de onboarding e no contrato).
- Webhook recebe mensagens *inbound* (cliente final manda foto/PDF da nota no Zap do escritório).
- Mídia inbound é baixada via Graph e normalizada para o mesmo `InboundDocument`.
- **Inbound é gratuito.** Custo só existe quando *nós* iniciamos conversa fora da janela de 24h (ver Guia 04).

### 3.3 Por que é o canal mais valioso no Brasil
O cliente final **já manda a nota no WhatsApp** — é o comportamento real. Captar isso elimina a etapa de "pede pro cliente mandar por e-mail/portal". É o canal de entrada com menor fricção do mercado brasileiro. O custo de entrada é zero; o investimento é o onboarding do número.

### 3.4 Esforço
6–10 d (app Meta, webhooks de inbound, download de mídia, onboarding multi-WABA). Compartilha quase toda a infra com o `whatsapp-cloud` de *saída* do Guia 04 — fazer os dois juntos.

---

## 4. Custos consolidados (entrada)

| Item | Custo | Observação |
| --- | --- | --- |
| E-mail via Graph/Gmail/IMAP | **R$ 0** | usa a licença que o escritório já paga |
| E-mail via inbound-parse | ~R$ 0 | dentro do free tier do provedor para o volume típico |
| WhatsApp **inbound** | **R$ 0** | Meta não cobra mensagem recebida |
| IA de triagem sobre o que entrar | ~R$ 0,10–0,50 / 10 docs não estruturados | já contabilizado no ADAPTERS.md §10 |

**Conclusão de custo:** a entrada automática é praticamente *custo zero variável*. O investimento é esforço de implementação e o onboarding do WhatsApp. É barato e de alto impacto.

---

## 5. Nativo vs Adapter

| Camada | Decisão | Porquê |
| --- | --- | --- |
| Contrato `InboundDocument` + enfileiramento em `pgmq:triage` | **NATIVO** (`packages/core` + worker) | É o ponto de costura universal; não varia por escritório |
| Deduplicação por hash, regra de remetente desconhecido → exceção, idempotência | **NATIVO** | Regra de negócio comum a todos |
| Cada canal concreto (`ms-graph-mail`, `gmail-api`, `imap-generic`, `inbound-parse`, `whatsapp-cloud-inbound`) | **ADAPTER** | Toca credencial/sistema externo específico do escritório; um cliente usa Microsoft, outro Google |
| Mapa "remetente → empresa" (qual contato pertence a qual CNPJ) | **NATIVO** (config por firma) | Dado de configuração, não código; já existe `contacts.preferred_channel` |

Regra geral que vale para todos os guias: **a borda (quem fala com o mundo externo) é adapter; o miolo (o que fazemos com o que chega) é nativo.**

---

## 6. Recomendação

1. **Fazer agora** (alto impacto, baixo custo, código de miolo já pronto): `ms-graph-mail` + `whatsapp-cloud-inbound` para a M Rocha. Pacote ~9–15 d somado.
2. Generalizar o contrato `InboundChannelAdapter` no core **na primeira implementação** (não na segunda) — é barato e evita retrabalho quando entrar o segundo escritório (Google).
3. `inbound-parse` (endereço próprio) como oferta opcional, não no primeiro corte.

**Validações antes de prometer em contrato:** verificação Meta Business do número (prazo do cliente); permissão de app-only no tenant Microsoft do escritório; definição da pasta/rótulo monitorado.
