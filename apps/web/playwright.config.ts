import { defineConfig } from '@playwright/test';

// E2E for critical flows (T23). Runs against the Next dev server, which talks to the
// Supabase Cloud dev project via apps/web/.env.local. Auth is established once in
// auth.setup.ts (saved storageState) and reused by the authenticated specs. Some
// flows depend on the worker (triage/export/deadline crons) — run `pnpm --filter
// @hub/worker dev` alongside, or those specs will time out waiting for async results.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      testIgnore: /\.public\.spec\.ts$/,
      use: { browserName: 'chromium', storageState: 'e2e/.auth/owner.json' },
      dependencies: ['setup'],
    },
    // Public flows need no auth (the client-access page has no session).
    { name: 'public', testMatch: /\.public\.spec\.ts/, use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
