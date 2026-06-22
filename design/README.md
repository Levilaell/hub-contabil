# Handoff: Hub Contábil — camada visual

## Visão geral
Hub Contábil é um painel de trabalho para escritórios de contabilidade brasileiros. Centraliza empresas-clientes, tarefas, documentos, prazos (certidões/licenças), solicitações de documentos ao cliente, triagem de documentos por IA e exportação para o sistema contábil. O público são contadores e equipe (donos, gerentes, analistas), muitas vezes não-técnicos e no celular.

Este pacote entrega **somente a camada visual/navegável** para você replicar no app que já existe.

## Sobre os arquivos de design
O arquivo `Hub Contábil.dc.html` é uma **referência de design feita em HTML** — um protótipo que mostra a aparência e o comportamento pretendidos, **não é código de produção para copiar diretamente**. A tarefa é **recriar este design no ambiente do seu codebase** (React, Vue, etc.), usando os padrões, componentes e bibliotecas que você já tem. Toda a estilização do protótipo é inline; no seu projeto, traduza para o seu sistema (Tailwind, CSS Modules, styled-components, design tokens…).

> Nota técnica: o `.dc.html` é um "Design Component" e usa tags próprias (`<sc-for>`, `<sc-if>`, `{{ }}`) + uma classe de lógica. Use-o como **fonte de verdade visual** (medidas, cores, copy, estados) — não como arquitetura a copiar. Abrir o arquivo no navegador renderiza o protótipo completo.

## Fidelidade
**Alta fidelidade (hifi).** Cores, tipografia, espaçamento, raios, sombras e interações são finais. Recrie a UI fielmente usando os componentes/bibliotecas do seu codebase. Onde o protótipo usa SVGs de ícone desenhados à mão, substitua pelo seu set de ícones (ex.: Lucide/Phosphor) mantendo o traço fino.

---

## Princípio nº 1: simplicidade radical
Cada tela responde **uma** pergunta principal. Muito espaço em branco. Listas mostram o mínimo (indicador + nome + 1–2 fatos); o resto vai num **drawer** lateral a um clique. Tabelas: no máximo 5 colunas. **Uma ação primária por tela**, em laranja. Nunca usar jargão técnico na tela.

## Metáfora central: o FAROL
Indicador de semáforo com **4 estados**, idêntico em todo lugar (dashboard, empresas, prazos, tarefas):

| Estado | Significado | Cor do ponto | Anel (box-shadow) |
|---|---|---|---|
| `verde` | Em dia / ok | `#2E9E5B` | `rgba(46,158,91,.16)` |
| `amarelo` | A vencer / atenção | `#E6B833` | `rgba(230,184,51,.18)` |
| `vermelho` | Vencido / erro | `#DB4B43` | `rgba(219,75,67,.16)` |
| `cinza` | Sem dados | `#C4BEB2` | `rgba(196,190,178,.22)` |

Visual: círculo de `13px` (12–16px conforme contexto), `border-radius:50%`, preenchido com a cor do ponto e um `box-shadow: 0 0 0 4px <anel>` que cria o halo de "luz".

**Regra de agregação** (para faróis que resumem uma empresa/grupo):
1. `vermelho` se **algo está vencido**;
2. senão `amarelo` se **algo está a vencer**;
3. senão `verde` se **tudo ok**;
4. `cinza` se **não há dados**.

---

## Design Tokens

### Cores
**Marca / primária**
- Laranja primário: `#FFA500` — botões primários, item ativo na navegação, logo, destaques de marca. **Uma ação primária por tela.**
- Texto sobre laranja: `#1A1A1A` (texto escuro sobre laranja, não branco).
- Tint do laranja (fundo de item ativo na nav, chips de IA): `#FFF3E0`; tint mais quente p/ blocos de IA: `#FFF9F0` com borda `#F6E4C8`.

