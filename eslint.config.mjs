// Root ESLint flat config for worker, packages and clients.
// apps/web is excluded: it carries its own Next.js ESLint config.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/.turbo/**', 'apps/web/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
);
