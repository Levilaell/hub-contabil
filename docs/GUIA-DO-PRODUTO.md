# Hub Contábil — Guia do Produto

**Manual de uso e teste.** Este é um produto novo, em fase de testes. A ideia é você
usar como se fosse o dia a dia do escritório, explorar cada tela e me contar **tudo** o
que achar — o que ficou claro, o que confundiu, o que faltou e o que quebrou. No fim
deste guia tem uma seção **"Como me dar retorno"** com exatamente o que preciso.

> **Acesso** (o Levi confirma/atualiza antes de enviar):
> - **Endereço:** https://hub-contabil-eight.vercel.app
> - **Usuário / senha:** _(o Levi te passa)_
> - **WhatsApp de teste (atendimento/documentos):** +1 (555) 656-8634 _(confirme se está ligado)_

---

## 1. Em 1 minuto: o que é isto?

Um painel único para um escritório de contabilidade tocar a operação de todas as
empresas-clientes: **prazos, documentos, tarefas, cobrança de documentos e atendimento**.
A ideia central é você **abrir e entender a situação em segundos**, sem caçar em planilha,
e-mail e WhatsApp.

A metáfora que se repete em todo lugar é o **farol**:

| Cor | Significa |
| --- | --- |
| 🟢 **Verde** | Está tudo em dia |
| 🟡 **Amarelo** | Tem algo a vencer em breve |
| 🔴 **Vermelho** | Tem algo vencido / precisa de ação |
| ⚪ **Cinza** | Sem dados / sem data |

---

## 2. Como entrar

1. Abra o endereço acima.
2. Clique em **Entrar** e informe o usuário e a senha que o Levi te passou.
3. Você cai na tela **Início** (o painel). Do lado esquerdo há o **menu** com tudo.

O menu é dividido em três blocos:

- **Operação** — Início, Empresas, Tarefas, Documentos, Prazos, Atendimento, Exceções, Solicitações, Exportação.
- **Administração** — Usuários e permissões, Auditoria.
- **Configurações** — Configurações, Configuração avançada, Regras de CFOP.

Alguns itens do menu têm um **número vermelho** (badge): é a quantidade de coisas
esperando você ali (ex.: atendimentos abertos, exceções, solicitações).

---

## 3. As telas, uma a uma

Para cada tela: **o que é → como usar → o que esperar**.

### 3.1 Início (painel)
- **O que é:** a visão geral do escritório.
- **Como usar:** veja os **6 cartões** no topo (tarefas abertas, exceções, prazos a vencer, empresas, documentos, solicitações). Clique em qualquer cartão para ir à lista por trás dele. Abaixo, o **painel das empresas** mostra um farol por empresa, das mais críticas para as ok.
- **O que esperar:** números que batem com as listas; empresas vermelhas no topo.

### 3.2 Empresas
- **O que é:** o cadastro dos seus clientes.
- **Como usar:** **Nova empresa** para cadastrar (informe o CNPJ — ele é validado). Clique numa empresa para ver o detalhe, com abas: **Dados, Contatos, Tarefas, Documentos, Prazos, Solicitações**. Para cadastrar muitas de uma vez, use **Importar** (baixe a planilha modelo, preencha e suba).
- **O que esperar:** ao cadastrar com um CNPJ válido, o sistema **busca sozinho** razão social, CNAE e cidade na Receita (pode levar alguns segundos — recarregue). CNPJ inválido é recusado com aviso. Na importação, cada linha vem marcada como válida, inválida ou duplicada, com o motivo.

### 3.3 Tarefas
- **O que é:** o trabalho do escritório, por setor (Fiscal, Contábil, DP, Compliance).
- **Como usar:** quadro no estilo kanban. **Nova tarefa** para criar. Abra uma tarefa para mudar o status (Pendente → Em andamento → Concluída) ou **Concluir e repassar** para outro setor. Em **Tarefas → Recorrentes**, dá para criar modelos que geram tarefas todo mês.
- **O que esperar:** ao **repassar (handoff)**, aparece automaticamente uma tarefa nova no setor de destino e uma **notificação** (o sininho no topo). Cada pessoa só vê as tarefas do(s) setor(es) dela (a não ser gestores/titulares, que veem tudo).

