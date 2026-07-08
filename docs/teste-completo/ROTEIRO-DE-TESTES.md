# Roteiro de Testes Completo — Hub Contábil

*Gerado em 08/07/2026 · cobre todas as funcionalidades em produção (base + Fase 1.1 + respostas do Paulo)*

Como usar: siga as partes em ordem (a Parte 0 prepara o terreno para as demais).
Cada teste tem **Faça** (passos) e **Esperado** (o que deve acontecer). Marque os
checkboxes; quando algo divergir do esperado, anote ao lado o que aconteceu.

Os arquivos citados estão em **`docs/teste-completo/arquivos/`**.

### CNPJs fictícios usados nos arquivos (todos com dígitos verificadores válidos)

| CNPJ | Quem é | Onde aparece |
|------|--------|--------------|
| `45.723.174/0001-10` | **EMPRESA TESTE HUB LTDA** (você cadastra na Parte 0) | todos os PDFs, NFS-e, destinatário da NF-e |
| `99.887.766/0001-05` | FORNECEDOR EXEMPLO (emitente da NF-e) | `nfe-exemplo.xml`, `regras-cfop-exemplo.csv` |
| `23.145.678/0001-68` · `34.982.341/0001-21` · `11.290.987/0001-42` | empresas da planilha de importação | `empresas-importacao-exemplo.csv` |

### Estado do ambiente que afeta os testes

- **E-mail (Resend) sem chave** → envios de e-mail de solicitação/lembrete são simulados
  (o sistema diz que enviou, mas nenhum e-mail real sai). Use "Copiar link" nesses testes.
- **Crons acelerados** (`CRON_ACCELERATED=true`) → varredura de prazos, recorrências e
  lembretes rodam **a cada 10 segundos** — ótimo para testar prazos sem esperar um dia.
- **WhatsApp em número de teste da Meta** → só entrega para telefones cadastrados na
  lista de destinatários do painel da Meta (vale para você e para o Paulo).
- **Token do WhatsApp** válido até 06/09/2026 (longa duração).

---

## Parte 0 — Preparação (15 min, habilita o resto do roteiro)

- [ ] **0.1 Configurações → Atendimento**: ligar **"Deixar a IA responder dúvidas simples"**;
  no FAQ, colar (uma linha cada):
  `Qual o horário de atendimento? | De segunda a sexta, das 8h às 18h.`
  `Como envio um documento? | Pode mandar o arquivo aqui mesmo pelo WhatsApp que nós recebemos.`
- [ ] **0.2 Configurações → Menu de recepção**: ligar, manter a saudação padrão e colar nas opções:
  `📊 Contabilidade | contabil`
  `🧾 Fiscal | fiscal`
  `👥 Departamento Pessoal | dp`
- [ ] **0.3 Tarefas → Recorrentes → Nova**: título `Apuração PGDAS`, departamento Fiscal,
  alvo **por regime** = Simples Nacional. (Vai alimentar os testes 3.2 e 3.6.)
- [ ] **0.4 Meta (painel developers.facebook.com → app → WhatsApp → Configuração da API)**:
  conferir que **seu número e o do Paulo** estão na lista de destinatários ("Para").
- **Esperado geral:** cada "Salvar" confirma com "Configurações salvas." e gera linha na Auditoria.

---

## Parte 1 — Acesso e permissões

- [ ] **1.1 Login/logout**: sair e entrar de novo. *Esperado:* rota interna sem login redireciona
  para o login; após entrar, cai no painel Início.
- [ ] **1.2 Papéis** (se tiver um usuário `staff` de teste): entrar como staff de UM departamento.
  *Esperado:* em Tarefas ele só vê tarefas do(s) departamento(s) dele; Configurações fica
  somente-leitura ("Apenas titulares e gestores…"); /usuarios não permite editar.
- [ ] **1.3 Usuários** (como owner): Configurações → Usuários — criar/editar um usuário, trocar
  papel e departamentos. *Esperado:* mudanças aparecem na hora e a Auditoria registra.

---

## Parte 2 — Configurações

- [ ] **2.1 Parâmetros gerais**: mudar "Prazo de alerta padrão" para 15 e salvar; voltar para 30.
  *Esperado:* salva, e novos prazos monitorados usam o valor vigente como sugestão.
- [ ] **2.2 Validação**: tentar limite de confiança = 2. *Esperado:* mensagem de erro em português,
  nada salvo.
- [ ] **2.3 Avançado** (Configurações → Configuração avançada): renomear um departamento (ex.:
  "Societário / Compliance" → "Societário"). *Esperado:* o novo rótulo aparece em Tarefas,
  Documentos, contatos e no filtro do Atendimento. (Pode reverter depois.)