**Base (branco + preto, quentes)**
- Fundo do app: `#FCFBF9` (branco levemente quente)
- Superfície/cards: `#FFFFFF`
- Borda: `#EFEAE0` (divisórias internas de lista: `#F4F0E8`)
- Texto principal: `#1A1A1A`
- Texto secundário: `#7A7468`
- Texto terciário/apagado: `#9A948A` / `#A8A296`
- Cinza de fundo (coluna kanban, chips neutros): `#F6F3ED` / `#F2F0EA` / `#F6F2EA`

**Status (cor = significado; o amarelo é dourado, distinto do laranja de marca)**

| Tom | dot | fundo (bg) | texto (fg) | rótulo pt-BR |
|---|---|---|---|---|
| sucesso (verde) | `#2E9E5B` | `#E8F5EC` | `#1E7F46` | "Em dia" |
| atenção (amarelo/dourado) | `#E6B833` | `#FBF3DC` | `#8A6A12` | "A vencer" |
| perigo (vermelho) | `#DB4B43` | `#FCEAE8` | `#B23A33` | "Vencido" |
| neutro/apagado (cinza) | `#C4BEB2` | `#F2F0EA` | `#76716A` | "Sem dados" |

Cores de texto de status (para frases como "Vence em 2 dias" sobre fundo claro): verde `#1E7F46`, amarelo `#8A6A12`, vermelho `#B23A33`, cinza `#76716A`.

### Tipografia
- Família: **Plus Jakarta Sans** (Google Fonts, pesos 400/500/600/700/800). Fallback: `system-ui, sans-serif`.
- **`font-variant-numeric: tabular-nums`** em todo o app (números alinhados).
- Escala usada:
  - Número grande de StatCard: `34px / 800 / letter-spacing:-.03em`
  - H1 de página: `clamp(23px, 4vw, 30px) / 800 / -.025em`
  - H1 de detalhe (nome da empresa): `clamp(22px, 4vw, 28px) / 800`
  - Título de seção (H2): `18px / 700 / -.02em`
  - Título de card/linha: `15px / 700 / -.01em`
  - Corpo: `14–15px / 400–600`
  - Rótulos/fatos secundários: `13–13.5px`, cor `#9A948A`
  - Kicker/uppercase (no drawer): `12.5px / 700`, `letter-spacing:.05em`, `text-transform:uppercase`, cor `#A8A296`

### Espaçamento
- Padding do conteúdo de página: `clamp(20px, 4vw, 44px)`; largura máx. de conteúdo `1180px`, centralizado.
- Padding de linha de lista: `16px 20px`; padding de card: `20–22px`.
- Gaps: grid de StatCards `16px`; colunas kanban `14px`; cards dentro de coluna `10px`.
- Sidebar: largura `248px`; itens `padding:11px 13px`, `gap:12px`.

### Raio (cantos arredondados — acolhedor)
- Cards/superfícies grandes: `20–22px`
- Cards de login/público: `24–28px`
- Inputs e botões: `13–14px`
- Itens de nav, chips, ícones-chip: `11–13px`
- Ponto do farol e avatares: `50%`; pílulas/badges: `999px`

### Sombras
- Card padrão: `0 1px 2px rgba(26,26,26,.04), 0 8px 24px rgba(26,26,26,.04)` (no protótipo as listas usam `0 1px 2px rgba(26,26,26,.04)`; StatCards ganham `0 10px 26px rgba(26,26,26,.07)` no hover).
- Botão primário laranja: `0 5px 14px rgba(255,165,0,.28)` (login: `0 6px 16px rgba(255,165,0,.3)`).
- Drawer: `-12px 0 40px rgba(26,26,26,.14)`; overlay: `rgba(26,26,26,.42)`.
- Logo laranja: `0 6px 18px rgba(255,165,0,.34)`.

---

## Componentes do design system

