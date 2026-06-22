import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// Golden rule #1 guard (T24): the worker uses the service role (bypasses RLS), so
// every WRITE to a firm-scoped table must carry firm_id. This statically scans the
// worker source and fails if an insert/update/delete on a public table doesn't
// mention firm_id nearby. Cross-firm cron READS (e.g. scanning public.firms) are
// intentionally exempt — the danger is writing to the wrong firm, not reading.

const SRC = dirname(fileURLToPath(import.meta.url));

// Tables without a firm_id column — writes to these are exempt. (None today; the
// worker only writes firm-scoped domain tables.)
const FIRM_AGNOSTIC = new Set<string>([]);

const WRITE = /(insert\s+into|update|delete\s+from)\s+public\.(\w+)/gi;

function tsSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsSourceFiles(full));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

describe('worker firm_id scope guard (golden rule #1)', () => {
  it('every write to a firm-scoped table references firm_id', () => {
    const violations: string[] = [];
    for (const file of tsSourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(WRITE)) {
        const table = (match[2] ?? '').toLowerCase();
        if (FIRM_AGNOSTIC.has(table)) continue;
        const start = match.index ?? 0;
        // firm_id should appear in the same statement (columns or where clause).
        if (!/firm_id/i.test(text.slice(start, start + 800))) {
          violations.push(`${relative(SRC, file)}: "${match[0]}" without firm_id`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
