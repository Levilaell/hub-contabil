'use client';

// Last-resort boundary (T24): catches errors in the root layout itself, where the
// normal stylesheet/layout may be unavailable — so it uses inline styles to stay
// legible no matter what. pt-BR, with a retry.
const copy = {
  title: 'Algo deu errado',
  description: 'Ocorreu um erro inesperado. Tente novamente.',
  retry: 'Tentar novamente',
};

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          color: '#0f172a',
          background: '#f8fafc',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{copy.title}</h2>
        <p style={{ fontSize: 14, color: '#64748b', maxWidth: 360, margin: 0 }}>{copy.description}</p>
        <button
          type="button"
          onClick={reset}
          style={{
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 500,
            color: '#fff',
            background: '#0f172a',
            cursor: 'pointer',
          }}
        >
          {copy.retry}
        </button>
      </body>
    </html>
  );
}