1. **Farol** — ver tabela acima. Sempre idêntico.
2. **StatusBadge** — pílula `border-radius:999px`, `padding:6px 12px`, `font-size:13px/600`, com `dot` de `7px` + rótulo curto pt-BR. Usa os pares bg/fg/dot da tabela de status.
3. **StatCard** — card branco clicável. Linha superior: ícone num chip `42px` (`background:#F6F2EA`, ícone `#6B6357`, raio `13px`) + chevron à direita (`#D8D1C4`). Abaixo: número `34px/800`, rótulo `14px/600 #5C574E`, e uma linha de "hint" `12.5px/600` colorida conforme significado (ex.: "5 vencem hoje" em `#B57E13`, "precisam de atenção" em `#B23A33`, neutros em `#A8A296`). Hover: `translateY(-2px)` + sombra.
4. **DataList (linha de lista)** — `display:flex; align-items:center; gap:15px; padding:16px 20px`, divisória inferior `#F4F0E8`, hover `background:#FCFBF9`. Esquerda: farol. Centro: título `15px/700` + 1–2 fatos `13px #9A948A` (separados por ` · `). Direita: chevron. Linha inteira clicável → abre drawer ou navega.
5. **DetailDrawer** — painel deslizante da direita, `width:min(440px,100vw)`, fundo `#FCFBF9`, entra com `transform: translateX(100%)→0` em `.3s cubic-bezier(.22,1,.36,1)` sobre overlay escuro. Estrutura: header (farol + kicker uppercase + título + subtítulo + botão fechar `X`), corpo rolável (badges → bloco de linhas label/valor em card branco → bloco opcional "Sugestão da IA"), rodapé fixo com botões (secundário contornado + primário laranja). Conteúdo varia por tipo (tarefa, exceção, empresa, documento, prazo, solicitação).
6. **PageHeader** — H1 + subtítulo curto à esquerda; **uma** ação primária laranja à direita (quando houver). Ex.: "Nova empresa", "Nova solicitação", "Solicitar documento".
7. **EmptyState** — centralizado em card: ícone num chip arredondado (cor conforme contexto), título `17–19px/700`, frase amigável, e botão de ação. Ex. (Exceções): chip verde + "Nenhuma exceção pendente" + "Tudo em dia ✅".
8. **AppShell** —
   - **Sidebar** (desktop, `≥900px`): largura `248px`, fundo branco, borda direita `#EFEAE0`, `position:sticky`. Logo no topo (quadrado laranja `36px` com ponto branco + wordmark). Máx. **7 itens** (ícone + rótulo; badges de contagem nas filas). Item ativo: `background:#FFF3E0`, texto `#1A1A1A`, ícone `#FFA500`, e uma barra-acento laranja `4px` colada à esquerda. Inativo: texto `#5C574E`, ícone `#A39C90`. "Configurações" fica no rodapé, separado por borda superior.
   - **Topbar**: busca (desktop) ou logo + hambúrguer (mobile), sino de notificações com ponto vermelho, e menu do usuário (avatar `32px` preto + iniciais "AC" + nome). `position:sticky; backdrop-filter:blur(10px)`.
   - **Mobile (`<900px`)**: sidebar some; hambúrguer abre uma **gaveta** (slide-over da esquerda, `268px`) com os mesmos itens, sobre overlay. Detectar via `window.innerWidth` / listener de resize.

### Ícones
Traço fino (`stroke-width:1.7`), `stroke:currentColor`, `stroke-linecap/linejoin:round`, viewBox `0 0 24 24`. No protótipo são SVGs inline; **substitua pelo seu set** (Lucide equivalentes: home, building-2, list-checks, alert-triangle, file-text, calendar-clock, send, bell, chevron-right, x, search, plus, upload, download, sparkles, check, menu, settings, refresh-cw). O selo de IA usa `sparkles` + a palavra "IA ✨".

---

## Telas / Views

> Em todas as telas de dados, há um controle flutuante de **estados** (Normal / Vazio / Carregando / Erro) só para revisão — **não faz parte do produto**, não recrie.

### 1. Login
Tela mais simples; momento de marca. Fundo `radial-gradient(120% 90% at 50% -10%, #FFF6E8 0%, #FCFBF9 55%)`. Centralizado, `max-width:392px`: logo (quadrado laranja + ponto branco) + wordmark "Hub Contábil"; card branco (`radius:24px`) com H1 "Bom te ver de novo 👋", subtítulo "Acesse o painel do seu escritório.", campos **E-mail** e **Senha** (inputs `radius:14px`, fundo `#FCFBF9`, foco com ring laranja `rgba(255,165,0,.14)`), botão laranja **Entrar** (largura total), link "Esqueci minha senha".

