// UI copy (pt-BR) for advanced config (Configurações → Configuração avançada).

export const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
export const primaryButtonClass =
  'bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60';
export const secondaryButtonClass =
  'border hover:bg-accent rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60';

export const copy = {
  title: 'Configuração avançada',
  subtitle: 'Vocabulários do escritório: departamentos, tipos de documento e roteamento da triagem.',
  restricted: 'Apenas titulares e gestores podem editar.',
  departments: {
    title: 'Departamentos',
    hint: 'Setores do escritório. A chave é o identificador interno (minúsculas, sem espaço); o nome é o que aparece na tela.',
    keyPlaceholder: 'chave (ex.: fiscal)',
    labelPlaceholder: 'Nome (ex.: Fiscal)',
    add: 'Adicionar departamento',
    remove: 'Remover',
    keyColumn: 'Chave',
  },
  taxonomy: {
    title: 'Tipos de documento',
    hint: 'Categorias que a triagem por IA pode atribuir a um documento.',
    placeholder: 'novo tipo (ex.: nfe, recibo)',
    add: 'Adicionar tipo',
  },
  routing: {
    title: 'Roteamento por tipo',
    hint: 'Para onde cada tipo de documento é encaminhado depois de classificado.',
    none: '— sem roteamento —',
  },
  save: 'Salvar configuração',
  saving: 'Salvando…',
  saved: 'Configuração salva.',
  emptyTaxonomy: 'Cadastre ao menos um tipo de documento.',
  emptyDepartments: 'Cadastre ao menos um departamento.',
} as const;
