// UI copy (pt-BR) for the global deadlines screen (Prazos).

export const copy = {
  title: 'Prazos',
  subtitle: 'Vencimentos de todas as empresas num só lugar.',
  views: {
    attention: 'Precisam de atenção',
    all: 'Todos',
  },
  status: {
    overdue: 'Vencido',
    due_soon: 'Vence em breve',
    valid: 'Em dia',
    no_date: 'Sem data',
    needs_update: 'Revisar',
  } as Record<string, string>,
  lightLabel: {
    red: 'Atrasado',
    yellow: 'A vencer',
    green: 'Em dia',
    gray: 'Sem data',
  } as Record<string, string>,
  due: {
    none: 'Sem data de vencimento',
    today: 'Vence hoje',
    inDays: (n: number) => `Vence em ${n} dia${n === 1 ? '' : 's'}`,
    agoDays: (n: number) => `Venceu há ${n} dia${n === 1 ? '' : 's'}`,
  },
  countAttention: (n: number) =>
    `${n} prazo${n === 1 ? '' : 's'} precisa${n === 1 ? '' : 'm'} de atenção`,
  emptyAttention: 'Nenhum prazo pendente — tudo em dia ✅',
  emptyAll: 'Nenhum prazo cadastrado ainda.',
} as const;
