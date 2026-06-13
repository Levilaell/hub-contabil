'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

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
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{copy.brand}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{copy.subtitle}</p>
        </div>
        <form onSubmit={onSubmit} className="bg-card space-y-4 rounded-xl border p-6">
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