### 3.4 Documentos
- **O que é:** o repositório de arquivos das empresas.
- **Como usar:** **Enviar** para subir arquivos escolhendo a empresa e a competência. **Inbox** para subir um documento "solto" (sem dizer de quem é) — aí entra a **triagem por IA**.
- **O que esperar:** o mesmo arquivo enviado duas vezes é sinalizado como **duplicado**. No Inbox, a IA tenta **classificar e arquivar sozinha**; quando fica em dúvida (baixa confiança) ou não acha a empresa, ela **não chuta** — manda para a fila de **Exceções** com uma sugestão. _(A triagem por IA precisa estar ligada — veja a seção 6.)_

### 3.5 Prazos
- **O que é:** todos os vencimentos (certidões, alvarás, etc.) de **todas as empresas** num lugar só.
- **Como usar:** abre já na visão **"Precisam de atenção"** (vencidos + a vencer). Clique em **Todos** para ver o resto. Clique numa linha para ir gerenciar aquele prazo na empresa.
- **O que esperar:** farol por linha + texto humano ("Vence em 5 dias", "Venceu há 3 dias"). O status é recalculado na hora (não depende de ninguém rodar nada).

### 3.6 Exceções
- **O que é:** a fila do que a automação **não conseguiu resolver sozinha** (nunca some em silêncio).
- **Como usar:** abre nas **abertas**. Clique num item para ler o contexto em português e a sugestão. Você pode **Resolver** (com uma nota) ou, quando fizer sentido, **Salvar como regra** para o próximo caso igual se resolver sozinho.
- **O que esperar:** resolver um item tira ele da fila e registra quem resolveu e quando.

### 3.7 Solicitações (cobrar documentos do cliente)
- **O que é:** pedir um documento ao cliente (ou disponibilizar um) por um **link**.
- **Como usar:** dentro de uma empresa, aba **Solicitações → Solicitar documento**. Copie o **link** gerado e mande ao cliente. O cliente abre o link (sem precisar de senha), vê um pedido bem simples e **envia o arquivo**.
- **O que esperar:** você vê o status mudar: **Enviado → Visualizado → Recebido**, com **data e hora** de cada passo (a "prova" de que o cliente viu e enviou). O arquivo enviado entra no repositório e vai para a triagem. _(O envio automático por e-mail depende do e-mail estar ligado — por ora, use **Copiar link**.)_

### 3.8 Atendimento (WhatsApp)
- **O que é:** as dúvidas dos clientes que chegam por WhatsApp viram **tickets**.
- **Como usar:** mande uma mensagem do seu celular para o **número de teste** (no topo deste guia). Ela aparece em **Atendimento**. Abra o ticket, leia a conversa e **Responda** pela tela — a resposta vai ao cliente pelo WhatsApp. Você também pode **Encaminhar** (marcar que um humano vai cuidar) ou **Resolver**.
- **O que esperar:** se o **auto-atendimento por IA** estiver ligado (Configurações), a IA responde perguntas simples sozinha e **encaminha** o que for complexo; se estiver desligado, tudo vai direto para você. _(Depende do WhatsApp estar ligado — seção 6.)_

### 3.9 Exportação (para o ERP)
- **O que é:** empacotar documentos para importar no seu sistema contábil.
- **Como usar:** escolha filtros (empresas, competência, tipos) e **Gerar lote**. Quando ficar **Pronto**, baixe o **.zip**.
- **O que esperar:** o zip vem com os arquivos **renomeados** por um padrão + um **manifesto** (lista, hashes, CFOPs). Documentos com CFOP pendente ficam de fora, com aviso.

### 3.10 Regras de CFOP
- **O que é:** o de-para de CFOP (de origem → de entrada), usado ao processar notas.
- **Como usar:** em **Configurações → Regras de CFOP**, cadastre regras (por CFOP e, se quiser, por fornecedor).
- **O que esperar:** ao processar uma NF-e, o sistema aplica a regra automaticamente; se não achar regra, gera uma pendência em Exceções.

