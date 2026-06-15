import { buildTemplateCsv } from '@/lib/import/template';

// Downloadable onboarding template (CSV). Behind the (app) auth middleware.
export function GET() {
  return new Response(`﻿${buildTemplateCsv()}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="modelo-empresas.csv"',
    },
  });
}
