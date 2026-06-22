import { describe, expect, it } from 'vitest';

import {
  HeuristicClassificationAdapter,
  createClassificationAdapter,
} from './classification';

describe('HeuristicClassificationAdapter', () => {
  it('defers to a human with zero confidence (→ exception)', async () => {
    const adapter = new HeuristicClassificationAdapter();
    const result = await adapter.classify({
      taxonomy: ['nfe', 'other'],
      fileName: 'x.pdf',
      model: 'claude-opus-4-8',
    });
    expect(result).toEqual({ docType: 'other', confidence: 0, cnpj: null });
  });
});

describe('createClassificationAdapter', () => {
  it('returns the heuristic adapter when no key is configured', () => {
    const adapter = createClassificationAdapter({});
    expect(adapter).toBeInstanceOf(HeuristicClassificationAdapter);
  });

  it('returns a non-heuristic adapter when a key is present', () => {
    const adapter = createClassificationAdapter({ ANTHROPIC_API_KEY: 'sk-ant-test' });
    expect(adapter).not.toBeInstanceOf(HeuristicClassificationAdapter);
  });
});
