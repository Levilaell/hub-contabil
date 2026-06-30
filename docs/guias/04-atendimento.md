# Guia 04 — Atendimento ao cliente (dúvidas)

**Status:** análise de viabilidade · **Data:** jun/2026 · **Depende de:** `MessagingAdapter` (`whatsapp-cloud`, `resend-email`), página pública (já existe), IA (já integrada).

> Pergunta: vale o hub assumir o **atendimento** (dúvidas dos clientes do escritório)? Se sim, como — WhatsApp, ticket, chatbot? E o que é nativo vs adapter?

---

## 1. O que existe hoje
Nada de atendimento geral. O que há é a **página pública por token** (`/s/[token]`) para o cliente baixar/enviar um documento de uma solicitação específica, e o envio rastreável por e-mail. Não há canal de dúvidas, ticket ou base de conhecimento.

---

## 2. A pergunta certa antes de "como": **vale a pena?**

Atendimento é um espaço perigoso — é fácil construir um helpdesk genérico e competir com Zendesk/Movidesk sem motivo. **O hub só deve entrar em atendimento onde tem vantagem injusta:** ele conhece o contexto do cliente (status fiscal, pendências, prazos, documentos). Um chatbot que sabe "sua certidão vence em 5 dias" e "faltam 3 documentos da competência 05/2026" vale; um chat genérico não.

**Recomendação de escopo:** não construir um helpdesk. Construir **atendimento contextual de baixo esforço**, em duas camadas:
1. **Auto-serviço contextual** (deflexão): o cliente vê o próprio status sem perguntar.
2. **Canal de dúvida assistido** que cai no WhatsApp já existente, com IA respondendo o trivial e escalando o resto para humano.

---

## 3. Modelo recomendado (em camadas, do barato ao caro)

### Camada 1 — Auto-serviço: "painel do cliente" mínimo (deflexão de dúvidas)
Estende a página pública de token para um **mini-portal por empresa** (link assinado, sem login pesado): mostra pendências, documentos solicitados, prazos próximos, guias disponíveis. A maioria das "dúvidas" do cliente é *"o que falta de mim?"* / *"cadê minha guia?"* — responder isso visualmente **elimina a pergunta**. Baixo esforço, reaproveita componentes (`StatusBadge`, `TrafficLight`).

### Camada 2 — Dúvida assistida por WhatsApp (o canal real)
- O cliente manda dúvida no **WhatsApp do escritório** (mesmo WABA do Guia 01/saída).
- **IA responde o trivial** com contexto do hub (status, prazos, "sua guia está no link X"), via RAG sobre os dados da empresa + FAQ configurável por firma.
- **Escala para humano** quando: confiança baixa, assunto fora do escopo, ou pedido explícito (regra de ouro: IA não decide sozinha). Vira tarefa/notificação para o time.
- **Janela de 24h e custo:** mensagem que *o cliente* inicia é **service message — gratuita** dentro da janela de 24h; só pagamos se *nós* iniciarmos fora dela (template *utility* ~R$ 0,034). Atendimento reativo é, portanto, quase custo zero.

### Camada 3 (opcional, só se houver demanda) — Ticket interno
Se o escritório quiser rastrear formalmente as conversas, um **modelo leve de ticket nativo** (`tickets`: empresa, assunto, status, canal, mensagens, anexos) com a MESMA estética de fila do produto (como a fila de exceção). **Não** integrar Zendesk/Movidesk no v1 — se um cliente exigir, vira `HelpdeskAdapter`. A maioria não precisa de ticket; precisa de WhatsApp organizado.

---

## 4. Por que WhatsApp e não "abrir ticket no portal"
No Brasil, o cliente de contabilidade **não abre ticket** — ele manda áudio/foto no Zap. Forçar um portal de tickets é remar contra o comportamento real e reduz adoção. O ticket, se existir, é a **visão interna** do time sobre conversas que entram pelo WhatsApp — não a porta de entrada do cliente. Isso espelha a decisão do Guia 01 (a entrada de documentos também é WhatsApp-first).

---

## 5. Riscos
- **Escopo infinito:** atendimento atrai pedidos ("responde imposto", "consultoria"). Travar a IA num escopo declarado e escalar o resto. Nunca deixar a IA dar orientação fiscal definitiva.
- **Responsabilidade:** resposta automática errada sobre prazo/valor é risco. Toda resposta com efeito fiscal deve ser *informativa com fonte* ("conforme o sistema, vence em…") e escalável, nunca conclusiva.
- **Custo de conversa proativa:** se o time começar a *iniciar* muitas conversas (lembretes, marketing), o custo sobe. Manter proativo restrito a *utility* (Guia 05) e reativo gratuito.

---

## 6. Nativo vs Adapter

| Camada | Decisão | Porquê |
| --- | --- | --- |
| Mini-portal do cliente (auto-serviço contextual) | **NATIVO** (estende página pública) | É o produto sabendo do próprio dado; vantagem injusta |
| Motor de FAQ/RAG contextual + regra de escalonamento | **NATIVO** | Lógica comum; o *conteúdo* da FAQ é config por firma |
| Modelo de ticket leve (se houver) | **NATIVO** | Mesma estética de fila do produto |
| Canal WhatsApp (WABA, webhooks) | **ADAPTER** (`whatsapp-cloud`, compartilhado com Guias 01 e 05) | Sistema/credencial externa por escritório |
| Provider de IA da resposta | **ADAPTER** | Trocável por custo/qualidade |
| Helpdesk externo (Zendesk/Movidesk) | **ADAPTER** (`HelpdeskAdapter`), só sob demanda | Integração específica de cliente; não nativo |

---

## 7. Veredito

**Vale — mas com escopo cirúrgico.** Não construir helpdesk. Construir:
1. **Auto-serviço contextual** (Camada 1) — alto valor, baixo esforço, reaproveita tudo. **Fazer.**
2. **Dúvida assistida por WhatsApp com IA + escalonamento** (Camada 2) — alto valor, custo reativo ~zero, compartilha o adapter de WhatsApp dos outros guias. **Fazer junto com o WhatsApp.**
3. Ticket interno (Camada 3) — só se um cliente pedir rastreio formal.

Esforço incremental sobre o WhatsApp já implementado: ~5–8 d para Camadas 1+2 (fora o WhatsApp em si). **Prioridade média** — depois de entrada (Guia 01) e relatórios (Guia 05), porque depende do mesmo canal e rende mais com a base de dados já populada.
