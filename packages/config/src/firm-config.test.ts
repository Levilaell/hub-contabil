import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TAXONOMY,
  docTypeLabel,
  parseFirmConfig,
  validateFirmConfig,
} from './firm-config';

describe('parseFirmConfig', () => {
  it('fills full defaults for an empty (freshly seeded) config', () => {
    const config = parseFirmConfig({});
    expect(config.deadlineTriggers.defaultDays).toBe(30);
    expect(config.aiThreshold).toBe(0.85);
    expect(config.departments.length).toBeGreaterThan(0);
    expect(config.taxonomy).toContain('nfe');
    expect(config.routingMap.nfe).toBe('fiscal');
    expect(config.taxRegimes.map((r) => r.key)).toContain('simples_nacional');
    expect(config.monitoredKinds.map((k) => k.key)).toContain('cnd_federal');
  });

  it('treats null/undefined as empty', () => {
    expect(parseFirmConfig(null).deadlineTriggers.defaultDays).toBe(30);
    expect(parseFirmConfig(undefined).aiThreshold).toBe(0.85);
  });

  it('keeps stored values and only defaults what is missing', () => {
    const config = parseFirmConfig({ deadlineTriggers: { defaultDays: 45 } });
    expect(config.deadlineTriggers.defaultDays).toBe(45);
    expect(config.aiThreshold).toBe(0.85); // still defaulted
  });
});

describe('validateFirmConfig', () => {
  it('accepts a valid config', () => {
    const result = validateFirmConfig({ deadlineTriggers: { defaultDays: 15 }, aiThreshold: 0.9 });
    expect(result.success).toBe(true);
  });

  it('rejects a non-positive trigger with a pt-BR message', () => {
    const result = validateFirmConfig({ deadlineTriggers: { defaultDays: 0 } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toBe('O prazo de alerta deve ser de pelo menos 1 dia.');
    }
  });

  it('rejects an out-of-range AI threshold with a pt-BR message', () => {
    const result = validateFirmConfig({ aiThreshold: 1.5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toBe('O limite de confiança deve estar entre 0 e 1.');
    }
  });
});

describe('docTypeLabel', () => {
  it('maps every default taxonomy key to a pt-BR label (no raw keys in the UI)', () => {
    for (const key of DEFAULT_TAXONOMY) {
      const label = docTypeLabel(key);
      expect(label).not.toBe(key); // never the raw key
      expect(label.length).toBeGreaterThan(0);
    }
    expect(docTypeLabel('bank_statement')).toBe('Extrato bancário');
    expect(docTypeLabel('nfe')).toBe('NF-e');
  });

  it('prettifies unknown firm-added keys instead of showing snake_case', () => {
    expect(docTypeLabel('guia_condominio')).toBe('Guia condominio');
    expect(docTypeLabel('')).toBe('');
  });
});
