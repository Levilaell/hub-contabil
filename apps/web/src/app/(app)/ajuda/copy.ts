// UI copy (pt-BR) for the in-app tutorial/guided tour (/ajuda). All user-facing
// strings live here so the page stays free of scattered pt-BR (CLAUDE.md rule).

export const copy = {
  title: 'Tutorial',
  subtitle: 'Um passo a passo rápido de cada parte do sistema. Use as abas abaixo.',
  intro:
    'Bem-vindo! Este guia mostra o que cada tela faz e como testar o sistema. ' +
    'Você não quebra nada explorando — pode clicar à vontade. Em caso de dúvida, volte aqui.',
  legendTitle: 'O farol (semáforo)',
  legend: [
    { tone: 'success', label: 'Verde', text: 'Tudo em dia, nada vencido.' },
    { tone: 'warning', label: 'Amarelo', text: 'Há algo a vencer em breve.' },
    { tone: 'danger', label: 'Vermelho', text: 'Há algo vencido — exige ação.' },
    { tone: 'muted', label: 'Cinza', text: 'Sem dados ainda.' },
  ] as const,
  tabs: {
    inicio: 'Início',
    empresas: 'Empresas',
    tarefas: 'Tarefas',
    documentos: 'Documentos',
    excecoes: 'Exceções',
    solicitacoes: 'Solicitações',
    config: 'Configurações',
    bastidores: 'Bastidores',
  },
  feedbackTitle: 'Como nos dar retorno',
  feedbackText:
    'Anote o que achou confuso, o que faltou e o que funcionou bem. ' +
    'Se algo der erro, descreva o que você fez antes — isso ajuda a corrigir rápido.',
} as const;

export type TutorialStep = { title: string; text: string };

export type TutorialSection = {
  key: keyof typeof copy.tabs;
  heading: string;
  goal: string;
  steps: TutorialStep[];
  tip?: string;
  href?: string;
  hrefLabel?: string;
};

