import { describe, expect, it } from 'vitest';

import { CORE_PACKAGE_NAME } from './index.js';

describe('core package wiring', () => {
  it('resolves the package entrypoint', () => {
    expect(CORE_PACKAGE_NAME).toBe('@hub/core');
  });
});
