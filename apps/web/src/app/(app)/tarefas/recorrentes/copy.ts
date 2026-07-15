// UI copy (pt-BR) for recurring task templates (T11).
export const copy = {
  title: 'Tarefas recorrentes',
  subtitle: 'Modelos que geram tarefas todo mês para as empresas escolhidas.',
  back: 'Tarefas',
  newTemplate: 'Nova recorrência',
  readOnly: 'Apenas titulares e gestores gerenciam recorrências.',
  active: 'Ativa',
  inactive: 'Inativa',
  activate: 'Ativar',
  deactivate: 'Desativar',
  edit: 'Editar',
  deactivateDialog: {
    title: 'Desativar esta recorrência?',
    description:
      'O modelo para de gerar tarefas novas. As tarefas já geradas podem ser mantidas ou canceladas.',
    cancelOpenLabel: 'Cancelar também as tarefas abertas já geradas por este modelo',
    confirm: 'Desativar',
    cancel: 'Voltar',
    doneKept: 'Recorrência desativada — as tarefas abertas foram mantidas.',
    doneCancelled: (n: number) =>
      n === 0
        ? 'Recorrência desativada — nenhuma tarefa aberta para cancelar.'
        : n === 1
          ? 'Recorrência desativada — 1 tarefa aberta cancelada.'
          : `Recorrência desativada — ${n} tarefas abertas canceladas.`,
  },
  empty: {
    title: 'Nenhuma recorrência ainda',
    description: 'Crie um modelo para gerar tarefas mensais automaticamente.',
  },
  targets: {
    all: 'Todas as empresas ativas',
    selection: 'Empresas selecionadas',
    by_regime: 'Por regime fiscal',
  } as Record<string, string>,
  generationDayShort: 'dia',
  form: {
    newTitle: 'Nova recorrência',
    editTitle: 'Editar recorrência',
    title: 'Título da tarefa',
    department: 'Departamento',
    generationDay: 'Dia de geração (1–28)',
    target: 'Aplicar a',
    companies: 'Empresas',
    regimes: 'Regimes',
    defaultAssignee: 'Responsável padrão (opcional)',
    defaultAssigneeNone: 'Sem responsável — as tarefas nascem na fila "Sem responsável"',
    handoffTo: 'Repassar ao concluir (opcional)',
    handoffNone: 'Sem repasse',
    save: 'Salvar',
    saving: 'Salvando…',
    cancel: 'Cancelar',
    multiHint: 'Segure Ctrl/Cmd para escolher mais de uma.',
  },
} as const;

export const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
export const primaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60';
export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60';