- [ ] **2.4 FAQ e menu** (feitos na Parte 0): reabrir a tela. *Esperado:* textarea mostra
  exatamente o que você salvou, no formato `Pergunta | Resposta` / `Rótulo | departamento`.

---

## Parte 3 — Empresas (cadastro)

- [ ] **3.1 CNPJ-primeiro com CNPJ real**: Empresas → Nova → digite um CNPJ real da carteira →
  "Buscar dados do CNPJ". *Esperado:* formulário aparece preenchido (razão social, endereço,
  CNAE, capital, natureza jurídica, porte) + lista de sócios "serão cadastrados juntos";
  regime sugerido se for Simples/MEI. Salvar → página da empresa com tudo em
  "Mais dados cadastrais" e a seção **Sócios** preenchida.
- [ ] **3.2 CNPJ-primeiro com CNPJ fictício** (testa o fallback): Nova → `45.723.174/0001-10` →
  "Buscar dados". *Esperado:* aviso "Não foi possível buscar os dados agora — preencha
  manualmente" e o formulário abre vazio. Preencha: razão social **EMPRESA TESTE HUB LTDA**,
  regime **Simples Nacional**, e salve. *Esperado 2:* como existe o template da Parte 0.3,
  a tarefa **"Apuração PGDAS" de julho aparece em Tarefas imediatamente**.
- [ ] **3.3 Editar**: na EMPRESA TESTE, editar → abrir "Dados adicionais" → preencher inscrição
  estadual e capital social → salvar. *Esperado:* valores aparecem em "Mais dados cadastrais"
  e os campos que você não mexeu continuam como estavam.
- [ ] **3.4 Sócios**: na aba Dados da EMPRESA TESTE → Sócios → adicionar `MARIA OLIVEIRA`,
  participação 60. Editar para 65. Remover e recriar. *Esperado:* CRUD fluido, participação
  fora de 0–100 é recusada com mensagem clara.
- [ ] **3.5 Arquivar/restaurar**: arquivar a EMPRESA TESTE → tentar cadastrar de novo o mesmo
  CNPJ. *Esperado:* mensagem "já pertence a uma empresa arquivada — restaure". Restaurar.
- [ ] **3.6 Importação por planilha**: Empresas → Importar planilha →
  `arquivos/empresas-importacao-exemplo.csv` → analisar → importar.
  *Esperado:* 3 "prontas", importadas; a PADARIA e a CLÍNICA (Simples) ganham a tarefa
  "Apuração PGDAS" na hora; o enriquecimento roda em segundo plano e **falha** para esses
  CNPJs fictícios → em alguns minutos surgem 3 exceções de "Enriquecimento" (comportamento
  correto: nada fica preso silenciosamente). Resolva-as com "Resolver" + observação.
- [ ] **3.7 Reimportar a mesma planilha**: *Esperado:* as 3 linhas marcadas como "Duplicada",
  nenhuma criada de novo.

---

## Parte 4 — Contatos por departamento

- [ ] **4.1 Criar**: na EMPRESA TESTE → Contatos → `Ana Fiscal`, e-mail `ana@teste.com`,
  marcar departamento **Fiscal**. Criar também `Geral Teste`, e-mail `geral@teste.com`,
  **sem marcar departamento** e como **principal**. *Esperado:* a lista mostra
  "Fiscal" na Ana e "Todos" no Geral.
- [ ] **4.2 Seu telefone como contato**: adicionar um contato com **seu celular** (com DDD) na
  EMPRESA TESTE. (Habilita a IA do WhatsApp a achar sua empresa — Parte 12.)
- [ ] **4.3 Sugestão determinística**: aba Solicitações da EMPRESA TESTE → nova solicitação de
  envio, tipo esperado **das** → criar → na tela Solicitações, abrir e "Enviar por e-mail"
  **sem digitar destinatário**. *Esperado:* vai para `ana@teste.com` (das → Fiscal → Ana
  vence o "Todos"), visível na linha do tempo/auditoria. Digitando outro e-mail, o digitado
  vence. *(E-mail real não sai — Resend pendente; o que se valida é o destinatário escolhido.)*

---

## Parte 5 — Tarefas

- [ ] **5.1 Filtro de mês**: abrir Tarefas. *Esperado:* abre em « Julho 2026 »; setas navegam;
  "voltar ao mês atual" aparece fora do mês corrente; "Todos os meses" mostra tudo.
- [ ] **5.2 Chips de departamento**: clicar em Fiscal. *Esperado:* só tarefas do Fiscal
  (a "Apuração PGDAS" incluída); "Todos os departamentos" volta ao geral.
