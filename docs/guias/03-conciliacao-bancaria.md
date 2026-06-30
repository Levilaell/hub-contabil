# Guia 03 — Conciliação bancária (análise de viabilidade)

**Status:** análise de viabilidade · **Data:** jun/2026 · **Depende de:** novo `BankDataAdapter`, motor de matching (nativo), fila de exceção (M4) e motor de regras (M9) já existentes.

> Pergunta: vale o hub fazer conciliação bancária? Se sim, com qual posicionamento — sem virar ERP e sem brigar com ele?

---

## 1. Onde a conciliação realmente acontece (e por que isso decide tudo)

Conciliação bancária mora **dentro do módulo contábil/financeiro do ERP** (AlterData Contábil, Domínio, Questor). O resultado é um **lançamento no razão**, amarrado ao plano de contas da firma — e essa etapa de *posting* é nativa do ERP. Hoje, na prática, o fluxo dominante é **manual**: baixar OFX de cada banco → importar no ERP → conciliar → lançar.

Isso define o limite do hub: **se tentarmos "ser o conciliador final" (dono do match + do lançamento), brigamos com o ERP e viramos redundantes.** O ERP é dono do razão. O hub não.

**Mas há uma cunha defensável:** a dor real e diária não é o algoritmo de match — é **obter o extrato limpo, padronizado e atualizado de muitos bancos**. OFX está degradando (cada banco gera de um jeito; Bradesco exporta até a data atual e gera divergência de saldo; tratamento registro a registro). É exatamente aí que Pluggy/Belvo vendem, e o que Conta Azul, Nibo e Contabilizei já fazem.

> **Posicionamento recomendado: alimentador + pré-conciliador com fila de exceção — não substituto do ERP.** Entregamos dados bancários limpos + pré-matches de alta confiança; o resto cai na fila de exceção; o lançamento oficial continua no ERP.

Esse posicionamento encaixa **perfeitamente** na arquitetura que já temos: fila de exceção (M4), motor de regras com aprendizado por resolução (M9), threshold de confiança da IA (regra de ouro 5). É o mesmo padrão da triagem, aplicado a transação bancária.

---

## 2. Como obter o dado bancário

### 2.1 Open Finance direto — **descartado**
Acessar Open Finance como receptor de dados exige ser **instituição autorizada pelo Banco Central** + passar na **certificação de conformidade** + gerir PKI/FAPI/auditoria. TecnoSpeed estima 3–12 meses só para habilitar, com manutenção contínua. **Inviável para o nosso porte.** Não é caminho.

### 2.2 Agregador licenciado — **o caminho real**
Plugamos num agregador que **já é** instituição autorizada pelo BC; nossos clientes "pegam carona" na autorização dele e nunca viram participantes regulados. Comparativo (2026):

| Provider | O que oferece | Preço público (2026) | Cobertura | DX |
| --- | --- | --- | --- | --- |
| **Pluggy** | Agregação de contas, histórico/extrato categorizado, posicionamento de conciliação automática, iniciação de pagamento. Já usado por Conta Azul, Nibo, Contabilizei. | **Trial grátis 14 d / 20 contas; Basic a partir de R$ 2.500/mês**; Custom sob consulta | 5 grandes bancos + Nubank, Inter, C6; painel de taxa de sucesso por banco | **Melhor** — docs públicas, sandbox, widget+SDK, webhooks; primeiros fluxos em 1–5 dias |
| **Belvo** | Agregação bancária (OFDA BR), histórico de transações, widget | **Launch US$ 1.000/mês** (~R$ 5–6k); Growth sob consulta; mín. 12 meses | Brasil + LatAm | Bom; mais enterprise |
| **Klavi** | Agregação PF+PJ, transações categorizadas, faturas de cartão | **Não público — comercial** | Principais bancos | API+SDK, docs menos abertas |
| **Quanto** | API para todos os participantes OF | **Não público — comercial** | Todos participantes OF | API-first, infra/enterprise |

**Referência de piso por conta:** revendas tipo "Banco MCP" (Pluggy por baixo) cobram ~**R$ 19,90/conta/mês** (R$ 49,90 por 5) — útil como teto/piso de economia unitária se o volume justificar negociar direto.

**Melhor fit:** **Pluggy** — único com preço público, integração mais rápida, melhor DX e já é padrão de fato entre SaaS contábeis BR. Belvo só ganha se houver plano de expansão LatAm. Klavi/Quanto exigem call comercial até para precificar.