### 2. Início (Dashboard)
Responde "o que precisa da minha atenção hoje?". Saudação ("Bom dia, Ana ☀️") + linha-resumo. **Grade de até 6 StatCards** (`grid-template-columns: repeat(auto-fit, minmax(220px,1fr))`): Tarefas abertas (18), Exceções (3), Prazos em atenção (5), Empresas (42), Documentos (127), Solicitações (7) — cada um clicável → navega. Abaixo, **"Painel geral das empresas"**: uma linha por empresa (farol + nome + `fato1 · fato2`) + "Ver todas →". Números antes de tabelas. Mobile-friendly.

### 3. Empresas (lista)
PageHeader "Empresas" + subtítulo de contagem + ação primária **"Nova empresa"**. Filtros como chips de "visão padrão" recolhidos (Todas · 42 / Precisam de atenção · 3 / Em dia · 38) — o primeiro ativo (preto). Lista: `farol + nome + (regime · cidade)` + chevron. Linha → tela de detalhe.

### 4. Empresa (detalhe)
Botão voltar "← Empresas". Cabeçalho: farol `16px` + nome (H1) + StatusBadge + CNPJ; ação primária **"Solicitar documento"**. Abas (scroll horizontal no mobile): **Dados, Contatos, Tarefas, Documentos, Prazos, Solicitações** (aba ativa: texto `#1A1A1A` + borda inferior `2.5px #FFA500`; inativa `#9A948A`). 
- *Dados*: 2 colunas — card de pares label/valor (CNPJ, Regime, Cidade, Abertura, Inscrição estadual, Responsável) + card "Resumo" (lista de itens com farol).
- *Contatos*: linhas com avatar de iniciais + nome + papel · contato.
- *Tarefas/Documentos/Prazos*: DataLists filtradas; documentos mostram selo "IA ✨".
- *Solicitações*: EmptyState verde "Nenhuma solicitação pendente / Tudo em dia ✅".

### 5. Tarefas (kanban)
Visão padrão "Minhas tarefas de hoje". 4 colunas (`auto-fit, minmax(248px,1fr)`): **Pendentes, Em andamento, Concluídas, Canceladas**. Cabeçalho de coluna: ponto neutro (Concluídas usa verde) + nome + contagem. Cards: farol + título + empresa; rodapé com prazo (colorido por status) + chip de departamento. Clicar no card → drawer com detalhes e ações **"Concluir"** / **"Concluir e repassar"** (concluídas/canceladas mostram "Reabrir tarefa").

### 6. Exceções
Visão padrão "Exceções abertas". Lista (farol amarelo + título + `empresa · há X tempo`). Clique → drawer com: badge "Precisa de atenção", linhas de contexto, e bloco **"Sugestão da IA"** (fundo `#FFF9F0`, borda `#F6E4C8`, ícone sparkles dourado) com texto pré-preenchido em pt-BR claro; botões **"Resolver"** / **"Ignorar"**. Vazio: "Nenhuma exceção pendente — tudo em dia ✅".

### 7. Documentos
Cabeçalho com empresa + competência (ex.: "Padaria Pão Quente LTDA · competência 2026-06"). Zona de **upload em massa** (arrastar-e-soltar, borda tracejada `2px dashed #E5DECF`) + botão **"Triagem por IA"** (sparkles). Lista de arquivos: ícone de arquivo + nome + `tipo · competência · departamento`; arquivos classificados pela IA ganham selo **"classificado por IA ✨"** (chip `#FFF9F0`/`#B57E13`). Clique → drawer com info + (se IA) ação **"Corrigir"** além de "Confirmar".

