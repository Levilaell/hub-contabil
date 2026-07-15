# Roteiro de Testes — Fase 1.2 (melhorias e correções)

*Gerado em 14/07/2026 · cobre tudo que foi implementado a partir da rodada de feedback de 10/07 (T26–T40): solicitações/envios, atendimento, tarefas, UX e o redesenho do módulo Documentos.*

Como usar: igual ao roteiro completo — cada teste tem **Faça** (passos) e **Esperado**
(o que deve acontecer). Marque os checkboxes; quando algo divergir, anote ao lado.
Os arquivos citados estão em **`docs/teste-completo/arquivos/`**. Onde o roteiro fala
em "EMPRESA TESTE", use a EMPRESA TESTE HUB LTDA do roteiro completo (ou qualquer
empresa sua com contatos cadastrados).

### O que mudou no ambiente desde o último roteiro

- **E-mail (Resend) ATIVO** → e-mails de solicitação/lembrete agora **saem de verdade**,
  de `no-reply@influai.com.br`. Use um e-mail seu nos testes de envio.
- **Deploy automático LIGADO (14/07)** → push na branch `main` publica sozinho no
  Vercel (web) e no Railway (worker). Não é mais preciso rodar comando de deploy.
- **Crons acelerados** (`CRON_ACCELERATED=true`) → varreduras rodam a cada 10 segundos.
- **WhatsApp em número de teste da Meta** → só entrega para telefones cadastrados na
  lista de destinatários do painel da Meta. **Token válido até 09/09/2026.**
- **"Caixa de entrada" de Documentos agora se chama "Pendentes de arquivamento"** e
  fica sempre visível (novidade desta fase — Parte 5).

---

## Parte 1 — Solicitações e Envios (T26 · T31)

- [ ] **1.1 Envio real por e-mail (T26)**: na EMPRESA TESTE, crie uma solicitação de
  documento → abra o detalhe → "Enviar por e-mail" para **um e-mail seu**.
  *Esperado:* o e-mail chega de verdade (remetente `no-reply@influai.com.br`); o status
  só vira **"Enviado"** depois do envio aceito; a linha do tempo registra o envio com o
  destinatário.
- [ ] **1.2 Copiar link não marca enviado (T26)**: em outra solicitação, use só
  "Gerar e copiar link" (sem enviar e-mail). *Esperado:* o status **continua
  "Solicitado"**; o histórico mostra o evento de **link copiado** (antes, copiar fingia
  que tinha enviado — era o bug grave nº 14).
- [ ] **1.3 Nova solicitação pela página global (T31)**: página Solicitações → "Nova
  solicitação" → escolher empresa e tipo. *Esperado:* criação funciona dali (antes só
  pela empresa); o link aparece **uma única vez**.
- [ ] **1.4 Seletor de contatos (T31)**: ao enviar por e-mail, o destinatário é um
  **seletor com os contatos da empresa**, com o contato do departamento responsável
  já sugerido; "Outro e-mail…" continua possível. *Esperado:* enviar para o sugerido
  sem digitar nada.
- [ ] **1.5 Aba "Envios" separada (T31)**: na página da EMPRESA TESTE. *Esperado:* aba
  **"Envios"** (disponibilizar guia/CND ao cliente) separada da aba "Solicitações"
  (pedir documento), cada uma com seu formulário e lista. Na página global, filtro
  **Tudo / Solicitações / Envios**.
- [ ] **1.6 Detalhe em todo lugar (T31)**: clicar numa linha da aba da empresa.
  *Esperado:* abre o **mesmo drawer** da página global (histórico + enviar + copiar
  link + cancelar) — antes a linha só cancelava.

---

## Parte 2 — Atendimento (T27 · T33 · T34)

> Pré-requisitos: IA de atendimento ligada em Configurações e seu celular na lista de
> destinatários da Meta (como no roteiro completo, Partes 0.1 e 0.4).

- [ ] **2.1 IA muda após transferência (T27)**: pelo WhatsApp, faça uma pergunta fora de
  escopo (ex.: "qual a previsão do tempo?") para a conversa escalar → mande **outra
  mensagem qualquer**. *Esperado:* a IA **não responde mais** (nem o menu de recepção);
  no painel, o drawer mostra **"Quem atende: Equipe"**.
- [ ] **2.2 Devolver para a IA (T27)**: no drawer da conversa, clique **"Devolver para a
  IA"** → mande nova mensagem no WhatsApp. *Esperado:* a IA volta a responder quando a
  pergunta se qualifica; a devolução aparece na Auditoria.
- [ ] **2.3 Presets de confiança (T33)**: Configurações. *Esperado:* em vez de campos
  numéricos, opções **Rigoroso / Equilibrado (recomendado) / Permissivo** +
  "Personalizado…" revelando o valor fino.
