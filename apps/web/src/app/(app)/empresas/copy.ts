// UI copy (pt-BR) for the company registry screens (T6). All user-facing strings
// live here — never inline in JSX.
export const copy = {
  list: {
    title: 'Empresas',
    subtitle: 'Carteira de clientes do escritório.',
    newCompany: 'Nova empresa',
    filters: 'Filtros',
    searchLabel: 'Buscar',
    searchPlaceholder: 'Razão social ou nome fantasia',
    statusLabel: 'Situação',
    statusActive: 'Ativas',
    statusArchived: 'Arquivadas',
    statusAll: 'Todas',
    apply: 'Aplicar',
    regimeUnset: 'Regime não informado',
    badgeArchived: 'Arquivada',
    empty: {
      title: 'Nenhuma empresa cadastrada',
      description: 'Cadastre a primeira empresa da carteira para começar.',
      filteredTitle: 'Nenhuma empresa encontrada',
      filteredDescription: 'Ajuste a busca ou a situação e tente de novo.',
    },
  },
  form: {
    newTitle: 'Nova empresa',
    newSubtitle: 'Informe o CNPJ e a razão social. O resto pode vir depois.',
    editTitle: 'Editar empresa',
    editSubtitle: 'O CNPJ não pode ser alterado — ele identifica a empresa.',
    cnpj: 'CNPJ',
    cnpjInvalid: 'CNPJ inválido — verifique os dígitos.',
    legalName: 'Razão social',
    tradeName: 'Nome fantasia',
    taxRegime: 'Regime fiscal',
    taxRegimeNone: 'Não informado',
    city: 'Cidade',
    state: 'UF',
    optional: '(opcional)',
    submitNew: 'Cadastrar empresa',
    submitEdit: 'Salvar alterações',
    submitting: 'Salvando…',
    cancel: 'Cancelar',
  },
  detail: {
    backToList: 'Empresas',
    edit: 'Editar',
    archive: 'Arquivar',
    restore: 'Restaurar',
    archiveConfirm: 'Arquivar esta empresa? Ela sai da lista de empresas ativas.',
    restoreConfirm: 'Restaurar esta empresa para a lista de ativas?',
    working: 'Aguarde…',
    badgeActive: 'Ativa',
    badgeArchived: 'Arquivada',
    soon: 'Disponível em breve.',
    tabs: {
      dados: 'Dados',
      contatos: 'Contatos',
      tarefas: 'Tarefas',
      documentos: 'Documentos',
      prazos: 'Prazos',
      solicitacoes: 'Solicitações',
      regras: 'Regras',
    },
    fields: {
      cnpj: 'CNPJ',
      legalName: 'Razão social',
      tradeName: 'Nome fantasia',
      taxRegime: 'Regime fiscal',
      location: 'Cidade / UF',
      unset: '—',
    },
  },
  contacts: {
    add: 'Adicionar contato',
    name: 'Nome',
    email: 'E-mail',
    phone: 'Telefone',
    channel: 'Canal preferido',
    channels: { email: 'E-mail', phone: 'Telefone', whatsapp: 'WhatsApp' },
    primary: 'Principal',
    markPrimary: 'Marcar como contato principal',
    save: 'Salvar',
    saving: 'Salvando…',
    cancel: 'Cancelar',
    edit: 'Editar',
    remove: 'Remover',
    removeConfirm: 'Remover este contato?',
    empty: 'Nenhum contato cadastrado.',
    emptyHint: 'Adicione quem fala pelo cliente — quem recebe cobranças e solicitações.',
  },
} as const;

// Shared control classes, matching the settings screen.
export const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
export const primaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60';
export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60';
