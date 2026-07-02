import Link from 'next/link';

import { BrandMark } from '@/components/brand';

import { copy } from './copy';

// Public landing page. Logged-out visitors land here; the CTA goes to /login
// (the middleware sends authenticated users straight to /inicio).
export default function Home() {
  return (
    <main
      className="flex min-h-dvh flex-col"
      style={{
        background: 'radial-gradient(120% 80% at 50% -10%, #FFF6E8 0%, var(--background) 55%)',
      }}
    >
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between p-6">
        <span className="flex items-center gap-2">
          <BrandMark className="size-8 rounded-xl" />
          <span className="font-extrabold tracking-tight">{copy.appName}</span>
        </span>
        <Link
          href="/login"
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          {copy.cta}
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <BrandMark className="mb-6 size-16 rounded-3xl" />
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{copy.tagline}</h1>
        <p className="text-muted-foreground mt-4 max-w-xl text-base">{copy.subtitle}</p>
        <Link
          href="/login"
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-8 rounded-xl px-6 py-3 text-sm font-semibold transition-colors"
        >
          {copy.cta}
        </Link>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {copy.features.map((f) => (
          <div key={f.title} className="bg-card rounded-2xl border p-5">
            <h2 className="text-sm font-semibold">{f.title}</h2>
            <p className="text-muted-foreground mt-1.5 text-sm">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="text-muted-foreground border-t py-6 text-center text-xs">
        {copy.footer}
      </footer>
    </main>
  );
}
