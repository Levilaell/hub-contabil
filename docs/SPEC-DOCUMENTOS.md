# Spec — Redesenho do módulo Documentos (T35)

> Proposta de 1 página para aprovação do Levi (itens 20, 22, 23 e 25 da rodada de
> 10/07). Nada daqui foi implementado. Aprovando, vira as tarefas T36–T38 no
> TAREFAS.md, executadas uma a uma.

## Problemas que a proposta ataca

1. **Classificação errada com confiança alta arquiva sozinha** (boleto → "nfe"): só XML
   de NF-e tem caminho determinístico; para PDF/imagem não há nenhuma guarda além do
   limiar de confiança.
2. **Caixa de entrada sem saída**: ela lista documentos que a triagem não arquivou, mas a
   resolução acontece em outra tela (Exceções) — o usuário não entende o que fazer ali.
3. **Documento sem contexto**: não dá para ver por onde um documento chegou (WhatsApp de
   quem? e-mail? upload?), nem quando, nem com que confiança foi classificado.
4. **Estrutura confusa**: a navegação nível-0 (escolher empresa) → caixa de entrada →
   documentos da empresa mistura dois mundos (triagem pendente × repositório).

## Proposta

### T36 · Guardas determinísticas na triagem (worker + core, sem UI nova)

Regra pura no core, aplicada após a classificação da IA e antes da decisão de arquivar:

- **Tipo XML-nativo exige XML**: se a IA sugerir `nfe`, `nfce` ou `cte` para um arquivo
  que não é XML, a confiança é **limitada abaixo do limiar** → o documento vai para a
  fila de exceções com a sugestão pré-preenchida (a IA nunca decide sozinha um caso
  implausível). *Caso DANFE (PDF de NF-e): cai em exceção com 1 clique para confirmar —
  preferimos um clique humano a auto-arquivar um boleto como nota.* `nfse` fica fora da
  guarda (prefeituras emitem em PDF).
- **Sinal do nome do arquivo**: se o nome contém um termo inequívoco de outro tipo
  (`boleto`, `fatura`, `extrato`, `holerite`, `comprovante`) e a IA sugeriu um tipo
  conflitante, idem — exceção com sugestão. Lista de termos em config (regra nº 8).
- Registrado no contexto da exceção o motivo (`implausible_type`), visível na tela.

### T37 · Caixa de entrada com resolução no lugar

- A caixa de entrada ganha, por documento, o mesmo formulário de resolução que hoje
  vive em Exceções: **empresa + tipo + departamento pré-preenchidos pela sugestão da
  IA**, botões "Arquivar assim" e "Corrigir e arquivar". Reusa a RPC
  `apply_triage_suggestion` existente (correção continua alimentando o few-shot).
- A exceção correspondente é resolvida automaticamente ao arquivar por ali (e
  vice-versa) — uma pendência, dois lugares de resolver, zero duplicidade.
- Renomear na UI: "Caixa de entrada" → **"Pendentes de arquivamento"** (diz o que é).

### T38 · Origem e contexto visíveis por documento

- O drawer do documento ganha bloco **"Origem"**: canal (WhatsApp/e-mail/upload/link de
  solicitação), remetente quando houver (número/e-mail formatado, com link para o
  ticket), data de chegada e **como foi classificado** (IA com X% de confiança + modelo,
  ou humano) — os dados já existem (`documents.source`, `inbound_messages`,
  `classifications`); falta só ligar remetente↔documento (coluna `inbound_message_id`
  em `documents`, nova migration).
- Na lista, o fato "há 2 dias · WhatsApp" substitui o caminho técnico.

### Estrutura (decisão leve embutida — veto se discordar)

Mantém-se a navegação atual (empresas → documentos da empresa), com duas mudanças:
"Pendentes de arquivamento" vira a PRIMEIRA seção do nível 0 (sempre visível, com
contagem, mesmo vazia — hoje some quando zera, o que esconde o conceito), e a busca
global continua sempre visível. Sem abas novas.

## O que NÃO muda (regras de ouro)

XML autorizado permanece imutável; associação de empresa continua pelo CNPJ extraído
do documento (sem fallback de remetente); tudo que a automação não resolve continua
caindo na fila de exceções; limiar de confiança continua em config.

## Custo estimado

T36 ~meio dia (core puro + testes + worker). T37 ~1 dia (UI + integração com a RPC).
T38 ~1 dia (migration leve + drawer + lista). Total: ~2,5 dias de execução, um commit
e deploy por tarefa, como nas anteriores.
