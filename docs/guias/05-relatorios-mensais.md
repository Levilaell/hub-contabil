# Guia 05 — Geração e envio de relatórios mensais

**Status:** análise de viabilidade · **Data:** jun/2026 · **Depende de:** dados já no hub (tarefas, prazos, documentos, exceções, painéis), `MessagingAdapter`, crons.

> Pergunta: vale o hub gerar e enviar relatórios mensais? Para quem (escritório ou cliente final)? O que é nativo vs adapter?

---

## 1. O que existe hoje
Os painéis (M6) e o dashboard são **visão interna** do escritório (farol por empresa, filas, prazos). Não há **relatório gerado** nem **envio recorrente** para ninguém — nem para o time, nem para o cliente final.

---

## 2. Vale a pena? — sim, e é barato, mas distinguir dois produtos

Há dois "relatórios mensais" muito diferentes, e confundi-los é o erro clássico:

### Relatório A — **operacional, do escritório para o cliente final** (alto valor, baixo risco)
"Olá, na competência 05/2026: recebemos 47 documentos seus, faltam 3, suas guias estão pagas/disponíveis, sua certidão X vence em 12 dias." É um **resumo de status e pendências** — exatamente o dado que o hub já tem. Reduz a ansiedade do cliente, reduz ligação ("e a minha empresa?"), e **posiciona o escritório como organizado**. É marketing de retenção do escritório embutido no produto.

### Relatório B — **contábil/gerencial** (DRE, balancete, fluxo de caixa) — **fora de escopo**
Isso sai do **ERP**, com base no plano de contas e nos lançamentos oficiais. O hub **não tem** esse dado (não faz lançamento — ver Guia 02) e **não deve** recalcular. No máximo, no futuro, *distribuir* um PDF que o ERP gerou (adapter de export), nunca *produzir* o número contábil.

**Veredito:** fazer o **Relatório A** (operacional). Não fazer o B. O A usa dado que já temos, custo ~zero, e é alto valor percebido.

---

## 3. Como funciona o Relatório A

### 3.1 Geração
- **Cron mensal** (já temos `recurrences-monthly` no dia 1) gera, por empresa, um snapshot da competência: documentos recebidos/esperados, pendências, prazos, status do farol, guias/certidões.
- Render em **HTML → PDF** (server-side) e/ou um **link de página** (reaproveita o mini-portal do cliente do Guia 04 — relatório é a "foto", portal é o "ao vivo").
- **Templates por firma** (logo, cores, blocos ligados/desligados) via config — o conteúdo é nativo, a aparência é configurável.

### 3.2 Envio
- Via `MessagingAdapter`: **e-mail** (Resend, rastreável) e/ou **WhatsApp** (template *utility* ~R$ 0,034/msg — "seu resumo de maio está pronto: link").
- **Prova de leitura** já é nativa (página pública loga visualização) — o escritório vê quem abriu.
- Disparo só após **conferência humana opcional** ("revisar antes de enviar ao cliente") — evita mandar relatório com pendência que era erro do próprio hub.

### 3.3 Relatório interno (bônus, esforço marginal)
O mesmo motor gera o **resumo do mês para o dono do escritório**: produtividade por departamento, exceções resolvidas, prazos cumpridos, empresas no vermelho. Reaproveita os agregados do dashboard. Vai por e-mail/WhatsApp no dia 1.

---

## 4. Custos

| Item | Custo | Observação |
| --- | --- | --- |
| Geração (cron + render PDF/HTML) | **R$ 0** | infra própria; dado já está no hub |
| Envio por e-mail | ~R$ 0 | dentro do free/baixo tier Resend |
| Envio por WhatsApp (proativo, *utility*) | ~R$ 0,034 / empresa / mês | é o hub iniciando conversa → template pago |
| **Total** | **~R$ 0–0,04 / empresa / mês** | desprezível |

O custo é praticamente nulo. O investimento é esforço de implementação (template engine + render PDF + agendamento), não custo recorrente.

---

## 5. Riscos
- **Mandar pendência falsa:** se o hub achar que "falta documento" mas o escritório já recebeu por fora, o relatório constrange. Mitiga com revisão humana opcional pré-envio e com a captura automática (Guia 01) reduzindo o falso-negativo.
- **Confundir com relatório contábil:** deixar explícito na copy que é *resumo operacional*, não balancete. Não usar números que o hub não produz.
- **Excesso de envio:** mensal é o certo; não cair em semanal/diário sem pedido.

---

## 6. Nativo vs Adapter

| Camada | Decisão | Porquê |
| --- | --- | --- |
| Motor de relatório (snapshot de competência, agregados) | **NATIVO** | Dado e lógica comuns a todos |
| Template/branding (logo, cores, blocos on/off) | **NATIVO** (config por firma) | É configuração, não código |
| Render HTML→PDF | **NATIVO** (lib server-side) | Sem fornecedor externo específico |
| Canal de envio (Resend, WhatsApp) | **ADAPTER** (`MessagingAdapter`, já existe) | Borda externa |
| *Distribuir* PDF gerado pelo ERP (Relatório B, futuro) | **ADAPTER** (`ErpAdapter`/export) | O número vem de fora; nós só entregamos |

---

## 7. Recomendação
1. **Relatório A operacional para o cliente final** — alto valor, custo ~zero, dado já existe. **Fazer.** Esforço ~5–8 d (template engine + PDF + cron + tela de revisão).
2. **Relatório interno para o dono** — esforço marginal sobre o A. **Fazer junto.**
3. **Relatório contábil (B)** — **não fazer**; no máximo distribuir o do ERP como adapter, no futuro.

**Prioridade:** média-alta. Fica ótimo **depois** que entrada (Guia 01) estiver ligada — com captura automática o "faltam X documentos" fica confiável, e aí o relatório vira ativo de retenção em vez de fonte de constrangimento.
