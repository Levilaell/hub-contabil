// UI copy (pt-BR) for user management (Configurações → Usuários).

export const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
export const primaryButtonClass =
  'bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60';
export const secondaryButtonClass =
  'border hover:bg-accent rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60';

export const copy = {
  dialogBack: 'Voltar',
  title: 'Usuários e permissões',
  subtitle: 'Quem acessa o escritório e o que cada um enxerga.',
  restricted: 'Apenas titulares e gestores podem gerenciar usuários.',
  roles: {
    owner: 'Titular',
    manager: 'Gestor',
    staff: 'Colaborador',
  } as Record<string, string>,
  roleHint: {
    owner: 'Vê e faz tudo no escritório.',
    manager: 'Vê e faz tudo no escritório.',
    staff: 'Vê apenas o(s) departamento(s) atribuído(s).',
  } as Record<string, string>,
  create: {
    title: 'Novo usuário',
    email: 'E-mail',
    fullName: 'Nome',
    role: 'Papel',
    departments: 'Departamentos (para colaborador)',
    submit: 'Criar usuário',
    submitting: 'Criando…',
    passwordTitle: 'Usuário criado ✅',
    passwordLabel: 'Senha temporária (copie e repasse — o usuário deve trocá-la):',
    passwordNote:
      'Não há recuperação de senha automática ainda. Guarde e envie esta senha por um canal seguro.',
  },
  list: {
    title: 'Equipe',
    empty: 'Nenhum usuário ainda.',
    you: 'você',
    noDepartments: 'todos os departamentos',
  },
  drawer: {
    close: 'Fechar',
    roleLabel: 'Papel',
    roleSave: 'Salvar papel',
    departmentsLabel: 'Departamentos',
    departmentsSave: 'Salvar departamentos',
    departmentsOnlyStaff: 'Departamentos valem apenas para colaboradores.',
    remove: 'Remover do escritório',
    removeTitle: 'Remover usuário',
    removeConfirm: 'Remover este usuário? Ele perde o acesso imediatamente.',
    removed: 'Usuário removido.',
    saving: 'Salvando…',
  },
} as const;
