import { copy } from './copy';

// T1 bootstrap screen: proves the web app talks to Supabase Cloud.
// Replaced by the real dashboard in T13.
async function isSupabaseReachable(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return false;
  }
  try {
    const response = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export default async function Home() {
  const connected = await isSupabaseReachable();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">{copy.appName}</h1>
      <p className="text-muted-foreground text-sm">{copy.tagline}</p>
      <p className={connected ? 'text-sm text-green-600' : 'text-sm text-red-600'}>
        {connected ? copy.supabaseConnected : copy.supabaseDisconnected}
      </p>
    </main>
  );
}
