// UI copy (pt-BR) for the public client page (T16). The simplest screen in the
// product (CLAUDE.md UX rule #1): brand + one sentence + one action.
export const copy = {
  poweredBy: 'Hub Contábil',
  secure: 'Conexão segura',
  upload: {
    instruction: 'Selecione ou arraste o arquivo abaixo para enviar com segurança.',
    dropzone: 'Clique para escolher ou arraste o arquivo aqui',
    sending: 'Enviando…',
    success: 'Documento enviado com sucesso. Obrigado!',
    successHint: 'Você já pode fechar esta página.',
    error: 'Não foi possível enviar. Tente novamente.',
    another: 'Enviar outro arquivo',
    received: 'Este documento já foi enviado. Obrigado!',
  },
  offer: {
    instruction: 'Um documento foi disponibilizado para você.',
    download: 'Baixar documento',
    downloading: 'Preparando download…',
    error: 'Não foi possível baixar. O link pode ter expirado.',
  },
  expired: {
    title: 'Link expirado',
    body: 'Este link de acesso não está mais válido. Solicite um novo ao seu escritório contábil.',
  },
  invalid: {
    title: 'Link não encontrado',
    body: 'Não encontramos esta solicitação. Confira o endereço ou peça um novo link ao seu escritório contábil.',
  },
} as const;
