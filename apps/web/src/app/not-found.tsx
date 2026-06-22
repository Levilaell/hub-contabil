import { FileQuestion } from 'lucide-react';
import Link from 'next/link';

// Root 404 (T24, UX rule #7) — says what happened and offers a way out.
const copy = {
  title: 'Página não encontrada',
  description: 'O endereço que você abriu não existe ou foi movido.',
  home: 'Ir para o início',
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <FileQuestion className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-base font-semibold">{copy.title}</h1>
        <p className="text-muted-foreground max-w-sm text-sm">{copy.description}</p>
      </div>
      <Link
        href="/inicio"
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
      >
        {copy.home}
      </Link>
    </div>
  );
}
