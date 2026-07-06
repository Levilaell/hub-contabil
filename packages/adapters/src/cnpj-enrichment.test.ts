import { describe, expect, it } from 'vitest';

import { BrasilApiEnrichmentAdapter } from './cnpj-enrichment';

type Stub = { status: number; body: unknown } | 'throw';

// Fake fetch routed by host; records the URLs it was called with.
function mockFetch(stubs: { brasilapi?: Stub; receitaws?: Stub }) {
  const calls: string[] = [];
  const fetchImpl = async (url: string) => {
    calls.push(url);
    const stub = url.includes('brasilapi') ? stubs.brasilapi : stubs.receitaws;
    if (!stub || stub === 'throw') throw new Error('network down');
    return {
      ok: stub.status >= 200 && stub.status < 300,
      status: stub.status,
      json: async () => stub.body,
    };
  };
  return { fetchImpl, calls };
}

const BRASIL_BODY = {
  razao_social: 'EMPRESA TESTE LTDA',
  nome_fantasia: 'Teste',
  natureza_juridica: '206-2 - Sociedade Empresária Limitada',
  porte: 'ME',
  capital_social: 50000,
  data_inicio_atividade: '2019-03-15',
  cnae_fiscal: 6201501,
  cnae_fiscal_descricao: 'Desenvolvimento de programas',
  descricao_situacao_cadastral: 'ATIVA',
  opcao_pelo_simples: true,
  opcao_pelo_mei: false,
  email: 'contato@teste.test',
  ddd_telefone_1: '1133334444',
  logradouro: 'RUA X',
  numero: '100',
  municipio: 'SAO PAULO',
  uf: 'SP',
  cep: '01000000',
  qsa: [
    {
      nome_socio: 'MARIA DA SILVA',
      qualificacao_socio: 'Sócio-Administrador',
      cnpj_cpf_do_socio: '***123456**',
    },
    { nome_socio: 'JOSE DA SILVA', qualificacao_socio: 'Sócio' },
  ],
};

const RECEITA_BODY = {
  nome: 'EMPRESA RECEITA LTDA',
  fantasia: 'Receita',
  natureza_juridica: '206-2 - Sociedade Empresária Limitada',
  porte: 'DEMAIS',
  capital_social: '120000.00',
  abertura: '15/03/2019',
  atividade_principal: [{ code: '62.01-5-01', text: 'Desenvolvimento de software' }],
  situacao: 'ATIVA',
  simples: { optante: false },
  municipio: 'RIO DE JANEIRO',
  uf: 'RJ',
  qsa: [{ nome: 'JOANA PEREIRA', qual: '49-Sócio-Administrador' }],
};

describe('BrasilApiEnrichmentAdapter', () => {
  it('returns BrasilAPI data on success without calling the fallback', async () => {
    const { fetchImpl, calls } = mockFetch({ brasilapi: { status: 200, body: BRASIL_BODY } });
    const adapter = new BrasilApiEnrichmentAdapter({ fetchImpl, throttleMs: 0 });

    const result = await adapter.enrich('11.222.333/0001-81');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe('brasilapi');
    expect(result.data.legalName).toBe('EMPRESA TESTE LTDA');
    expect(result.data.cnaePrimaryCode).toBe('6201501');
    expect(result.data.address.state).toBe('SP');
    expect(result.data.simplesOptant).toBe(true);
    expect(result.data.legalNature).toBe('206-2 - Sociedade Empresária Limitada');
    expect(result.data.companySize).toBe('ME');
    expect(result.data.shareCapital).toBe(50000);
    expect(result.data.activitiesStartedOn).toBe('2019-03-15');
    expect(result.data.partners).toEqual([
      { name: 'MARIA DA SILVA', qualification: 'Sócio-Administrador', cpfCnpj: '***123456**' },
      { name: 'JOSE DA SILVA', qualification: 'Sócio', cpfCnpj: null },
    ]);
    expect(calls).toHaveLength(1);
  });

  it('falls back to ReceitaWS when BrasilAPI fails', async () => {
    const { fetchImpl, calls } = mockFetch({
      brasilapi: { status: 500, body: null },
      receitaws: { status: 200, body: RECEITA_BODY },
    });
    const adapter = new BrasilApiEnrichmentAdapter({ fetchImpl, throttleMs: 0 });

    const result = await adapter.enrich('11222333000181');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe('receitaws');
    expect(result.data.legalName).toBe('EMPRESA RECEITA LTDA');
    expect(result.data.cnaePrimaryCode).toBe('62.01-5-01');
    expect(result.data.address.state).toBe('RJ');
    expect(result.data.companySize).toBe('DEMAIS');
    expect(result.data.shareCapital).toBe(120000);
    expect(result.data.activitiesStartedOn).toBe('2019-03-15');
    expect(result.data.partners).toEqual([
      { name: 'JOANA PEREIRA', qualification: '49-Sócio-Administrador', cpfCnpj: null },
    ]);
    expect(calls).toHaveLength(2);
  });

  it('treats a ReceitaWS error body as a failure', async () => {
    const { fetchImpl } = mockFetch({
      brasilapi: { status: 429, body: null },
      receitaws: { status: 200, body: { status: 'ERROR', message: 'CNPJ rejeitado' } },
    });
    const adapter = new BrasilApiEnrichmentAdapter({ fetchImpl, throttleMs: 0 });

    const result = await adapter.enrich('11222333000181');
    expect(result.ok).toBe(false);
  });

  it('does not call the fallback when it is disabled', async () => {
    const { fetchImpl, calls } = mockFetch({ brasilapi: 'throw' });
    const adapter = new BrasilApiEnrichmentAdapter({
      fetchImpl,
      throttleMs: 0,
      receitawsFallback: false,
    });

    const result = await adapter.enrich('11222333000181');
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('rejects an invalid CNPJ without any network call', async () => {
    const { fetchImpl, calls } = mockFetch({ brasilapi: { status: 200, body: BRASIL_BODY } });
    const adapter = new BrasilApiEnrichmentAdapter({ fetchImpl, throttleMs: 0 });

    const result = await adapter.enrich('123');
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
