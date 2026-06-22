'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { BrandMark } from '@/components/brand';
import { createClient } from '@/lib/supabase/client';

import { copy } from './copy';

const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(copy.error);
      setSubmitting(false);
      return;
    }
    router.push('/inicio');
    router.refresh();
  }

  return (
    <main
      className="flex min-h-dvh items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(120% 90% at 50% -10%, #FFF6E8 0%, var(--background) 55%)',
      }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <BrandMark className="size-12 rounded-2xl" />
          <span className="text-lg font-extrabold tracking-tight">{copy.brand}</span>
        </div>
        <form
          onSubmit={onSubmit}
          className="bg-card space-y-4 rounded-3xl border p-6 shadow-[0_1px_2px_rgba(26,26,26,0.04),0_8px_24px_rgba(26,26,26,0.06)] sm:p-7"
        >
          <div className="mb-1 space-y-1">
            <h1 className="text-xl font-bold tracking-tight">{copy.greeting}</h1>
            <p className="text-muted-foreground text-sm">{copy.subtitle}</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              {copy.email}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={copy.emailPlaceholder}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              {copy.password}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
          </div>
          {error ? <p className="text-danger-text text-sm">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-60"
          >
            {submitting ? copy.submitting : copy.submit}
          </button>
        </form>
      </div>
    </main>
  );
}
