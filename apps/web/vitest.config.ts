import { defineConfig } from 'vitest/config';

// Unit tests (Vitest) live under src/. The e2e/ folder holds Playwright specs
// (run via `pnpm test:e2e`), which Vitest must not pick up — its test runtime is
// incompatible with Playwright's, so collecting *.spec.ts there throws
// "Playwright Test did not expect test() to be called here". Scoping include to
// src/ keeps the two runners cleanly separated.
export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
