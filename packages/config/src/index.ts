// Zod schemas for per-firm configuration (deadline triggers, AI threshold,
// taxonomy, routing map, departments, status vocabularies).

export const CONFIG_PACKAGE_NAME = '@hub/config';

export {
  firmConfigSchema,
  parseFirmConfig,
  validateFirmConfig,
  type FirmConfig,
  type FirmConfigValidation,
  DEFAULT_DEPARTMENTS,
  DEFAULT_TAX_REGIMES,
  DEFAULT_TAXONOMY,
  DEFAULT_ROUTING_MAP,
  DEFAULT_STATUS_VOCABULARIES,
} from './firm-config';
