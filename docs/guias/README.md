# Guias de evolução — Hub Contábil

Avaliações de viabilidade e implementação para as próximas frentes do hub. Cada guia responde **"vale a pena?"** e **"como — nativo ou adapter?"**, sempre dentro da tese do produto: **somar ao ERP, nunca substituí-lo.**

Complementam, não substituem: `ADAPTERS.md` (catálogo/custos de integração), `PLANEJAMENTO.md` (escopo v1), `CLAUDE.md` (regras de ouro).

> **Status (29/06/2026):** os guias **01 (entrada WhatsApp/e-mail)** e **04 (atendimento)** saíram do "avaliar" para **implementados e validados ao vivo** — WhatsApp Cloud API (entrada por webhook) + IMAP genérico (polling) alimentando a triagem, e tickets de atendimento com a IA respondendo o trivial ou escalando. Ver `AULA-CODEBASE.md` §17. Os guias seguem úteis como o "porquê" e o desenho da decisão; 02/03/05 continuam como análise.

## Os cinco guias

| # | Guia | Veredito | Custo recorrente | Esforço |
| --- | --- | --- | --- | --- |
| [01](01-entrada-documentos-whatsapp-email.md) | Entrada via WhatsApp + e-mail | **Fazer agora** — maior alavanca | ~R$ 0 (inbound grátis) | ~9–15 d |
| [02](02-processamento-notas-fiscais.md) | Processamento de notas fiscais | **Captar XML** mata a digitação; extração de imagem é o resíduo | ~R$ 1–4/CNPJ/mês (XML) | conforme adapter |
| [05](05-relatorios-mensais.md) | Relatórios mensais | **Fazer** o operacional (não o contábil) | ~R$ 0–0,04/empresa/mês | ~5–8 d |
| [04](04-atendimento.md) | Atendimento ao cliente | **Fazer com escopo cirúrgico** (auto-serviço + WhatsApp+IA) | reativo ~R$ 0 | ~5–8 d |
| [03](03-conciliacao-bancaria.md) | Conciliação bancária | **Adiar** — caro, motor de meses, depende de base populada | ~R$ 2,5k/mês (agregador) | semanas→meses |

## Ordem recomendada
1. **Entrada (01)** — transforma a triagem de parcial em automática; custo ~zero; miolo já pronto.
2. **Captar XML (02)** — elimina a maior parte da digitação fiscal.
3. **Relatórios (05)** — vira ativo de retenção **depois** que a entrada deixa o "faltam X documentos" confiável.
4. **Atendimento (04)** — reaproveita o WhatsApp dos passos anteriores e a base já populada.
5. **Conciliação (03)** — por último: custo fixo recorrente e motor de match de meses.

O WhatsApp aparece em três guias (01 entrada, 04 atendimento, 05 envio) — é **um único `whatsapp-cloud` compartilhado**, não três. Implementar uma vez, reusar.

## A régua nativo vs adapter (vale para todos)

> **A borda que fala com o mundo externo é adapter. O miolo que decide o que fazer com o que chega é nativo.**

- **Nativo (`packages/core` + worker):** o que é padrão nacional, lei, ou algoritmo de negócio comum a qualquer escritório — parser de XML, motor de regras (CFOP, conciliação), pipeline de triagem, motor de relatório, motor de matching, modelos de dados normalizados, contratos de entrada (`InboundDocument`, `bank_transactions`). **É o moat — não terceirizar.**
- **Adapter (`packages/adapters`):** o que toca credencial ou sistema externo específico de um escritório — canal de e-mail (Graph/Gmail/IMAP), WABA do WhatsApp, agregador bancário (Pluggy/Belvo), fonte de XML (SIEG/PlugStorage), ERP (AlterData/Domínio), provider de IA/OCR. **Trocável sem mexer no miolo.**
- **Config por firma (tabelas, não código):** valores que variam por escritório — regras de CFOP, FAQ, tolerâncias de conciliação, templates de relatório, mapa remetente→empresa, taxonomia. Regra de ouro 8: valores de negócio vivem em config.

Teste rápido: *"se o segundo escritório usar outro fornecedor, isto muda?"* Se sim → adapter. *"Isto é a mesma lógica para todos, só com valores diferentes?"* → nativo + config.