- [ ] **5.3 Criar tarefa ad-hoc** sem competência. *Esperado:* ela aparece em QUALQUER mês
  selecionado (tarefas sem competência são sempre visíveis).
- [ ] **5.4 Transições**: abrir a tarefa → Iniciar → Concluir. *Esperado:* muda de coluna a cada
  ação; concluída não oferece mais transições (estado final).
- [ ] **5.5 Handoff**: criar tarefa no Fiscal com "Repassar ao concluir" = Contábil → Iniciar →
  "Concluir e repassar". *Esperado:* a original conclui e **nasce uma pendente no Contábil**
  vinculada; o sino de notificações acusa o repasse.
- [ ] **5.6 Recorrentes**: em Tarefas → Recorrentes, desativar e reativar o template.
  *Esperado:* lista reflete o estado; só owner/manager pode gerenciar.

---

## Parte 6 — Prazos (farol)

- [ ] **6.1 Prazo a vencer**: na EMPRESA TESTE → aba Prazos → adicionar certidão com vencimento
  **daqui a 5 dias**, alerta 30 dias. *Esperado:* status "Vence em breve" (amarelo); o farol
  da empresa fica amarelo; a tela global Prazos lista em "Precisam de atenção".
- [ ] **6.2 Prazo vencido + tarefa automática**: adicionar outro com vencimento **ontem**.
  *Esperado:* "Vencido" (vermelho); farol vermelho; em até ~1 min (cron acelerado) surge a
  tarefa **"Renovar …"** no departamento Societário/Compliance + notificação no sino.
- [ ] **6.3 Dashboard**: Início. *Esperado:* card "Prazos a vencer" conta os dois; o painel de
  empresas mostra a EMPRESA TESTE com farol vermelho no topo (ordenação por severidade).

---

## Parte 7 — Documentos (repositório)

- [ ] **7.1 Upload manual**: Documentos → EMPRESA TESTE → "Enviar documentos" →
  `arquivos/boleto-exemplo.pdf`, tipo **boleto**, competência 2026-07. *Esperado:* aparece
  na lista com tipo e competência; preview abre no drawer; download funciona.
- [ ] **7.2 Dedup**: subir o MESMO arquivo de novo na mesma empresa. *Esperado:* marcado
  como "Duplicado (ignorado)".
- [ ] **7.3 Busca global**: voltar para Documentos (sem escolher empresa) e buscar `boleto`.
  *Esperado:* resultado listado **com o nome da empresa** na linha; "Limpar busca" volta à
  lista de empresas.
- [ ] **7.4 Filtros na empresa**: dentro da EMPRESA TESTE, busca + filtro de departamento estão
  **visíveis sem abrir nada**; competência/tipo ficam em "Mais filtros".
- [ ] **7.5 Corrigir tipo**: abrir um documento → "Corrigir tipo" → trocar e salvar.
  *Esperado:* tipo atualizado; a Auditoria registra `classification.corrected`.
- [ ] **7.6 Remover**: remover o duplicado de teste, se criado. *Esperado:* some da lista
  (e o arquivo é apagado do storage).

---

## Parte 8 — Triagem por IA (use a caixa "Triagem por IA" na tela Documentos)

> Envie um arquivo por vez e aguarde ~15–30s antes de conferir. Todos os PDFs citam o CNPJ
> da EMPRESA TESTE — é assim que a IA descobre de quem é o documento.

- [ ] **8.1 DAS (caminho feliz)**: enviar `das-exemplo.pdf`. *Esperado:* some da caixa de entrada
  e aparece **na EMPRESA TESTE** como tipo `das`, departamento Fiscal, com o ícone ✨
  ("classificado por IA").
- [ ] **8.2 Folha de pagamento**: enviar `folha-pagamento-exemplo.pdf`. *Esperado:* arquivado
  como `payslip` no **DP**.
- [ ] **8.3 Contrato social**: enviar `contrato-social-exemplo.pdf`. *Esperado:* arquivado como
  `articles_of_incorporation` no **Societário/Compliance**.
- [ ] **8.4 Departamento por conteúdo**: enviar `comprovante-pagamento-exemplo.pdf`.
  *Esperado:* tipo `payment_receipt` — e como esse tipo **não tem rota fixa**, o departamento
  vem da leitura do conteúdo (pagamento a fornecedor → tende a Contábil/Financeiro). Se a IA
  ficar em dúvida, cai em Exceções com a sugestão pronta — os dois desfechos são corretos.
