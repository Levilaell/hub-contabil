// Deterministic NF-e (modelo 55) parser (T19). Extracts the issuer CNPJ and each
// item's CFOP — the inputs the CFOP mapping-rules engine needs. NO LLM and NO XML
// library: it reads a small set of well-known, namespace-default fields from the
// stable layout-4.00 schema. The authorized fiscal XML is never modified (golden
// rule #4); this only reads it. Pure: string in, data out.

export const CFOP_DOMAIN = 'cfop';

export interface NfeItem {
  nItem: number;
  cfop: string;
}

export interface ParsedNfe {
  isNfe: boolean;
  accessKey: string | null;
  issuerCnpj: string | null;
  items: NfeItem[];
}

/** Contents of the first <tag>…</tag> block (attributes allowed on the open tag). */
function blockContent(xml: string, tag: string): string | null {
  return new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(xml)?.[1] ?? null;
}

export function parseNfe(xml: string): ParsedNfe {
  const isNfe = /<infNFe\b/i.test(xml) || /<NFe\b/i.test(xml);
  if (!isNfe) return { isNfe: false, accessKey: null, issuerCnpj: null, items: [] };

  // Access key: the canonical 44-digit chave, from infNFe@Id ("NFe" + 44) or chNFe.
  const idMatch = /<infNFe\b[^>]*\bId="NFe(\d{44})"/i.exec(xml);
  const chMatch = /<chNFe>\s*(\d{44})\s*<\/chNFe>/i.exec(xml);
  const accessKey = idMatch?.[1] ?? chMatch?.[1] ?? null;

  // Issuer CNPJ: scoped to the <emit> block so we never pick up <dest>'s CNPJ.
  const emit = blockContent(xml, 'emit');
  const issuerCnpj = (emit ? /<CNPJ>\s*(\d{14})\s*<\/CNPJ>/i.exec(emit)?.[1] : null) ?? null;

  // One CFOP per item. <det> blocks never nest, so a non-greedy match is safe.
  const items: NfeItem[] = [];
  const detRe = /<det\b([^>]*)>([\s\S]*?)<\/det>/gi;
  let m: RegExpExecArray | null;
  while ((m = detRe.exec(xml)) !== null) {
    const cfop = /<CFOP>\s*(\d{4})\s*<\/CFOP>/i.exec(m[2] ?? '')?.[1];
    if (!cfop) continue;
    const nItem = /\bnItem="(\d+)"/i.exec(m[1] ?? '')?.[1];
    items.push({ nItem: nItem ? Number(nItem) : items.length + 1, cfop });
  }

  return { isNfe: true, accessKey, issuerCnpj, items };
}