- [ ] **2.4 Velocidade das respostas (T33)**: Configurações → "Velocidade das respostas
  da IA". *Esperado:* com o modelo rápido (padrão), a resposta do WhatsApp chega em
  poucos segundos.
- [ ] **2.5 Departamento editável (T33)**: no drawer de uma conversa, troque o
  departamento. *Esperado:* salva na hora, auditado, e o filtro de departamento da
  lista encontra a conversa.
- [ ] **2.6 Telefone normalizado + aviso de duplicado (T34)**: cadastre um contato com
  telefone `(13) 99999-0000` → salve. *Esperado:* exibido formatado ("+55 (13)
  99999-0000"). Agora cadastre **o mesmo número** em outra empresa. *Esperado:* um
  **aviso de duplicidade** aparece (toast), mas o salvamento **não é bloqueado**.
- [ ] **2.7 Vincular a empresa (T34)**: mande um WhatsApp de um número **não cadastrado**
  → no painel, a conversa fica sem empresa → botão **"Vincular a empresa"**.
  *Esperado:* escolhe a empresa, o contato é cadastrado nela e a conversa re-aponta na
  hora (a IA já usa o contexto certo na próxima resposta).

---

## Parte 3 — Tarefas (T28 · T32 · T39)

- [ ] **3.1 Atribuir responsável (T28)**: abra qualquer tarefa → campo de responsável no
  drawer. *Esperado:* troca salva na hora e auditada.
- [ ] **3.2 Visão "Sem responsável" (T28)**: na tela Tarefas. *Esperado:* aba/visão
  "Sem responsável" com contagem das tarefas abertas sem dono (independente do filtro).
- [ ] **3.3 Responsável padrão (T28)**: em Tarefas → Recorrentes, defina "Responsável
  padrão" num modelo → cadastre uma empresa que case com o alvo. *Esperado:* a tarefa
  gerada já nasce com o responsável.
- [ ] **3.4 Origem da tarefa (T32)**: abra uma tarefa gerada por recorrência.
  *Esperado:* bloco **"Origem"** no drawer ("Gerada pela recorrência «X»" + data);
  tarefas manuais mostram "Criada manualmente"; renovação de prazo e repasse também
  são identificados.
- [ ] **3.5 Auditoria por tarefa (T32)**: Configurações → Auditoria após gerar tarefas
  automáticas. *Esperado:* um evento **por tarefa** criada (antes o cron não escrevia
  nada); sócios importados da Receita têm o selo "Importado da Receita".
- [ ] **3.6 Desativar recorrente cancela abertas (T39 — NOVO)**: em Tarefas →
  Recorrentes, clique "Desativar" num modelo que tenha tarefas abertas geradas.
  *Esperado:* abre um **diálogo de confirmação** com a opção **"Cancelar também as
  tarefas abertas já geradas por este modelo"** (marcada por padrão). Confirmando:
  toast "Recorrência desativada — N tarefa(s) aberta(s) cancelada(s)"; as tarefas saem
  das colunas abertas (aparecem em "Canceladas"); concluídas não são tocadas; tudo
  auditado por tarefa. **Desmarcando** a opção: as tarefas abertas ficam.
- [ ] **3.7 Reativar**: reative o modelo. *Esperado:* volta a gerar dali em diante;
  instância cancelada do período **não ressuscita**.

---

## Parte 4 — UX geral (T29 · T30 · T40)

- [ ] **4.1 Tipos de documento em pt-BR (T29)**: navegue por Documentos, Exceções,
  Solicitações e Exportação. *Esperado:* nenhuma chave crua em inglês
  (`payment_receipt`, `payslip`…) — sempre "Comprovante de pagamento", "Holerite" etc.
- [ ] **4.2 Busca por CNPJ (T29)**: na tela Empresas, cole um CNPJ **com máscara**
  ("12.345.678/0001-90") e depois só um pedaço ("12345"). *Esperado:* encontra a
  empresa nos dois casos.
- [ ] **4.3 "Inativar" (T29)**: menu da empresa. *Esperado:* "Inativar"/"Reativar"/
  "Inativa(s)" em toda a UI (nada de "arquivar").
- [ ] **4.4 Diálogos e toasts (T30)**: remova um documento de teste. *Esperado:* diálogo
  de confirmação moderno (botão vermelho), nunca o alert nativo do navegador; ações
  confirmam com **toast** no canto da tela.
- [ ] **4.5 Filtros abertos por padrão (T40 — NOVO)**: abra Empresas, Exceções,
  Atendimento e os documentos de uma empresa. *Esperado:* os painéis de filtro já
  aparecem **abertos**, sem precisar clicar em "Filtros"/"Mais filtros" (continuam
  recolhíveis se você quiser fechar).

---

## Parte 5 — Documentos: triagem com guardas, pendentes e origem (T36 · T37 · T38)

> Use a caixa "Triagem por IA" na tela Documentos e aguarde ~15–30s por arquivo.

- [ ] **5.1 Guarda pelo nome do arquivo (T36 — NOVO)**: copie `das-exemplo.pdf` e
  renomeie a cópia para **`fatura-teste.pdf`** → envie pela Triagem por IA.
  *Esperado:* o documento **não é arquivado sozinho** (o nome diz "fatura", o conteúdo
  diz DAS — conflito): cai em **Pendentes de arquivamento** com o motivo **"Tipo
  improvável para este arquivo — confirme"**, com a sugestão da IA pronta para 1 clique.
- [ ] **5.2 Guarda de tipo XML-nativo (T36 — NOVO)**: se você tiver um **DANFE em PDF**
  (impressão de NF-e), envie-o pela triagem. *Esperado:* mesmo com confiança alta, um
  PDF classificado como NF-e **nunca** se arquiva sozinho — cai em pendentes para você
  confirmar com 1 clique. (Sem DANFE em mãos, vale o 5.1 — é a mesma guarda; XMLs de
  verdade, como `nfe-exemplo.xml`, continuam com o caminho determinístico de sempre.)
- [ ] **5.3 Pendentes sempre visível (T37 — NOVO)**: abra Documentos. *Esperado:* a
  seção **"Pendentes de arquivamento"** é a primeira coisa da tela, **sempre visível**,
  com contagem — amarela quando há pendências, cinza com "tudo arquivado ✅" quando
  zerada (antes ela sumia e ninguém entendia o conceito).
- [ ] **5.4 Arquivar assim (T37 — NOVO)**: abra o pendente do 5.1. *Esperado:* o drawer
  traz o **formulário de resolução no próprio lugar** — motivo, sugestão da IA e
  empresa/tipo/departamento pré-preenchidos. Clique **"Arquivar assim"**. *Esperado 2:*
  toast "Documento arquivado", o arquivo aparece no repositório da empresa e **a
  exceção correspondente é resolvida sozinha** (confira em Exceções — nada pendente).
- [ ] **5.5 Corrigir e arquivar (T37 — NOVO)**: envie outro arquivo que caia em
  pendentes (ex.: `nfe-exemplo.xml`, cujo emitente não é da carteira) → abra →
  **"Corrigir e arquivar"** → ajuste tipo/empresa → "Arquivar". *Esperado:* arquiva com
  os valores corrigidos; a correção vira exemplo de aprendizado da IA.
- [ ] **5.6 Dois lugares, uma pendência (T37)**: com um documento pendente, resolva-o
  pela tela **Exceções** ("Arquivar documento"). *Esperado:* ele some dos Pendentes de
  arquivamento também — é a mesma pendência nos dois lugares, sem duplicidade.
- [ ] **5.7 Origem por WhatsApp (T38 — NOVO)**: mande um PDF do kit pelo WhatsApp (como
  **documento**, não foto) → depois que arquivar (sozinho ou por você), abra o
  documento no repositório. *Esperado:* bloco **"Origem"** no drawer: canal
  **WhatsApp**, seu número formatado como remetente, link **"Ver conversa"** (abre o
  atendimento já na conversa certa), quando chegou ("há X min") e a classificação
  (IA com % de confiança, ou "Confirmada por uma pessoa" se você corrigiu).
- [ ] **5.8 Origem de upload e de link (T38)**: abra um documento subido manualmente e
  um recebido por link de solicitação. *Esperado:* Origem mostra **"Upload manual"** e
  **"Link de solicitação"**, respectivamente.
- [ ] **5.9 Lista com chegada e canal (T38)**: nas listas de documentos. *Esperado:*
  cada linha mostra "**há 2 dias · WhatsApp**" (ou Upload manual/E-mail…) em vez de
  detalhes técnicos.

---

## Parte 6 — Deploy automático (infraestrutura, sem UI)

- [ ] **6.1 Conferência única**: nos painéis do Vercel (projeto `hub-contabil`) e do
  Railway (`hub-contabil-worker`), o último deploy deve apontar para o **commit mais
  recente da branch `main`** do GitHub, criado automaticamente (sem `vercel --prod` /
  `railway up` manual).

---

## Registro de problemas

Para cada divergência, anote: **teste nº · o que fez · o que esperava · o que aconteceu ·
print se possível**. Me mande a lista que eu investigo com os logs de produção.
