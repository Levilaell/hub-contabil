import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Load packages/db/.env into the test environment so the RLS integration test
// can reach the cloud dev project. When absent (e.g. plain CI), the test skips.
const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '.env');
const env: Record<string, string> = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match) {
      env[match[1]] = match[2];
    }
  }
}

export default defineConfig({
  test: {
    env,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
