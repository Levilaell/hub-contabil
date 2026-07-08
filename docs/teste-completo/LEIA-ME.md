# Teste completo do Hub Contábil

- **`ROTEIRO-DE-TESTES.md`** — o guia: 14 partes em ordem, com "Faça" e "Esperado" para
  cada funcionalidade do sistema. Comece pela Parte 0 (preparação).
- **`arquivos/`** — kit de arquivos de exemplo (sem valor fiscal/jurídico, CNPJs fictícios
  com dígitos válidos):

| Arquivo | Para testar |
|---------|-------------|
| `das-exemplo.pdf` | triagem: caminho feliz (das → Fiscal) |
| `folha-pagamento-exemplo.pdf` | triagem: payslip → DP · documento via WhatsApp |
| `contrato-social-exemplo.pdf` | triagem: contrato → Societário/Compliance |
| `comprovante-pagamento-exemplo.pdf` | departamento decidido pelo CONTEÚDO |
| `boleto-exemplo.pdf` | upload manual, dedup, busca |
| `nfe-exemplo.xml` | parser determinístico de NF-e na triagem (empresa não encontrada → arquivar) |
| `nfe-exemplo-2.xml` | upload manual de NF-e → motor de CFOP → exceção de Regras → salvar regra |
| `nfse-exemplo.xml` | XML que NÃO é NF-e → classificação por texto |
| `arquivo-nao-suportado.txt` | caminho de exceção (tipo não processável) |
| `empresas-importacao-exemplo.csv` | importação de empresas por planilha |
| `regras-cfop-exemplo.csv` | importação de regras de CFOP |

Todos os PDFs citam o CNPJ `45.723.174/0001-10` (EMPRESA TESTE HUB LTDA, que o roteiro
manda cadastrar na Parte 3.2) — é por ele que a triagem descobre a empresa dona.