- [ ] **8.5 NF-e XML (sem IA)**: enviar `nfe-exemplo.xml`. *Esperado:* classificação
  **determinística** instantânea: tipo `nfe`, 100% de confiança — mas o CNPJ do **emitente**
  (99.887.766/0001-05) não é empresa da carteira → **exceção "Empresa não encontrada"**
  com a sugestão `nfe`. É o gancho da Parte 9.1.
- [ ] **8.6 NFS-e XML (fallback por texto)**: enviar `nfse-exemplo.xml`. *Esperado:* antes viraria
  "outros" direto; agora a IA lê o XML e classifica (`nfse`, Fiscal, empresa TESTE).
- [ ] **8.7 Arquivo sem suporte**: enviar `arquivo-nao-suportado.txt`. *Esperado:* exceção
  ("IA em dúvida — confirme o tipo", confiança 0) — a triagem não processa .txt.
- [ ] **8.8 Duplicata**: enviar `das-exemplo.pdf` **de novo** pela triagem. *Esperado:* nada novo
  aparece — a cópia é descartada como duplicata (Auditoria registra
  `document.duplicate_discarded`).

---

## Parte 9 — Exceções (o fechamento do ciclo)

- [ ] **9.1 Arquivar documento**: abrir a exceção da NF-e (8.5) → **"Arquivar documento"** →
  a sugestão vem legível (`nfe · confiança 100%`); escolher empresa = EMPRESA TESTE →
  "Aplicar e resolver". *Esperado:* exceção resolvida, documento aparece no repositório da
  empresa como `nfe`/Fiscal, e a correção vira exemplo de aprendizado da IA.
- [ ] **9.2 Regra de CFOP a partir de exceção**: o motor de CFOP roda no **upload manual** de
  XML. Envie `arquivos/nfe-exemplo-2.xml` pelo botão "Enviar documentos" da EMPRESA TESTE
  (tipo `nfe`). *Esperado:* o CFOP `5405` do fornecedor 99.887.766/0001-05 não tem de-para →
  surge exceção de **Regras** → abrir → **"Salvar como regra"** → CFOP de entrada `1403`.
  Regra criada (visível em Regras de CFOP), exceção resolvida; a próxima nota igual
  resolve sozinha.
- [ ] **9.3 Resolver/ignorar**: em uma exceção qualquer, testar "Ignorar" com observação.
  *Esperado:* sai da lista "Abertas"; o filtro "Ignoradas" a encontra com a observação.
- [ ] **9.4 Badge**: o número no item "Exceções" da sidebar bate com a lista de abertas.

---

## Parte 10 — Regras de CFOP e Exportação

- [ ] **10.1 Regra manual**: Regras de CFOP → Nova regra: origem `5102`, fornecedor em branco
  (geral), entrada `1102`. *Esperado:* aparece como "Geral · Qualquer fornecedor".
- [ ] **10.2 Importar planilha de regras**: importar `arquivos/regras-cfop-exemplo.csv`.
  *Esperado:* a linha `5102 → 1102` entra; a linha `5405` do fornecedor acusa
  **"Já existe uma regra igual"** se você fez o 9.2 — é o aviso correto de duplicidade,
  não um defeito.
- [ ] **10.3 Exportação**: Exportação → novo lote: EMPRESA TESTE, competência em branco, todos
  os tipos → Pré-visualizar. *Esperado:* resumo mostra quantos documentos entram e quantos
  ficam de fora por CFOP pendente (a NF-e que entrou pela triagem em 8.5/9.1 não passou pelo
  motor de CFOP e pode aparecer como pendente — esperado). Gerar lote → baixar .zip →
  conferir os arquivos dentro, organizados. Gerar o MESMO lote de novo → aviso de
  "já exportados antes".

---

## Parte 11 — Solicitações e página pública

- [ ] **11.1 Pedir documento**: EMPRESA TESTE → Solicitações → "Solicitar envio", tipo esperado
  `das` → **Copiar link** (só aparece uma vez!). *Esperado:* status "Enviado".
- [ ] **11.2 Página pública**: abrir o link em **aba anônima** (sem login). *Esperado:* página
  pública com o pedido; na tela interna o status vira **"Visualizado"**.
- [ ] **11.3 Upload público**: pela página pública, enviar `das-exemplo.pdf`. *Esperado:* status
  **"Recebido"**; o arquivo aparece no repositório da empresa (e passa pela triagem).
  ⚠ Se você já fez o 8.1, este upload é o mesmo arquivo → a triagem descarta a cópia
  como duplicata; o status "Recebido" permanece (correto).
- [ ] **11.4 Rotação de link**: em outra solicitação, "Gerar e copiar link" duas vezes; tentar
  abrir o PRIMEIRO link. *Esperado:* o link antigo diz inválido/expirado; só o mais novo abre.