### 2.3 OFX/arquivo — **fallback, não estratégia**
OFX ainda é o default dos ERPs em 2026, mas está degradando. Serve como **adapter de fallback** (`ofx-import`) para banco que o agregador não cobre bem ou cliente que não quer Open Finance — não como o caminho principal.

---

## 3. O custo escondido: o motor de match (o moat real)

Ingestão é os 20% fáceis (1–5 dias no Pluggy, dado já vem limpo e categorizado). **O motor de matching transação ↔ documento/lançamento é os 80% caros:**
- Match exato (valor+data) é trivial mas cobre só **40–60%**.
- A cauda exige **fuzzy/semântico**: datas que não batem, descritores variados ("AMZN MKTP" vs "Amazon"), taxas, pagamentos parciais, 1-para-N e N-para-1.
- Comparação par-a-par é O(n×m) e explode (10k×10k ≈ 50M) → precisa de **blocking** (faixa de valor, janela de data, prefixo) antes de pontuar.
- Sistemas sérios usam **score ponderado multifator** com bandas de confiança (auto ≥~95, revisão 70–94, rejeita <70) alimentando fila humana. Referências de mercado só atingiram 95%+ de auto-match após **meses de calibração e milhares de horas reais**.

**Implicação:** um v1 útil (exato + fuzzy simples de valor/data/descritor + fila de exceção) é **algumas semanas**. Um motor confiável de alto auto-match é **multi-mês de tuning contínuo** — e é justamente o diferencial, não o pull do dado. Dimensionar a engenharia para o **motor**, não para a ingestão.

---

## 4. Vale a pena? — veredito condicional

**Vale, mas é o item mais caro e arriscado dos cinco guias — e o de pré-requisitos mais pesados.** Decisão por fases:

- **Não é o próximo passo.** Entrada de documentos (Guia 01), notas (Guia 02), relatórios (Guia 05) e atendimento (Guia 04) têm relação custo/valor muito melhor e usam código já pago. Conciliação introduz **custo fixo recorrente** (agregador, a partir de ~R$ 2,5k/mês) e **um motor novo de meses**.
- **Faz sentido quando:** (a) houver massa de clientes que pague o custo fixo do agregador diluído; (b) o escritório sentir a dor de OFX como prioridade declarada; (c) já tivermos a base de documentos/lançamentos populada (o "outro lado" do match) — sem isso, não há contra o que conciliar.
- **Pré-condições comerciais:** validar com a M Rocha se a conciliação hoje é dor real ou já resolvida no AlterData; cotar Pluggy com volume real de contas; confirmar que o ERP aceita receber o pré-match (ou se entregamos OFX normalizado de volta).

**Recomendação:** **adiar**, mas reservar o desenho. Se entrar, entrar como **fase paga à parte**, posicionada como *alimentador + pré-conciliador*, começando por **ingestão Pluggy + match exato + fila de exceção** (semanas), e só investir no motor fuzzy se a adoção provar o valor.

---

## 5. Nativo vs Adapter

| Camada | Decisão | Porquê |
| --- | --- | --- |
| Fonte de dados bancários (`pluggy`, `belvo`, `ofx-import`) | **ADAPTER** (`BankDataAdapter`) | Credencial/contrato externo; trocável por custo/cobertura |
| Normalização de transação (modelo `bank_transactions`) | **NATIVO** | Contrato único; alimenta o match |
| Motor de matching (blocking + score + bandas de confiança) | **NATIVO** | É o moat; comum a todos; reusa fila de exceção (M4) e regras (M9) |
| Regras de conciliação por firma (tolerâncias, descritores recorrentes) | **NATIVO** (config/regras por firma) | Mesmo padrão do CFOP: algoritmo nativo, valores por firma |
| Devolução do resultado ao ERP (lançamento/pré-match) | **ADAPTER** (`ErpAdapter`) | O razão é do ERP |

Coerente com os outros guias: **fornecedor/credencial = adapter; algoritmo e contrato de dados = nativo.** O motor de match é o ativo mais valioso a manter nativo — é o que diferencia e não deve depender do agregador.

---

## 6. Resumo de uma linha
Conciliação **vale como cunha de "alimentador + pré-conciliador"**, nunca como substituto do ERP; **descartar Open Finance direto, usar Pluggy**; o custo real é o **motor de match (meses)**, não o dado; e é **a última das cinco frentes** por custo fixo e dependência da base já populada.
