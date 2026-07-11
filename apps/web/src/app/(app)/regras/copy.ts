// UI copy (pt-BR) for the mapping-rules screen (T19). First domain: CFOP. All
// user-facing strings here — never inline in JSX.
export const copy = {
  dialogBack: 'Voltar',
  title: 'Regras de CFOP',
  subtitle: 'De-para de CFOP de origem para CFOP de entrada, por fornecedor.',
  back: 'Configurações',
  newRule: 'Nova regra',
  import: 'Importar planilha',
  levelSpecific: 'Específica',
  levelGeneral: 'Geral',
  anySupplier: 'Qualquer fornecedor',
  supplierFact: (cnpj: string) => `Fornecedor ${cnpj}`,
  empty: {
    title: 'Nenhuma regra de CFOP ainda.',
    description:
      'Cadastre o de-para ou deixe uma nota fiscal cair na fila de exceções e salve a regra a partir dela.',
  },
  form: {
    newTitle: 'Nova regra de CFOP',
    editTitle: 'Editar regra de CFOP',
    originCfop: 'CFOP de origem',
    originHint: 'O CFOP que vem na nota (4 dígitos).',
    supplierCnpj: 'CNPJ do fornecedor',
    supplierHint: 'Opcional. Em branco = vale para qualquer fornecedor (regra geral).',
    entryCfop: 'CFOP de entrada',
    entryHint: 'O CFOP que deve ser lançado.',
    save: 'Salvar regra',
    saving: 'Salvando…',
    cancel: 'Cancelar',
    edit: 'Editar',
    remove: 'Remover',
    removeTitle: 'Remover regra',
    removeConfirm: 'Remover esta regra?',
    removed: 'Regra removida.',
    errorCfop: 'Informe um CFOP de 4 dígitos.',
    errorEntry: 'Informe o CFOP de entrada (4 dígitos).',
    errorCnpj: 'CNPJ inválido — use 14 dígitos ou deixe em branco.',
  },
  importer: {
    title: 'Importar regras de CFOP',
    hint: 'Planilha .csv ou .xlsx com colunas: CFOP origem, CNPJ fornecedor (opcional), CFOP entrada.',
    fileLabel: 'Planilha',
    submit: 'Importar',
    importing: 'Importando…',
    cancel: 'Cancelar',
    noFile: 'Escolha um arquivo .csv ou .xlsx.',
    result: (created: number, skipped: number) =>
      `${created} regra(s) importada(s), ${skipped} ignorada(s) (erro ou duplicada).`,
  },
} as const;

export const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
export const primaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60';
export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60';
