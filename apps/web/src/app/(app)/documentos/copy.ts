// UI copy (pt-BR) for the document repository (T12).
export const copy = {
  dialogBack: 'Voltar',
  title: 'Documentos',
  subtitle: 'Arquivos por empresa, competência e departamento.',
  pickCompany: 'Escolha uma empresa para ver e enviar documentos.',
  back: 'Empresas',
  exportLink: 'Exportar lote',
  upload: 'Enviar documentos',
  filters: 'Mais filtros',
  search: 'Buscar por nome',
  searchAllPlaceholder: 'Buscar documento em todas as empresas…',
  searchResults: (n: number) =>
    n === 1 ? '1 documento encontrado' : `${n} documentos encontrados`,
  clearSearch: 'Limpar busca',
  period: 'Competência',
  department: 'Departamento',
  docType: 'Tipo',
  all: 'Todos',
  apply: 'Aplicar',
  regimeUnset: '—',
  unassigned: {
    title: 'Pendentes de arquivamento',
    hint: 'Documentos recebidos que precisam de uma confirmação sua para serem arquivados.',
    hintEmpty: 'Nenhum documento pendente — tudo arquivado ✅',
    resolve: 'Ver nas Exceções',
    back: 'Documentos',
    emptyTitle: 'Nenhum documento pendente de arquivamento',
    emptyDescription:
      'Documentos recebidos por WhatsApp, e-mail ou triagem que a IA não conseguir arquivar sozinha aparecem aqui para você confirmar em um clique.',
  },
  resolve: {
    title: 'Arquivar este documento',
    subtitle: 'Confira a sugestão da IA — o sistema aprende com a sua decisão.',
    suggestion: 'Sugestão da IA',
    reason: 'Motivo da pendência',
    docType: 'Tipo do documento',
    company: 'Empresa',
    companyPick: 'Escolher empresa…',
    department: 'Departamento',
    departmentAuto: 'Automático pelo tipo',
    archiveAsIs: 'Arquivar assim',
    correctAndArchive: 'Corrigir e arquivar',
    archive: 'Arquivar',
    archiving: 'Arquivando…',
    cancel: 'Voltar',
    needCompany: 'Escolha a empresa para arquivar.',
    needType: 'Escolha o tipo do documento.',
    archived: 'Documento arquivado.',
    waitingFact: 'Aguardando triagem da IA',
    waiting:
      'Aguardando a triagem da IA — se ela precisar de confirmação, o formulário de arquivamento aparece aqui.',
  },
  empty: {
    companies: 'Nenhuma empresa cadastrada — cadastre uma para guardar documentos.',
    docs: 'Nenhum documento aqui ainda.',
    filtered: 'Nenhum documento encontrado com esses filtros.',
    search: 'Nenhum documento com esse nome.',
  },
  list: {
    open: 'Abrir',
    download: 'Baixar',
    remove: 'Remover',
    removeTitle: 'Remover documento',
    removeConfirm: 'Remover este documento? O arquivo também será apagado.',
    removed: 'Documento removido.',
    aiBadge: 'classificado por IA',
  },
  inbox: {
    button: 'Triagem por IA',
    title: 'Enviar para triagem (IA)',
    hint: 'Suba arquivos sem escolher empresa — a IA classifica o tipo, identifica a empresa pelo CNPJ e arquiva. O que ficar em dúvida fica em "Pendentes de arquivamento" para você confirmar.',
    drop: 'Arraste arquivos aqui ou clique para escolher',
    sending: 'Enviando…',
    done: 'Enviado',
    duplicate: 'Duplicado',
    error: 'Erro',
    close: 'Fechar',
    summary: (ok: number, err: number) =>
      `${ok} enviado(s) para triagem, ${err} com erro. Aparecem aqui assim que a IA processar.`,
  },
  correct: {
    title: 'Corrigir tipo',
    label: 'Tipo correto',
    save: 'Salvar correção',
    saving: 'Salvando…',
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
