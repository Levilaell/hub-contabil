// UI copy (pt-BR) for the task board (T10).
export const copy = {
  title: 'Tarefas',
  subtitle: 'O que precisa ser feito, por empresa e departamento.',
  newTask: 'Nova tarefa',
  recurring: 'Recorrentes',
  viewMine: 'Minhas tarefas de hoje',
  viewAll: 'Todas as visíveis',
  viewUnassigned: 'Sem responsável',
  period: {
    prev: 'Mês anterior',
    next: 'Próximo mês',
    all: 'Todos os meses',
    backToCurrent: 'Voltar ao mês atual',
  },
  departmentFilter: {
    all: 'Todos os departamentos',
  },
  columns: {
    pending: 'Pendentes',
    in_progress: 'Em andamento',
    done: 'Concluídas',
    canceled: 'Canceladas',
  } as Record<string, string>,
  badge: {
    pending: 'Pendente',
    in_progress: 'Em andamento',
    done: 'Concluída',
    canceled: 'Cancelada',
  } as Record<string, string>,
  transition: {
    in_progress: 'Iniciar',
    done: 'Concluir',
    canceled: 'Cancelar',
    pending: 'Reabrir',
  } as Record<string, string>,
  emptyMine: 'Nenhuma tarefa atribuída a você. 🎉',
  emptyAll: 'Nenhuma tarefa por aqui ainda.',
  emptyUnassigned: 'Nenhuma tarefa sem responsável — tudo tem dono. ✅',
  unassigned: 'Sem responsável',
  you: 'Você',
  handoff: 'Concluir e repassar',
  working: 'Salvando…',
  drawer: {
    company: 'Empresa',
    department: 'Departamento',
    period: 'Competência',
    assignee: 'Responsável',
    handoffTo: 'Repassa para',
    origin: 'Origem',
    originManual: 'Criada manualmente',
    originRecurring: (template: string) => `Gerada pela recorrência "${template}"`,
    originRecurringGeneric: 'Gerada por tarefa recorrente',
    originDeadline: 'Criada pelo monitor de prazos (renovação de documento)',
    originHandoff: 'Criada por repasse de outro departamento',
    createdAt: (date: string) => `em ${date}`,
    close: 'Fechar',
  },
  form: {
    title: 'Nova tarefa',
    company: 'Empresa',
    department: 'Departamento',
    taskTitle: 'Título',
    period: 'Competência (AAAA-MM, opcional)',
    assignee: 'Responsável',
    assigneeNone: 'Sem responsável',
    handoffTo: 'Repassar ao concluir (opcional)',
    handoffNone: 'Sem repasse',
    submit: 'Criar tarefa',
    submitting: 'Criando…',
    cancel: 'Cancelar',
  },
} as const;

export const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
export const primaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60';
export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60';