### 8. Página pública do cliente (rota `/s/{token}`, SEM login)
Tela mais simples e acolhedora, para leigo no celular. Mesmo fundo radial do login. Logo do escritório ("SA" + "Silva & Associados") numa pílula; card (`radius:28px`): ícone de upload num chip `#FFF3E0`, frase "A [Escritório] precisa de um documento seu", qual documento em negrito, **dropzone** ("Arraste o arquivo aqui / ou toque para escolher do seu celular"), **uma** ação laranja "Enviar arquivo", e linha de confiança "🔒 Conexão segura…". Sem navegação do app.

### Secundárias (mesmo sistema)
- **Prazos**: lista de certidões/licenças (CND Federal, Alvará, Certificado Digital A1, CND Estadual, Licença Sanitária) — farol + tipo + empresa + situação colorida.
- **Solicitações**: lista de documentos pedidos ao cliente, com badge de status (Aguardando cliente / Recebida / Sem resposta) + ação primária "Nova solicitação".
- **Configurações**: lista de seções (Dados do escritório, Equipe, Integração com o sistema contábil, Regras de classificação CFOP, Notificações).

---

## Interações & comportamento
- **Navegação**: clicar num item da sidebar troca a tela (estado `screen`); statcards e linhas de lista navegam ou abrem drawer.
- **Drawer**: entra da direita com `translateX(100%)→0`, `.3s cubic-bezier(.22,1,.36,1)`; overlay `rgba(26,26,26,.42)` com fade `.2s`; fecha por overlay, botão X ou ação.
- **Hover**: StatCards e cards de kanban sobem `translateY(-2px)` e ganham sombra; linhas de lista mudam fundo para `#FCFBF9`; inputs focam com ring laranja.
- **Carregando**: usar **skeletons** com shimmer (`linear-gradient(90deg,#F0ECE4 25%,#F7F4EE 37%,#F0ECE4 63%)`, `background-size:400px 100%`, animação de `background-position` 1.4s) — **nunca spinners**.
- **Erro**: card centralizado com ícone vermelho, título "Não foi possível carregar", frase pt-BR e botão **"Tentar de novo"**.
- **Vazio**: EmptyState desenhado (frase amigável + ação + ícone).
- **Responsivo**: `<900px` → sidebar vira gaveta; paddings e títulos usam `clamp()`; grids usam `auto-fit/minmax` (reflui sozinho); abas do detalhe rolam horizontalmente.

## State management (mínimo necessário)
- `screen`: tela atual (`login | publica | dashboard | empresas | empresa | tarefas | excecoes | documentos | prazos | solicitacoes | config`).
- `company`: id da empresa selecionada (para o detalhe).
- `tab`: aba ativa no detalhe da empresa.
- `drawer`: objeto do conteúdo do drawer aberto (ou null).
- `mobileNav`: gaveta mobile aberta.
- `isMobile`: derivado de `window.innerWidth < 900` (listener de resize).
- Dados: virão da sua API. No protótipo são fixos (ver próxima seção como exemplo de microcópia/formatos).

## Microcópia & formatos (pt-BR, sem jargão)
- CNPJ formatado: `00.000.000/0000-00`. Competência: `2026-06`.
- Datas humanas: "Vence em 5 dias", "Vencida há 1 dia", "Concluída hoje", "há 2 horas".
- Regimes: Simples Nacional, Lucro Presumido, Lucro Real. Departamentos: Fiscal, Contábil, DP, Compliance.
- Tipos de prazo: CND Federal, CND Estadual, Alvará de Funcionamento, Certificado Digital A1, Licença Sanitária, SPED Fiscal.
- Evite na tela: "JSONB", "payload", "fila", "tenant" e similares.

## Assets
- **Fonte**: Plus Jakarta Sans (Google Fonts).
- **Ícones**: desenhados como SVG inline no protótipo — substitua pelo seu set (mapeamento Lucide na seção Ícones). Não há imagens/logos externos; o logo é um quadrado laranja com um ponto branco (a "luz" do farol) + wordmark. Emojis usados intencionalmente na microcópia (👋 ☀️ ✅ ✨ 🔒).

## Arquivos
- `Hub Contábil.dc.html` — protótipo completo, todas as telas e estados. Abra no navegador para ver/interagir. É a referência visual; recrie no seu codebase.
