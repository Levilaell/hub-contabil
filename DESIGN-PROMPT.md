# Prompt para o Claude Design — redesenho visual do Hub Contábil

> Cole o conteúdo abaixo (a partir de "Você é um designer…") no Claude. Quando gostar do
> resultado, exporte o código pra cá que eu adapto ao app real (mantendo a lógica).

---

Você é um designer de produto sênior. Crie o **design visual completo** de um SaaS web já
existente, como um **protótipo navegável em React + Tailwind (artifact)**, com dados
fictícios realistas em **português do Brasil**. Sem backend — é só a camada visual/navegável
para eu aprovar a direção.

## O produto
**Hub Contábil** — painel de trabalho para **escritórios de contabilidade** brasileiros.
Quem usa: contadores e a equipe do escritório (donos, gerentes, analistas), pessoas
**não-técnicas**, muitas vezes no celular. Centraliza: empresas-clientes, tarefas,
documentos, prazos (certidões/licenças), solicitações de documentos ao cliente, triagem de
documentos por IA e exportação para o sistema contábil.

## Regra nº 1 (inegociável): simplicidade radical
O maior risco do produto é **excesso visual** — tentativas anteriores fracassaram por
entupir as telas. Cada tela responde **uma pergunta principal**. Muito espaço em branco.
Listas mostram o mínimo (indicador + nome + 1–2 fatos); o resto vai num painel lateral
(drawer) a um clique. Tabelas: no máximo 5 colunas. Uma contadora que nunca viu o sistema
entende qualquer tela em 5 segundos.

## Direção visual: ACOLHEDOR E HUMANO
- Sensação amigável e tranquila — o usuário lida com prazos e multas, então o app deve
  **reduzir ansiedade**, não aumentar. Cantos bem arredondados (rounded-xl/2xl), sombras
  suaves, respiro generoso, ícones leves.
- Tipografia humanista e amigável, mas legível para números (ex.: Figtree, Plus Jakarta
  Sans ou Nunito Sans; use números tabulares).
- Microcópias claras, gentis, pt-BR, zero jargão técnico ("Vence em 5 dias", "Tudo em dia ✅").

## Paleta
- **Marca / primária: laranja `#FFA500`** — botões primários, item ativo na navegação,
  destaques de marca, logo. **Uma** ação primária por tela, dominante, nessa cor.
- **Base: branco + preto** — fundo branco levemente quente (ex.: `#FCFBF9`); texto preto
  suave (`#1A1A1A`), não preto puro.
- **Cor = significado, nunca decoração.** As cores de status são reservadas e **separadas**
  do laranja de marca:
  - 🟢 verde = ok/em dia · 🟡 amarelo = atenção/a vencer · 🔴 vermelho = vencido/erro ·
    ⚪ cinza = sem dados.
  - **Importante:** o amarelo de status deve ser visivelmente diferente do laranja de marca
    (use um amarelo/dourado distinto), para ninguém confundir "atenção" com "ação de marca".

## O FAROL é a metáfora central
Um componente **farol (semáforo)** — verde/amarelo/vermelho/cinza — aparece em todo lugar
(dashboard, painel de empresas, prazos), sempre idêntico. Regra de agregação: vermelho se
algo vencido; amarelo se algo a vencer e nada vencido; verde se tudo ok; cinza se sem dados.

## Componentes do design system (defina primeiro, reutilize em tudo)
1. **Farol** — indicador de 4 estados.
2. **StatusBadge** — cor + ícone + rótulo curto pt-BR; tons: sucesso/atenção/perigo/neutro/apagado.
3. **StatCard** — número grande + rótulo + ícone, clicável.
4. **Linha de lista (DataList)** — indicador à esquerda + título + até 2 fatos + chevron.
5. **DetailDrawer** — painel lateral deslizante para detalhes e ações.
6. **PageHeader** — título + UMA ação primária (laranja).
7. **EmptyState** — estado vazio desenhado (frase amigável + o que fazer + ícone).
8. **AppShell** — sidebar única (máx. **7** itens; ícone + rótulo; badges de contagem nas
   filas) + topbar (sino de notificações, menu do usuário). No celular vira gaveta.

