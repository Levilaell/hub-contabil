import { describe, expect, it } from 'vitest';

import { CFOP_DOMAIN, parseNfe } from './nfe';

// Anonymized NF-e 4.00 sample: two items with distinct CFOPs, an <emit> CNPJ, and a
// <dest> CNPJ that must NOT be mistaken for the issuer. Whitespace/newlines mimic a
// real authorized XML.
const NFE = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe35200114200166000187550010000000031000000017" versao="4.00">
      <ide><cUF>35</cUF><mod>55</mod><nNF>3</nNF></ide>
      <emit>
        <CNPJ>14200166000187</CNPJ>
        <xNome>Fornecedor Exemplo LTDA</xNome>
        <enderEmit><xLgr>Rua A</xLgr></enderEmit>
      </emit>
      <dest>
        <CNPJ>99999999000191</CNPJ>
        <xNome>Cliente Exemplo</xNome>
      </dest>
      <det nItem="1">
        <prod><cProd>001</cProd><xProd>Produto 1</xProd><CFOP>5102</CFOP></prod>
        <imposto><ICMS/></imposto>
      </det>
      <det nItem="2">
        <prod><cProd>002</cProd><xProd>Produto 2</xProd><CFOP>6102</CFOP></prod>
        <imposto><ICMS/></imposto>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`;

describe('parseNfe', () => {
  it('extracts the issuer CNPJ from <emit>, never <dest>', () => {
    expect(parseNfe(NFE).issuerCnpj).toBe('14200166000187');
  });

  it('extracts one CFOP per item with its nItem', () => {
    const parsed = parseNfe(NFE);
    expect(parsed.items).toEqual([
      { nItem: 1, cfop: '5102' },
      { nItem: 2, cfop: '6102' },
    ]);
  });

  it('extracts the 44-digit access key from infNFe@Id', () => {
    expect(parseNfe(NFE).accessKey).toBe('35200114200166000187550010000000031000000017');
  });

  it('flags a real NF-e as such', () => {
    expect(parseNfe(NFE).isNfe).toBe(true);
  });

  it('returns empty for non-NF-e XML (e.g. an NFS-e)', () => {
    const nfse = `<ConsultarNfseResposta><CompNfse><Nfse><InfNfse><Numero>10</Numero></InfNfse></Nfse></CompNfse></ConsultarNfseResposta>`;
    const parsed = parseNfe(nfse);
    expect(parsed.isNfe).toBe(false);
    expect(parsed.items).toEqual([]);
    expect(parsed.issuerCnpj).toBeNull();
  });

  it('handles a bare <NFe> without nfeProc and falls back chave via chNFe', () => {
    const bare = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe versao="4.00"><emit><CNPJ>14200166000187</CNPJ></emit><det nItem="1"><prod><CFOP>1102</CFOP></prod></det></infNFe></NFe><protNFe><infProt><chNFe>35200114200166000187550010000000031000000017</chNFe></infProt></protNFe>`;
    const parsed = parseNfe(bare);
    expect(parsed.isNfe).toBe(true);
    expect(parsed.accessKey).toBe('35200114200166000187550010000000031000000017');
    expect(parsed.items).toEqual([{ nItem: 1, cfop: '1102' }]);
  });

  it('issuer is null when emit carries a CPF instead of CNPJ (rural producer)', () => {
    const cpf = `<NFe><infNFe><emit><CPF>12345678901</CPF></emit><det nItem="1"><prod><CFOP>5102</CFOP></prod></det></infNFe></NFe>`;
    expect(parseNfe(cpf).issuerCnpj).toBeNull();
  });

  it('exposes the cfop domain constant', () => {
    expect(CFOP_DOMAIN).toBe('cfop');
  });
});