// Each section maps one screen to: what it answers, how to test it, where to go.
export const sections: TutorialSection[] = [
  {
    key: 'inicio',
    heading: 'Início — a visão do dia',
    goal: 'Responde "o que precisa da minha atenção agora?". É a primeira tela após entrar.',
    steps: [
      {
        title: 'Leia os números no topo',
        text: 'Os cartões grandes mostram tarefas abertas, exceções, documentos e solicitações. Cada cartão é clicável e leva à lista por trás dele.',
      },
      {
        title: 'Olhe o farol de cada empresa',
        text: 'A lista de empresas mostra o semáforo de prazos. Vermelho primeiro: é o que está vencido.',
      },
      {
        title: 'Clique para ir ao detalhe',
        text: 'Qualquer item leva direto à tela correspondente, já filtrada.',
      },
    ],
    tip: 'Esta tela funciona bem no celular — é a que o dono do escritório abre no dia a dia.',
    href: '/inicio',
    hrefLabel: 'Abrir Início',
  },
  {
    key: 'empresas',
    heading: 'Empresas — sua carteira de clientes',
    goal: 'Responde "qual a situação de cada empresa?". É o cadastro central de clientes.',
    steps: [
      {
        title: 'Veja a lista',
        text: 'Cada linha traz status + nome + 1–2 informações chave. O resto fica no detalhe, a um clique.',
      },
      {
        title: 'Cadastre uma empresa de teste',
        text: 'Use o botão "Nova empresa". Preencha CNPJ e nome — os demais campos têm padrões sensatos.',
      },
      {
        title: 'Importe em massa (opcional)',
        text: 'Em "Importar" você baixa o modelo de planilha, preenche e sobe de uma vez. Bom para 50+ empresas.',
      },
      {
        title: 'Abra o detalhe de uma empresa',
        text: 'Lá ficam prazos monitorados, documentos e tarefas daquele cliente.',
      },
    ],
    href: '/empresas',
    hrefLabel: 'Abrir Empresas',
  },
  {
    key: 'tarefas',
    heading: 'Tarefas — o trabalho do escritório',
    goal: 'Responde "o que eu (ou minha equipe) preciso fazer?". Tarefas têm responsável e passagem de bastão (handoff).',
    steps: [
      {
        title: 'Comece pela visão padrão',
        text: 'A lista abre nas tarefas que importam agora. Os filtros existem, mas ficam recolhidos.',
      },
      {
        title: 'Crie uma tarefa',
        text: 'Defina título, empresa e responsável. O status segue um fluxo definido (a fazer → em andamento → concluída).',
      },
      {
        title: 'Passe o bastão',
        text: 'Ao mudar de etapa, a tarefa pode ir para outro departamento/responsável. Tudo fica registrado.',
      },
      {
        title: 'Tarefas recorrentes',
        text: 'Em "Recorrentes" você define obrigações que se repetem (mensais, etc.) e o sistema gera as tarefas.',
      },
    ],
    href: '/tarefas',
    hrefLabel: 'Abrir Tarefas',
  },
  {
    key: 'documentos',
    heading: 'Documentos — o repositório',
    goal: 'Responde "onde estão os arquivos deste cliente?". Guarda XMLs, PDFs e demais documentos.',
    steps: [
      {
        title: 'Navegue pelos documentos',
        text: 'A lista mostra tipo, empresa e data. Filtre por empresa quando precisar.',
      },
      {
        title: 'Suba um arquivo de teste',
        text: 'O upload aceita os tipos configurados. XML fiscal autorizado é imutável: nunca é alterado, só referenciado.',
      },
      {
        title: 'Triagem por IA',
        text: 'Documentos passam por uma classificação automática. Casos com baixa confiança vão para a fila de Exceções, nunca decididos no escuro.',
      },
    ],
    href: '/documentos',
    hrefLabel: 'Abrir Documentos',
  },
  {
    key: 'excecoes',
    heading: 'Exceções — o que a automação não resolveu',
    goal: 'Responde "o que precisa de decisão humana?". É a fila onde a máquina pede ajuda.',
    steps: [
      {
        title: 'Entenda o contador no menu',
        text: 'O número ao lado de "Exceções" na lateral é a quantidade de itens em aberto.',
      },
      {
        title: 'Abra uma exceção',
        text: 'Cada item traz o contexto e, quando possível, uma sugestão pré-preenchida pela IA.',
      },
      {
        title: 'Resolva',
        text: 'Sua decisão vira aprendizado: alimenta exemplos/regras para que o sistema acerte mais na próxima vez.',
      },
    ],
    tip: 'Nenhuma automação falha em silêncio: erros sempre caem aqui, sem travar o restante.',
    href: '/excecoes',
    hrefLabel: 'Abrir Exceções',
  },
  {
    key: 'solicitacoes',
    heading: 'Solicitações — pedir documentos ao cliente',
    goal: 'Responde "o que estou esperando do cliente?". Pedidos de documento com rastreio de leitura.',
    steps: [
      {
        title: 'Crie uma solicitação',
        text: 'Escolha a empresa e o que está pedindo. O sistema gera um link público para o cliente.',
      },
      {
        title: 'Acompanhe o status',
        text: 'Você vê se o cliente abriu o link e se já enviou. O contador no menu mostra os pedidos em aberto.',
      },
      {
        title: 'Teste o lado do cliente',
        text: 'Abra o link público em uma aba anônima: é a tela que o cliente vê, sem precisar de login.',
      },
    ],
    href: '/solicitacoes',
    hrefLabel: 'Abrir Solicitações',
  },
  {
    key: 'config',
    heading: 'Configurações — as regras do escritório',
    goal: 'Responde "como o sistema se comporta para o meu escritório?". Valores de negócio ficam aqui, não no código.',
    steps: [
      {
        title: 'Ajuste os prazos',
        text: 'Defina os gatilhos de prazo padrão usados pelo motor de vencimentos.',
      },
      {
        title: 'Defina departamentos e taxonomia',
        text: 'Departamentos para roteamento de tarefas e a taxonomia de documentos do escritório.',
      },
      {
        title: 'Regras de mapeamento',
        text: 'Em "Regras" você cria regras que automatizam classificações. Sem regra aplicável, vai para Exceções.',
      },
    ],
    tip: 'Só os perfis dono/gestor editam configurações. Os demais visualizam.',
    href: '/configuracoes',
    hrefLabel: 'Abrir Configurações',
  },
  {
    key: 'bastidores',
    heading: 'Bastidores — o que o sistema faz sozinho',
    goal: 'Boa parte do trabalho acontece automaticamente, sem ninguém clicar. Aqui está o que roda nos bastidores — e por que você pode confiar.',
    steps: [
      {
        title: 'Confere os prazos todo dia',
        text: 'Todas as manhãs o sistema revisa os vencimentos de cada empresa, atualiza o farol (verde → amarelo → vermelho) e, quando uma obrigação vence, já cria a tarefa de renovação. Você não precisa caçar prazo: ele aparece sozinho.',
      },
      {
        title: 'Gera as obrigações que se repetem',
        text: 'No início de cada mês, as obrigações recorrentes (as mensais, por exemplo) viram tarefas automaticamente, sem ninguém recriar uma a uma.',
      },
      {
        title: 'Cobra o cliente por você',
        text: 'Quando há uma solicitação de documento em aberto, o sistema envia lembretes ao cliente de tempos em tempos e mostra se ele já abriu o pedido. Menos cobrança manual.',
      },
      {
        title: 'Faz a triagem dos documentos',
        text: 'Ao chegar um documento, o sistema lê, identifica o tipo, descobre de qual empresa é e arquiva no lugar certo. Notas fiscais (XML) são lidas de forma exata e nunca alteradas — o original é sempre preservado.',
      },
      {
        title: 'Na dúvida, chama um humano',
        text: 'A inteligência artificial nunca decide sozinha em casos incertos. Quando a confiança é baixa, ela manda o item para a fila de Exceções já com uma sugestão pronta — e sua decisão ensina o sistema a acertar mais na próxima vez.',
      },
      {
        title: 'Avisa quem precisa agir',
        text: 'Quando uma tarefa passa para outro responsável ou departamento, o sino de notificações avisa a pessoa certa. O número no sino mostra quantos avisos não lidos você tem.',
      },
      {
        title: 'Nada falha em silêncio',
        text: 'Se alguma automação tropeça, ela tenta de novo sozinha algumas vezes; persistindo o problema, o caso cai na fila de Exceções para alguém olhar. Um erro nunca trava o restante do trabalho.',
      },
      {
        title: 'Registra tudo (auditoria)',
        text: 'Toda ação relevante — feita por pessoa ou pelo sistema — fica registrada: quem fez, o quê e quando. Dá para reconstruir o histórico de qualquer item quando precisar.',
      },
    ],
    tip: 'Resumo da filosofia: o sistema automatiza o repetitivo, mas decisões duvidosas sempre passam por uma pessoa — e tudo fica rastreável.',
  },
];