Inclua TODOS os estados de cada tela: normal, **vazio**, **carregando** (skeletons, não
spinners) e **erro** (mensagem pt-BR + botão "Tentar de novo").

## Telas (protótipo navegável)
**Prioritárias — definem o visual:**
1. **Login** — a tela mais simples; momento de marca: logo, 2 campos, 1 botão laranja.
2. **Início (Dashboard)** — máx. **6 StatCards** grandes (Tarefas abertas, Exceções, Prazos
   em atenção, Empresas, Documentos, Solicitações), cada um clicável. Abaixo, "Painel geral":
   uma linha por empresa com **farol** + nome + 2 fatos. Números antes de tabelas. Mobile-friendly.
3. **Empresas (lista)** — linha: status + nome + (regime · cidade). Ação primária "Nova
   empresa". Filtros recolhidos atrás de uma visão padrão.
4. **Empresa (detalhe)** — cabeçalho com nome + **farol** + StatusBadge; abas: Dados,
   Contatos, Tarefas, Documentos, Prazos, Solicitações.
5. **Tarefas** — visão padrão "Minhas tarefas de hoje"; **kanban** com 4 colunas (Pendentes,
   Em andamento, Concluídas, Canceladas); clicar num card abre drawer com detalhes e ação
   "Concluir" / "Concluir e repassar".
6. **Exceções** — visão padrão "Exceções abertas"; lista; drawer com o contexto em pt-BR
   claro + **sugestão da IA pré-preenchida** + botões "Resolver" / "Ignorar". Vazio:
   "Nenhuma exceção pendente — tudo em dia ✅".
7. **Documentos** — escolher empresa → lista de arquivos (tipo · competência · departamento);
   upload em massa (arrastar-e-soltar); botão "Triagem por IA"; arquivos classificados pela
   IA ganham selo "classificado por IA ✨" + ação "Corrigir".
8. **Página pública do cliente** (rota `/s/{token}`, **SEM login**) — a tela mais simples do
   produto: logo do escritório, **uma frase** ("A [Escritório] solicitou um documento"),
   **UMA ação** (enviar arquivo OU baixar). Acolhedora e confiável para um leigo.

**Secundárias (mesmo sistema, se houver espaço):** Prazos (lista agrupada por farol + form
simples), Solicitações (linha do tempo de status), Exportação (montar lote + lista), Regras
de CFOP (tabela de-para), Configurações.

## Dados fictícios (deixe as telas "vivas")
Empresas plausíveis ("Padaria Pão Quente LTDA", "Transportes Silva ME"), CNPJs formatados
(00.000.000/0000-00), competências ("2026-06"), tipos de prazo ("CND Federal", "Alvará",
"Certificado Digital A1"), tarefas ("Apurar ICMS — junho", "Enviar SPED"), departamentos
(Fiscal, Contábil, DP, Compliance). Datas humanas ("vence em 5 dias", "há 2 horas"). Misture
estados de farol (alguns vermelhos/amarelos) para mostrar a metáfora funcionando.

## NÃO faça
- Tabela densa no dashboard (use os StatCards). · Mais de 7 itens na sidebar. · Cor como
  decoração (cor só carrega significado de status). · Jargão técnico na tela ("JSONB",
  "payload", "fila", "tenant"). · Spinners no lugar de skeletons.

## Entregue
Protótipo React + Tailwind **navegável** (clicar na navegação troca de tela), **responsivo**
(inclusive celular), com os componentes reutilizados de forma consistente e todos os estados.
Comece definindo os **tokens** (cores, tipografia, espaçamento, raio, sombra) e os componentes
base; depois monte as telas prioritárias.
