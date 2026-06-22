// UI copy (pt-BR) for the dashboard (T13).
export const copy = {
  title: 'Início',
  subtitle: 'Visão geral do escritório.',
  cards: {
    openTasks: 'Tarefas abertas',
    openExceptions: 'Exceções abertas',
    deadlines: 'Prazos a vencer',
    companies: 'Empresas',
    documents: 'Documentos',
    requests: 'Solicitações',
  },
  hints: {
    exceptions: 'precisam de atenção',
    deadlines: 'vencem em breve',
    allClear: 'tudo em dia ✅',
  },
  panel: {
    title: 'Painel das empresas',
    subtitle: 'Farol por empresa — vermelho se algum prazo está vencido.',
    empty: 'Nenhuma empresa cadastrada ainda.',
    noDeadlines: 'Sem prazos monitorados',
    facts: (overdue: number, soon: number) => {
      if (overdue > 0 && soon > 0) return `${overdue} vencido(s) · ${soon} a vencer`;
      if (overdue > 0) return `${overdue} vencido(s)`;
      if (soon > 0) return `${soon} a vencer`;
      return 'Tudo em dia';
    },
  },
  lightLabel: {
    red: 'Vencido',
    yellow: 'A vencer',
    green: 'Em dia',
    gray: 'Sem dados',
  } as Record<string, string>,
} as const;
