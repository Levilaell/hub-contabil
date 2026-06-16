// UI copy (pt-BR) for the document repository (T12).
export const copy = {
  title: 'Documentos',
  subtitle: 'Arquivos por empresa, competência e departamento.',
  pickCompany: 'Escolha uma empresa para ver e enviar documentos.',
  back: 'Empresas',
  upload: 'Enviar documentos',
  filters: 'Filtros',
  search: 'Buscar por nome',
  period: 'Competência',
  department: 'Departamento',
  docType: 'Tipo',
  all: 'Todos',
  apply: 'Aplicar',
  regimeUnset: '—',
  empty: {
    companies: 'Nenhuma empresa cadastrada — cadastre uma para guardar documentos.',
    docs: 'Nenhum documento aqui ainda.',
    filtered: 'Nenhum documento encontrado com esses filtros.',
  },
  list: {
    open: 'Abrir',
    download: 'Baixar',
    remove: 'Remover',
    removeConfirm: 'Remover este documento? O arquivo também será apagado.',
  },
  preview: {
    title: 'Documento',
    close: 'Fechar',
    unsupported: 'Pré-visualização indisponível para este tipo. Use “Baixar”.',
    loading: 'Carregando…',
  },
  uploader: {
    title: 'Enviar documentos',
    periodLabel: 'Competência (AAAA-MM, opcional)',
    departmentLabel: 'Departamento (opcional)',
    departmentNone: 'Geral',
    typeLabel: 'Tipo de documento',
    dropzone: 'Arraste arquivos aqui ou clique para escolher',
    sending: 'Enviando…',
    done: 'Concluído',
    duplicate: 'Duplicado (ignorado)',
    error: 'Erro',
    pending: 'Aguardando',
    summary: (ok: number, dup: number, err: number) =>
      `${ok} enviado(s), ${dup} duplicado(s), ${err} com erro.`,
    close: 'Fechar',
    chooseType: 'Escolha o tipo antes de enviar.',
  },
} as const;

export const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
export const primaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60';
export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60';
