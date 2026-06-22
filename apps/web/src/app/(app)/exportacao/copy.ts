// UI copy (pt-BR) for export batches (T22). All user-facing strings here.
export const copy = {
  title: 'Exportação',
  subtitle: 'Empacote documentos por empresa, competência e tipo para importar no ERP.',
  back: 'Documentos',
  builder: {
    title: 'Novo lote',
    companies: 'Empresas',
    companiesAll: 'Todas as empresas',
    companiesSearch: 'Buscar empresa',
    period: 'Competência (AAAA-MM)',
    periodAny: 'Qualquer competência',
    docTypes: 'Tipos de documento',
    docTypesAll: 'Todos os tipos',
    preview: 'Pré-visualizar',
    previewing: 'Calculando…',
    build: 'Gerar lote',
    building: 'Iniciando…',
    selected: (n: number) => (n === 0 ? 'Todas as empresas' : `${n} empresa(s) selecionada(s)`),
  },
  preview: {
    title: 'Resumo do lote',
    included: 'documentos no lote',
    excluded: 'fora (CFOP pendente)',
    already: 'já exportados antes',
    excludedHint: 'Documentos com CFOP de entrada pendente ficam de fora — resolva a regra antes.',
    none: 'Nenhum documento corresponde a esses filtros.',
    reExportWarning: 'Atenção: alguns documentos já foram exportados em lotes anteriores.',
  },
  list: {
    title: 'Lotes recentes',
    empty: 'Nenhum lote gerado ainda.',
    emptyHint: 'Monte um lote acima — ele aparece aqui quando ficar pronto.',
    download: 'Baixar .zip',
    building: 'Gerando…',
    files: (n: number) => `${n} arquivo(s)`,
    excluded: (n: number) => `${n} fora`,
    detail: 'Detalhes',
  },
  status: {
    building: 'Gerando',
    ready: 'Pronto',
    failed: 'Falhou',
    downloaded: 'Baixado',
  } as Record<string, string>,
  drawer: {
    title: 'Detalhes do lote',
    close: 'Fechar',
    included: 'Incluídos',
    excluded: 'Excluídos (CFOP pendente)',
    error: 'Erro',
    none: '—',
  },
  exportLink: 'Exportar lote',
} as const;

export const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
export const primaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60';
export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60';
