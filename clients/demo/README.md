# clients/demo

Configuration and overrides for the Escritório Demo deployment — never core logic.

- **`config.json`** — initial firm config (partial overrides; `parseFirmConfig` fills the
  rest from defaults). Applied to `firms.config`.
- **`RUNBOOK.md`** — reproducible production deployment (Supabase Cloud + Railway web +
  worker), with §11 parametrizing it for client #2.