- [ ] **11.5 Disponibilizar documento**: criar solicitação "Disponibilizar documento" escolhendo
  um arquivo → abrir o link público → baixar. *Esperado:* download ok; status **"Baixado"**.
- [ ] **11.6 Cancelar**: cancelar uma solicitação aberta. *Esperado:* o link para de funcionar.
- *(Lembrete automático por e-mail: só dispara 3 dias após o envio e depende da chave Resend —
  fora deste roteiro.)*

---

## Parte 12 — Atendimento + WhatsApp (pré-requisitos: 0.1, 0.2, 0.4 e 4.2)

> Ordem importa — o menu de recepção conversa com você antes da IA.

- [ ] **12.1 Menu de recepção**: mande `oi` do seu celular. *Esperado:* chega o menu numerado
  (saudação + 3 opções + instruções voltar/fim).
- [ ] **12.2 Opção inválida**: responda `9`. *Esperado:* o menu vem de novo.
- [ ] **12.3 Escolher departamento**: responda `2`. *Esperado:* confirmação "✅ 🧾 Fiscal — pode
  enviar sua mensagem…"; no painel, a conversa aparece marcada **Fiscal** e o filtro de
  departamento do Atendimento a encontra.
- [ ] **12.4 IA com contexto**: pergunte `qual o nome da minha empresa?`. *Esperado:* a IA
  responde citando **EMPRESA TESTE HUB LTDA** (achou você pelo telefone do contato 4.2).
- [ ] **12.5 IA com FAQ**: pergunte `qual o horário de atendimento?`. *Esperado:* resposta do FAQ.
- [ ] **12.6 Fora de escopo**: pergunte algo fora (ex.: `qual a previsão do tempo?`).
  *Esperado:* "Recebemos sua mensagem e um de nossos contadores…" e a conversa vira
  **"Encaminhados a um humano"** no painel. Mande outra mensagem qualquer → **o aviso NÃO
  repete** (só na primeira escalada).
- [ ] **12.7 Resposta humana**: responda pelo painel. *Esperado:* chega no seu WhatsApp; no
  painel surge o aviso de que a conversa foi para **"Aguardando cliente"** (ela sai da fila
  padrão — use o filtro Situação para revê-la).
- [ ] **12.8 Janela de 24h**: abrir uma conversa antiga (última mensagem > 24h). *Esperado:*
  aviso "⏳ Janela de 24h expirada…" **antes** de digitar; se enviar mesmo assim, a mensagem
  marca "falha no envio" (comportamento da Meta, não bug).
- [ ] **12.9 Documento pelo WhatsApp**: mande `folha-pagamento-exemplo.pdf` pelo celular
  (⚠ como **documento/arquivo**, não como foto). *Esperado:* "📎 Documento recebido…"
  na conversa do painel + o arquivo triado (se já enviou o mesmo na Parte 8, é descartado
  como duplicata — envie outro PDF do kit para ver o arquivamento).
- [ ] **12.10 Encerrar**: mande `fim`. *Esperado:* mensagem de despedida; conversa "Resolvida"
  no painel. Mandar `oi` de novo → menu de recepção reinicia o ciclo.

---

## Parte 13 — Início, notificações e auditoria

- [ ] **13.1 Dashboard**: Início — os 6 cards refletem os números reais e cada um clica para a
  lista filtrada correspondente.
- [ ] **13.2 Sino**: as notificações de handoff (5.5) e prazo (6.2) estão lá; marcar como lida
  remove o destaque; clicar navega para o lugar certo.
- [ ] **13.3 Auditoria**: Configurações → Auditoria. *Esperado:* trilha do que você fez neste
  roteiro (empresa criada, config alterada, exceção resolvida, sócio criado, regra salva,
  documento classificado/corrigido…), com autor e data.

---

## Parte 14 — Acabamento (amostragem rápida)

- [ ] **14.1 Estados vazios**: abrir Exceções com tudo resolvido ("Nenhuma exceção pendente —
  tudo em dia ✅") e uma empresa recém-criada sem documentos — textos orientam o próximo passo.
- [ ] **14.2 Mobile**: no celular, abrir Início, Tarefas e Exceções. *Esperado:* usável, sem
  rolagem horizontal.
- [ ] **14.3 Erro amigável**: URLs inexistentes (ex.: /empresas/x) mostram página de erro/não
  encontrado em português, com saída.

---

## Registro de problemas

Para cada divergência, anote: **teste nº · o que fez · o que esperava · o que aconteceu ·
print se possível**. Me mande a lista que eu investigo com os logs de produção.
