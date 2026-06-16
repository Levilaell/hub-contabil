'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';

// Shared error boundary for every authenticated screen (CLAUDE.md UX rule #7:
// errors are designed, plain pt-BR, with a retry action — never a raw stack).
// Lives at the (app) shell level so all screens degrade the same way.
const copy = {
  title: 'Algo deu errado',
  description: 'Não conseguimos carregar esta tela. Tente novamente em instantes.',
  retry: 'Tentar novamente',
};

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="bg-danger/12 text-danger flex size-12 items-center justify-center rounded-full">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{copy.title}</h2>
        <p className="text-muted-foreground max-w-sm text-sm">{copy.description}</p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
      >
        <RotateCw className="size-4" aria-hidden />
        {copy.retry}
      </button>
    </div>
  );
}