### 3.11 Usuários e permissões
- **O que é:** quem acessa o escritório e o que cada um enxerga.
- **Como usar:** **Administração → Usuários**. Crie usuários com papel **Titular**, **Gestor** ou **Colaborador**. Colaborador é restrito aos **departamentos** que você marcar.
- **O que esperar:** ao criar, aparece uma **senha temporária** (para você repassar). Titular/Gestor veem tudo; Colaborador só o setor dele.

### 3.12 Auditoria
- **O que é:** o registro de **quem fez o quê e quando** no sistema.
- **Como usar:** **Administração → Auditoria**. A lista já mostra tudo, com cor por tipo de ação e filtro por tipo de item.
- **O que esperar:** cada ação relevante (criar empresa, repassar tarefa, resolver exceção, etc.) aparece aqui.

### 3.13 Configurações
- **O que é:** os parâmetros do escritório.
- **Como usar:** **Configurações** (prazo de alerta, confiança da IA, ligar/desligar a IA do atendimento). **Configuração avançada** (departamentos, tipos de documento, roteamento).
- **O que esperar:** o que você mudar aqui passa a valer para todas as empresas.

---

## 4. Roteiros para testar (sugestões)

Faça de conta que é um mês normal. Sugestões de fluxos ponta a ponta:

1. **Cadastro:** crie uma empresa com um CNPJ real → veja os dados serem preenchidos sozinhos.
2. **Cobrança com prova:** crie uma solicitação de documento → abra o link numa aba anônima (fingindo ser o cliente) → envie um arquivo → volte e veja o status virar **Recebido** com data/hora.
3. **Documento por WhatsApp:** mande um **PDF** para o número de teste → veja ele ser arquivado e passar pela triagem.
4. **Dúvida por WhatsApp:** mande uma **pergunta de texto** → veja o ticket em Atendimento → responda.
5. **Prazo:** cadastre um prazo com vencimento **para ontem** numa empresa → veja o farol ficar vermelho e (se os alertas estiverem acelerados) surgir uma tarefa de renovação.
6. **Exportação:** gere um lote e baixe o zip.

---

## 5. O que ainda NÃO está ligado (não reporte como bug)

Coisas conhecidas, para você não perder tempo:

- **E-mail automático** pode estar **desligado** — então os envios de solicitação/lembrete não saem por e-mail; use **Copiar link**.
- **WhatsApp** pode estar **desligado** — se as telas de Atendimento/entrada por WhatsApp não reagirem, é porque ainda não foi ligado (o Levi confirma).
- **Dados de demonstração:** o ambiente já vem com empresas/prazos/tarefas de exemplo. Pode mexer à vontade — é um ambiente de teste.
- **Recuperar senha** ainda não existe; se esquecer, o Levi gera outra.
- **Prévia/baixar** de alguns documentos de exemplo pode não abrir (são só metadados de demonstração).

---

## 6. Como me dar retorno (o mais importante 🙌)

Testa com calma e me manda **tudo** que notar. Não precisa ser formal nem organizado —
pode ser em áudio, lista solta, prints, o que for mais fácil. Só tenta cobrir estes pontos:

**a) Dúvidas** — qualquer coisa que você não entendeu ou teve que adivinhar. Se você
travou numa tela, isso é ouro (significa que preciso deixar mais claro).

**b) Erros / bugs** — algo que quebrou, travou, deu mensagem estranha ou fez o que não
devia. Para cada um, se der:
- Em que **tela** estava e o que você **clicou**;
- O que **esperava** e o que **aconteceu**;
- Um **print** (e o horário ajuda muito).

**c) Considerações de usabilidade** — o que é confuso, cansativo, tem clique demais,
nome ruim, faltou um aviso, etc. Sua visão de contador é o que mais importa aqui.

**d) Sugestões de melhoria** — o que deixaria seu dia a dia melhor.

**e) Funcionalidades que faltam** — o que um escritório precisa e não achou aqui.

**f) Relatório do que você testou** — só uma listinha do que você chegou a experimentar
(ex.: "cadastrei 2 empresas, pedi um documento, mandei um PDF no WhatsApp, mexi nas
tarefas"). Assim eu sei o que teve olho em cima e o que ainda não.

**g) Impressão geral** — de 0 a 10, e por quê. Você usaria no escritório? O que faria
você **não** usar?

Manda do jeito que for melhor pra você. Qualquer coisa, me chama. Valeu demais! 🚀
