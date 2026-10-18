# Plantão Fácil v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evoluir o Plantão Fácil, na branch `v2`, para a biblioteca de prescrições descrita na spec. Isso inclui:
- visual e navegação novos;
- tela de prescrição clara;
- calculadoras separadas das escalas;
- importação só pelo chat;
- arquivo `biblioteca.js` para o pendrive;
- migração dos dados da v1.

**Architecture:** Mantém-se a estrutura atual: `dominio/` em TS puro e testado, `db/` com Dexie, `stores/` com Pinia, e `views/` + `components/` em Vue. O modelo muda em dois passos, cada um com uma versão nova do Dexie que migra os dados do aparelho:
- versão 2: prescrições;
- versão 3: calculadoras e grupos.

A leitura de arquivos aceita os backups da v1 e os converte com as mesmas funções de migração. O pendrive passa a usar um IndexedDB só em memória (`fake-indexeddb`), carregado a partir de `window.BIBLIOTECA`, e assim nada fica gravado no PC.

**Tech Stack:** Vue 3.5 (`<script setup>`), TypeScript 6, Vite 8, Tailwind v4, shadcn-vue (Reka UI), `@lucide/vue`, Pinia, Vue Router (hash), Dexie 4, valibot, mathjs (instância mínima), pdf-lib, vite-plugin-pwa, vite-plugin-singlefile e Vitest + jsdom + fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-10-18-plantao-facil-v2-design.md`. Os mockups estão em `docs/superpowers/mockups/`.

## Global Constraints

- **Interface:** toda em pt-BR. No código, os nomes de domínio ficam em português.
- **Conteúdo clínico:** nenhum é inventado. Testes e exemplos usam só dados fictícios óbvios ("Medicamento Teste A", "Situação Teste A").
- **Dados de paciente:** nenhum é salvo. Peso e entradas das calculadoras ficam só no estado do componente.
- **Recursos externos:** nenhum em tempo de execução. Fonte e ícones vão embutidos.
- **Toque:** alvos de pelo menos 44 px (`size="touch"`/`"icon-touch"` nos botões).
- **Cor de destaque:**
  - opções: `azul #2f5bea`, `coral #ef5b5b`, `verde #0f9d8a`, `violeta #6d4fe0`;
  - **padrão: `verde`**.
- **Números exibidos:** vírgula decimal, sem separador de milhar e sem zeros sobrando (`formatarNumero` de `src/dominio/dose/numeros.ts`).
- **Pendrive:** não grava nada no PC (nem IndexedDB persistente, nem `localStorage`).
- **Revisão de importação:** cada prescrição importada passa pela revisão. Não existe "aprovar tudo" sem abrir.
- **Item "OU":** nenhuma opção vem marcada, e o Copiar fica bloqueado até a escolha.
- **Fases (regra do `CLAUDE.md`):**
  - ao fim de cada fase, parar, explicar como testar e esperar a aprovação do usuário;
  - commit ao fim de cada tarefa;
  - atualizar o `CLAUDE.md` no fim de cada fase.
- **Documentação:** consultar a documentação atual (Dexie `version().upgrade`, vite-plugin-singlefile, fontsource) antes de usar uma API, em vez de confiar na memória.
- **Publicação:** nada é publicado em `main` nem no GitHub Pages sem pedido explícito do usuário.
- **Verificação de cada tarefa:**
  - `npm test` tem que passar;
  - `npm run typecheck` tem que passar, exceto nas janelas declaradas nas Fases 2 e 3.
- **Telas:** toda tarefa de tela termina conferida no preview (`.claude/launch.json` → `dev`) em 375 px e em 1280 px de largura.
- **Nomes no código:** continuam `Categoria`, `categoriaId` e `escopo`, para não quebrar backups nem o código existente. Na **interface** aparece "Grupo".

## Review Focus

1. **Registro antigo sem campos novos no Dexie.** Prescrições da v1 sem `receita`, `condicoes`, `opcoesEquivalentes` ou `condicaoId`, e categorias sem `icone`, precisam migrar sem erro. Teste na Tarefa 5.
2. **"OU" sem escolha num item escondido.** Se o item pertence a uma condição **não marcada**, ele não pode bloquear o Copiar. Teste na Tarefa 6.
3. **Número do item na mensagem "Escolha uma opção no item N".** O número é o da lista **visível**, renumerada. Não é a posição no cadastro. Teste na Tarefa 6.
4. **`biblioteca.js` ausente ou com erro de sintaxe no pendrive.** O app abre a tela de instruções e não fica em branco. Teste na Tarefa 20.
5. **Peso digitado inválido** (vazio, `0`, `abc`, `70,5`). Nos três primeiros casos as doses mostram a regra. No último, calcula com 70,5. Teste na Tarefa 10.

---

## Fase 1 — Visual novo e navegação

### Task 1: Tema, fonte e cor de destaque

**Files:**
- Modify: `src/style.css` (tokens claro/escuro, fonte, raio)
- Create: `src/assets/fontes/plus-jakarta-sans-latin-wght.woff2`, `src/assets/fontes/LICENSE-PlusJakartaSans.txt`
- Delete: `src/assets/fontes/inter-latin-wght.woff2`, `src/assets/fontes/LICENSE-Inter.txt`
- Create: `src/dominio/aparencia/destaque.ts`, `src/dominio/aparencia/destaque.spec.ts`
- Modify: `src/dominio/tipos/outros.ts` (`Configuracoes.corDestaque`), `src/stores/configuracoes.ts`, `src/stores/stores.spec.ts`, `index.html` (script anti-piscar também aplica o destaque)

**Interfaces:**
- Produces:
  - `type CorDestaque = 'azul' | 'coral' | 'verde' | 'violeta'`
  - `const CORES_DESTAQUE: Record<CorDestaque, { rotulo: string; hex: string }>`
  - `const COR_DESTAQUE_PADRAO: CorDestaque = 'verde'`
  - `aplicarDestaque(cor: CorDestaque): void`, que define `document.documentElement.dataset.destaque`
  - store `definirCorDestaque(cor: CorDestaque): Promise<void>`

- [ ] **Step 1: Write the failing tests**

```ts
// destaque.spec.ts
expect(COR_DESTAQUE_PADRAO).toBe('verde')
expect(CORES_DESTAQUE.verde.hex).toBe('#0f9d8a')
expect(CORES_DESTAQUE.azul.hex).toBe('#2f5bea')
expect(CORES_DESTAQUE.coral.hex).toBe('#ef5b5b')
expect(CORES_DESTAQUE.violeta.hex).toBe('#6d4fe0')
aplicarDestaque('coral'); expect(document.documentElement.dataset.destaque).toBe('coral')
// stores.spec.ts
it('configurações sem corDestaque salva carregam com verde', ...) // db.configuracoes.put({ id:'local', tema:'claro', ... sem corDestaque }) → store.config.corDestaque === 'verde'
```

- [ ] **Step 2:** Rode `npx vitest run src/dominio/aparencia src/stores`. Esperado: FALHA.
- [ ] **Step 3: Implementar.**
  - **Destaque:** `destaque.ts` com os quatro valores da seção Global Constraints. `aplicarDestaque` também grava em `localStorage['plantao-facil:destaque']`, dentro de `try`, e **não grava** quando `MODO_PENDRIVE`.
  - **Store:** acrescentar `corDestaque` em `padrao()`, `carregar()` (chama `aplicarDestaque`) e `definirCorDestaque`.
  - **Tokens claros:** `--background #eef1f6`, `--card #ffffff`, `--foreground #151a2d`, `--muted-foreground #7b8297`, `--border #e4e8f0`.
  - **Tokens escuros** (escolha do builder, a manter coerente): `--background #0f1220`, `--card #1a1e2e`, `--foreground #eef1f6`, `--muted-foreground #8a91a6`, `--border #2a3044`.
  - **Destaque no CSS:** `--primary` vem de `:root[data-destaque=…]`, com `--primary-foreground #ffffff`.
  - **Raio:** `--radius: 1.375rem`.
  - **Tons de alerta:**
    - crítico: fundo `#fdecec`, texto `#9b1c1c`;
    - atenção: fundo `#fff4dc`, texto `#7a4d00`;
    - observações: fundo `#fff8e1`.
  - **Fonte:**
    - baixar a Plus Jakarta Sans do pacote `@fontsource-variable/plus-jakarta-sans` (dev dependency);
    - copiar só o arquivo `latin-wght-normal.woff2` e a licença OFL para `src/assets/fontes/`;
    - declarar um `@font-face` como o do Inter atual e remover o Inter.
- [ ] **Step 4:** Rode `npm test && npm run typecheck`. Esperado: PASSA.
- [ ] **Step 5:** Confira no preview. O fundo deve estar cinza-azulado, os cartões brancos e os botões primários em verde-água. Teste também o tema escuro.
- [ ] **Step 6: Commit** `git commit -m "v2: tema novo, Plus Jakarta Sans e cor de destaque"`

### Task 2: Layout do app (topo com áreas, busca, menu) e remoção dos recentes

**Files:**
- Modify: `src/components/layout/AppLayout.vue` (reescrever), `src/components/layout/navegacao.ts`
- Delete: `src/stores/recentes.ts` e os usos dele (`PrescricaoView.vue`, `CalculadoraView.vue`, `PrescricoesView.vue`, `CalculadorasView.vue`, `ListaBiblioteca.vue`)
- Test: `src/components/layout/navegacao.spec.ts`

**Interfaces:**
- Produces:
  - `AREAS: { rota: string; rotulo: string; icone: Component }[]`. Na Fase 1 vale `[Prescrições /prescricoes, Calculadoras /calculadoras]`. A Fase 3 acrescenta `Escalas /escalas`.
  - `MENU: ItemNavegacao[]`, nesta ordem: Grupos `/categorias`, Importar PDF `/importar`, Backup `/backup`, Lixeira `/lixeira`, Ajustes `/ajustes`.
  - A busca fica na query `?q=` da rota da área atual.

- [ ] **Step 1: Teste** em `navegacao.spec.ts`:
  - `AREAS.map(a => a.rota)` é igual a `['/prescricoes','/calculadoras']`;
  - `MENU.map(m => m.rotulo)` é igual a `['Grupos','Importar PDF','Backup','Lixeira','Ajustes']`.
- [ ] **Step 2:** Rode o teste. Esperado: FALHA.
- [ ] **Step 3: Reescrever o `AppLayout.vue`** conforme o mockup `visual.html`:
  - **Topo:** logo em círculo com a cor de destaque, pílulas das áreas (a ativa em `--foreground` com texto branco), campo de busca em pílula e botão redondo de menu (`DropdownMenu` com `MENU`).
  - **No celular:** logo + busca + menu numa linha, e as pílulas das áreas na linha de baixo. A navegação inferior sai.
  - **Rotas de edição** (`/nova`, `/editar`): o topo mostra só o botão voltar e o título (`route.meta.titulo`).
  - **Recentes:** remover tudo que se refere a eles.
- [ ] **Step 4:** Rode `npm test && npm run typecheck`. Esperado: PASSA.
- [ ] **Step 5:** Confira no preview em 375 px e 1280 px. Digitar na busca atualiza `?q=`.
- [ ] **Step 6: Commit** `git commit -m "v2: topo com áreas em pílula, busca e menu; remove recentes"`

### Task 3: Painel da biblioteca (lateral de grupos com ícones, favoritos, cartões)

**Files:**
- Create: `src/dominio/biblioteca/lateral.ts`, `src/dominio/biblioteca/lateral.spec.ts`
- Create: `src/components/biblioteca/PainelBiblioteca.vue`, `src/components/biblioteca/LateralGrupos.vue`, `src/components/biblioteca/CartaoItem.vue`
- Modify: `src/views/PrescricoesView.vue`, `src/views/CalculadorasView.vue`
- Delete: `src/components/comum/ListaBiblioteca.vue`, `src/components/comum/LinhaItem.vue`
- Modify (textos): `src/views/CategoriasView.vue` e todos os rótulos "Categoria"/"Sem categoria" → "Grupo"/"Sem grupo" (`ROTULO_SEM_CATEGORIA = 'Sem grupo'`)

**Interfaces:**
- Produces:
```ts
export type ChaveLateral = 'favoritos' | 'todas' | 'sem-grupo' | UUID
export interface EntradaLateral { chave: ChaveLateral; rotulo: string; icone: string | null; quantidade: number }
export function montarLateral<T extends { categoriaId: UUID | null; favorito: boolean }>(itens: T[], grupos: Categoria[]): EntradaLateral[]
export function filtrarPorChave<T extends { categoriaId: UUID | null; favorito: boolean }>(itens: T[], chave: ChaveLateral): T[]
```
- O `PainelBiblioteca` recebe as props `itens`, `grupos`, `rotaBase`, `rotuloNovo`, `textoVazio` e `filtrar(itens, termo)`. A chave selecionada fica em `?grupo=`, com padrão `todas`.

- [ ] **Step 1: Testes** (`lateral.spec.ts`, usando `categoriaTeste`/`prescricaoTeste` existentes):
  - **Ordem das entradas:** `montarLateral` devolve `favoritos` (rótulo "Favoritos", ícone `'estrela'`), depois `todas` ("Todas"), depois os grupos na `ordem` cadastrada e por fim `sem-grupo` ("Sem grupo").
  - **`sem-grupo`** só aparece se houver item sem grupo.
  - **`favoritos`** aparece mesmo com quantidade 0.
  - **Quantidade:** só conta itens ativos (a lista recebida já vem filtrada). Um grupo com 0 itens aparece com `quantidade: 0`.
  - **`filtrarPorChave`:** com `'favoritos'` devolve só `favorito: true`, e com `'sem-grupo'` devolve só `categoriaId === null`.
- [ ] **Step 2:** Rode o teste. Esperado: FALHA.
- [ ] **Step 3: Implementar.**
  - **`lateral.ts`.**
  - **`PainelBiblioteca`** conforme `tela-inicial.html`/`visual.html`:
    - no PC (`md+`), grade `220px 1fr`: lateral em cartão branco com as entradas (ícone num quadrado arredondado, rótulo, contagem; a ativa fica tingida com a cor de destaque) e, à direita, o título grande do grupo, a contagem e uma grade de 2 colunas de `CartaoItem`;
    - no celular, as entradas viram uma fileira de pílulas com rolagem horizontal, e os cartões ficam em 1 coluna.
  - **Busca:** com `?q=` preenchido, ignora o grupo selecionado e mostra os resultados de todas as entradas, com o título "Resultados".
  - **`CartaoItem`:** título; etiquetas "N condições" e "importada — revisar" (quando `revisada === false`); e uma linha de meta ("Receita de alta" quando `receita` não está vazia).
  - **Botão** "Nova …" no topo da lista.
- [ ] **Step 4:** Rode `npm test && npm run typecheck`. Esperado: PASSA.
- [ ] **Step 5:** Confira no preview. Clicar num grupo filtra a lista, os favoritos aparecem em "Favoritos" e a busca procura em todos os grupos.
- [ ] **Step 6:** Atualize o `CLAUDE.md`:
  - seção "Visual" substituída pela direção nova;
  - "Recentes" removidos;
  - "Grupos" na interface.
- [ ] **Step 7: Commit** `git commit -m "v2: painel com lateral de grupos, favoritos e cartões"`

**🛑 Fim da Fase 1.** Parar e explicar ao usuário como testar: `npm run dev`, abrir em 375 px e 1280 px, trocar grupos, buscar, favoritar e mudar o tema. Esperar a aprovação.

---

## Fase 2 — Prescrição v2

> **Janela de typecheck:** da Tarefa 4 até o fim da Tarefa 8, `npm run typecheck` pode falhar **somente** em `src/views/PrescricaoView.vue`, `src/components/prescricoes/FormularioPrescricao.vue`, `src/views/PrescricaoEditorView.vue` e `src/views/ImportarView.vue`. O `npm test` passa em todas as tarefas. O `ImportarView.vue` volta a compilar na Tarefa 8, com uma adaptação mínima, e é reescrito na Fase 4.

### Task 4: Modelo de prescrição v2 e migração pura v1 → v2

**Files:**
- Create: `src/dominio/migracao/v1/tipos.ts` (cópia congelada de `Prescricao`, `ItemPrescricao`, `Alternativa`, `RegraDose`, `Calculadora*` e `ArquivoBackup` da v1, com sufixo `V1`)
- Create: `src/dominio/migracao/v1/esquema.ts` (o `src/dominio/backup/esquema.ts` atual movido e renomeado para `esquemaArquivoBackupV1`)
- Create: `src/dominio/migracao/v1/regra.ts`, `src/dominio/migracao/prescricao.ts`, `src/dominio/migracao/prescricao.spec.ts`
- Modify: `src/dominio/tipos/prescricao.ts`, `src/dominio/prescricoes/{editar,busca,condicoes}.ts` e os testes deles, `src/dominio/prescricoes/fixtures.spec-helper.ts`, `src/dominio/ia/rascunhos.ts` e `ia.spec.ts`
- Delete: `src/dominio/dose/{calculo,marcadores,prescricaoCalculada,validarRegra}.ts` e os testes deles, `src/dominio/tipos/dose.ts`, `src/components/prescricoes/{EditorRegraDose,ResultadoDose}.vue`. **Ficam** `numeros.ts` e `peso.ts`.

**Interfaces:**
- Produces (em `tipos/prescricao.ts`):
```ts
export interface OpcaoItem { id: UUID; texto: string; motivo: string }
/** opcoes.length === 1: item simples; ≥ 2: item "OU" (nenhuma vem escolhida). */
export interface ItemPrescricao { id: UUID; condicaoId: UUID | null; opcoes: OpcaoItem[] }
// Prescricao: remove nada além do que muda nos itens; acrescenta `calculadoraIds: UUID[]`.
```
- Produces (em `migracao/`):
```ts
export function descreverRegraV1(r: RegraDoseV1): string
export function migrarPrescricaoV1(p: PrescricaoV1, gerarId?: () => UUID): Prescricao
```
- O `criarRascunhos` continua lendo a resposta da IA da v1, mas monta `opcoes = [{texto, motivo:''}, ...alternativas]`. Esta é uma adaptação temporária até a Fase 4.

- [ ] **Step 1: Testes** (`prescricao.spec.ts`, regras com `concentracao`/`pesoLimite` nulos salvo quando indicado):
```ts
descreverRegraV1({ dosePorKg: 10, unidade: 'mg', baseDoseKg: 'por_tomada', tomadasPorDia: null, doseMaximaPorTomada: 500, doseMaximaDiaria: null, pesoLimite: null, concentracao: null, ...arred })
  // → '10 mg/kg, máx. 500 mg/tomada'
descreverRegraV1({ dosePorKg: 30, unidade: 'mg', baseDoseKg: 'por_dia', tomadasPorDia: 3, doseMaximaPorTomada: null, doseMaximaDiaria: 1500, pesoLimite: { acimaDeKg: 40, doseFixa: 400 }, concentracao: { quantidade: 100, volumeMl: 5 }, ...arred })
  // → '30 mg/kg/dia, 3 tomadas/dia, máx. 1500 mg/dia, acima de 40 kg: 400 mg, concentração 100 mg em 5 mL'
// item com regra: texto 'Medicamento Teste A {dose} VO ({volume}) {tomadas}', tomadasPorDia 3
//   → opcoes[0].texto === 'Medicamento Teste A [<descrição>] VO ([volume]) de 8h em 8h'
//     revisada === false; duvidasImportacao contém 'Migrada da versão anterior: o item 1 tinha cálculo de dose automático, transformado em texto. Confira.'
// item com regra e sem marcador → descrição anexada ao fim: '… [<descrição>]'
// alternativas com opcoesEquivalentes: true → opcoes = [principal(motivo ''), ...alternativas(motivo dela)], mesmo item.id
// alternativas com opcoesEquivalentes ausente/false → opcoes[0].motivo === 'Padrão'
// item sem regra e sem alternativas → opcoes.length === 1, texto igual, revisada mantida
// registro sem receita/condicoes/condicaoId → receita '', condicoes [], condicaoId null
// alertas e seus itemId preservados; calculadoraIds === []
```
- [ ] **Step 2:** Rode `npx vitest run src/dominio/migracao`. Esperado: FALHA.
- [ ] **Step 3: Implementar.**
  - **`descreverRegraV1`:** junta as partes com `', '`, nesta ordem: dose/kg (`/dia` se `por_dia`), `N tomadas/dia`, `máx. X u/tomada`, `máx. X u/dia`, `acima de X kg: Y u` e `concentração X u em Y mL`. Os números passam por `formatarNumero`.
  - **Texto do item:** o primeiro `{dose}` ou `{dose_diaria}` vira `[<descrição>]`. Os seguintes viram `[dose]`/`[dose diária]`, e `{volume}` vira `[volume]`.
  - **`{tomadas}`:** vira o texto de intervalo da v1 para 1, 2, 3, 4, 6, 8, 12 ou 24 tomadas ("1 vez ao dia", "de 12h em 12h"…; copiar a tabela de `marcadores.ts` antes de apagá-lo para `v1/regra.ts`). Nos outros casos vira `[tomadas]`.
  - **Alternativas:** as que têm regra passam pela mesma conversão.
  - **Domínio da prescrição:** atualizar `editar.ts`:
    - `itemVazio` devolve uma opção vazia;
    - `opcaoVazia(gerarId)`;
    - sai tudo que era de regra de dose;
    - `validarPrescricao` exige título, grupo, ≥ 1 item e texto em toda opção;
    - `duplicarPrescricao` gera ids novos também para as opções e mantém os vínculos.
  - **`busca.ts`:** indexa o texto e o motivo de todas as opções.
- [ ] **Step 4:** Rode `npm test`. Esperado: PASSA.
- [ ] **Step 5: Commit** `git commit -m "v2: modelo de itens com opções e migração pura da v1"`

### Task 5: Dexie versão 2, leitura de backup v1/v2 e formato 2

**Files:**
- Modify: `src/db/banco.ts`, `src/db/backup.ts`, `src/dominio/backup/{backup,esquema}.ts`, `src/dominio/tipos/outros.ts`
- Create: `src/dominio/migracao/biblioteca.ts`
- Test: `src/db/migracao.spec.ts`, `src/dominio/backup/backup.spec.ts`

**Interfaces:**
- Produces:
  - `migrarBibliotecaV1(b: BibliotecaV1, gerarId?): Biblioteca`. Na Fase 2 só converte as prescrições; calculadoras e categorias passam como estão.
  - `ArquivoBackup.versaoFormato: 2`
  - `VERSAO_FORMATO_ATUAL = 2`
  - `lerBackup(texto)` aceita os formatos 1 e 2 e sempre devolve o formato 2.
- Consumes: `migrarPrescricaoV1` (Tarefa 4).

- [ ] **Step 1: Testes.**
  - **`migracao.spec.ts`:**
    - abrir um Dexie com o nome do teste e só `version(1)`;
    - gravar uma prescrição v1 crua com `{dose}`, regra e sem `receita`/`condicoes`/`opcoesEquivalentes`, e uma categoria sem `icone`;
    - fechar e abrir com `criarBanco(nome)`;
    - esperar `itens[0].opcoes[0].texto` convertido, `revisada === false` e a categoria intacta.
  - **`backup.spec.ts`:**
    - um arquivo `versaoFormato: 1` válido é lido como formato 2, com as prescrições convertidas;
    - `versaoFormato: 3` dá o erro "Este backup foi feito numa versão mais nova do app. Atualize o app antes de importar.";
    - `montarBackup(...).versaoFormato === 2`.
- [ ] **Step 2:** Rode os testes. Esperado: FALHA.
- [ ] **Step 3: Implementar.**
  - **Dexie:** `version(2).stores(<iguais>).upgrade(tx => tx.table('prescricoes').toCollection().modify(...))`, substituindo cada registro por `migrarPrescricaoV1(registro)`. Use `modify` com troca do objeto inteiro e confira na documentação atual do Dexie como fazer isso.
  - **`esquema.ts` v2:** os itens passam a ser `opcoes` (`v.array(...)` com `minLength(1)`) e entra `calculadoraIds`.
  - **`lerBackup`:** com o formato 1, valida com `esquemaArquivoBackupV1` e migra.
- [ ] **Step 4:** Rode `npm test`. Esperado: PASSA.
- [ ] **Step 5: Commit** `git commit -m "v2: Dexie v2 migra prescrições; backup lê v1 e grava formato 2"`

### Task 6: Visibilidade, cópia e observações (domínio)

**Files:**
- Create: `src/dominio/prescricoes/copia.ts`, `copia.spec.ts`, `src/dominio/prescricoes/observacoes.ts`, `observacoes.spec.ts`

**Interfaces:**
- Produces:
```ts
export type EscolhasOu = Record<UUID, UUID> // itemId → opcaoId
export function itensVisiveis(p: Pick<Prescricao, 'itens' | 'condicoes'>, marcadas: CondicoesMarcadas): ItemPrescricao[]
export function montarCopiaPrescricao(p: Pick<Prescricao, 'itens' | 'condicoes'>, marcadas: CondicoesMarcadas, escolhas: EscolhasOu):
  { ok: true; texto: string } | { ok: false; erro: string }
export interface ParagrafoObservacao { rotulo: string | null; texto: string }
export function paragrafosObservacoes(texto: string): ParagrafoObservacao[]
```

- [ ] **Step 1: Testes.**
```ts
// itensVisiveis: "sempre" + itens das condições marcadas, na ordem de ordenarPorCondicao
// montarCopiaPrescricao, itens [A(sempre), B(cond X, OU b1|b2), C(sempre)]:
//   X desmarcada → ok, '1. A\n2. C' (B não bloqueia)
//   X marcada, sem escolha → { ok:false, erro:'Escolha uma opção no item 3.' } (B é o 3º visível: A, C, B)
//   X marcada, escolhas {B: b2} → '1. A\n2. C\n3. <texto b2>'
// texto com quebra de linha dentro da opção → vira espaço na cópia
// só itens condicionais e nada marcado → { ok:false, erro:'Marque uma condição para copiar.' }
// paragrafosObservacoes('Obs: um\nlinha dois\n\n#Bizu: dois') → [{rotulo:'Obs', texto:'um\nlinha dois'}, {rotulo:'#Bizu', texto:'dois'}]
// paragrafosObservacoes('Obs: a\nCuidados: b') → 2 parágrafos (linha que começa com rótulo abre parágrafo novo)
// paragrafosObservacoes('texto sem rótulo') → [{rotulo:null, texto:'texto sem rótulo'}]; '' → []
```
- [ ] **Step 2:** Rode. Esperado: FALHA.
- [ ] **Step 3: Implementar.**
  - **Rótulo:** é `^\s*(#?\s?[\p{L}][\p{L} ]{0,24}):\s*`, com a flag `u`.
  - **Parágrafo novo:** começa numa linha em branco ou numa linha com rótulo.
  - **Item "OU":** usa o texto da opção escolhida. Um item de opção única usa `opcoes[0]`.
- [ ] **Step 4:** Rode `npm test`. Esperado: PASSA.
- [ ] **Step 5: Commit** `git commit -m "v2: cópia com OU obrigatório e parágrafos de observações"`

### Task 7: Tela da prescrição nova

**Files:**
- Rewrite: `src/views/PrescricaoView.vue`
- Create em `src/components/prescricoes/`: `AlertasPrescricao.vue`, `SeletorCondicoes.vue`, `ListaItens.vue`, `ItemOu.vue`, `CaixaObservacoes.vue`, `CartaoReceita.vue`
- Modify: `src/components/prescricoes/CartaoAlerta.vue`

**Interfaces:**
- Consumes: `itensVisiveis`, `montarCopiaPrescricao`, `paragrafosObservacoes` (Tarefa 6), `copiarTexto` (`src/lib/areaTransferencia.ts`).

- [ ] **Step 1: Montar a tela** conforme `visual.html` (prescrição) e `alertas-ou.html`.
  - **Cabeçalho:**
    - voltar;
    - título grande;
    - grupo em pílula com ícone;
    - estrela de favorito;
    - etiqueta "importada — revisar" quando `revisada === false`, com o botão "Marcar como revisada";
    - Editar, Duplicar e Excluir num menu `⋯`.
  - **Abas em pílula:**
    - no PC: Prescrição | Calculadoras · N. A aba de calculadoras só aparece se `calculadoraIds.length > 0`, e o conteúdo dela vem na Tarefa 15.
    - no celular: Prescrição | Receita (só se `receita` não estiver vazia) | Calculadoras · N.
  - **Coluna principal**, na ordem:
    1. alertas da prescrição (`itemId === null`): vermelho para `critico`, âmbar para `atencao`, neutro para `informativo`;
    2. "O paciente tem…" com as condições em pílulas, que alternam com um toque e começam desmarcadas;
    3. `ListaItens` com a numeração visível;
    4. botão Copiar prescrição.
  - **Alerta de item:** etiqueta `⚠ <tipo>` ao lado do item e o texto completo numa linha tingida logo abaixo.
  - **`ItemOu`:** rótulo "Escolha uma", opções empilhadas com rádio e motivo à direita.
  - **Copiar com erro:** mostra a mensagem num toast e destaca o item que falta.
  - **Observações:** caixa âmbar no fim, um parágrafo por `ParagrafoObservacao`, com o rótulo em negrito.
  - **`CartaoReceita`:** texto em fonte mono com quebras preservadas e botão "Copiar receita", que copia o texto exatamente como está.
  - **Layout:**
    - `md+`: grade `1.55fr 1fr`, com a receita na coluna da direita alinhada ao topo da lista;
    - celular: receita na aba.
  - **Estado:** condições marcadas e escolhas "OU" ficam só no estado do componente e voltam ao padrão ao sair.
  - **Referência:** aparece pequena, ao fim.
- [ ] **Step 2:** Rode `npm test`. Esperado: PASSA.
- [ ] **Step 3: Conferir no preview** com uma prescrição fictícia criada no editor antigo ou migrada:
  - marcar uma condição mostra os itens dela, renumerados;
  - o "OU" bloqueia o Copiar até a escolha;
  - a receita fica ao lado no PC e em aba no celular.
- [ ] **Step 4: Commit** `git commit -m "v2: tela da prescrição com condições, OU, alertas, observações e receita lateral"`

### Task 8: Editor da prescrição novo

**Files:**
- Rewrite: `src/components/prescricoes/FormularioPrescricao.vue`
- Modify: `src/views/PrescricaoEditorView.vue`, `src/views/ImportarView.vue` (só o necessário para compilar com o modelo novo)

**Interfaces:**
- Consumes: `prescricaoVazia`, `itemVazio`, `opcaoVazia`, `validarPrescricao`, `removerItem`, `removerCondicao`, `moverItem` (Tarefa 4).

- [ ] **Step 1: Montar o editor** em cartões brancos, nesta ordem:
  1. Título, Grupo (`CampoSelect` + "Novo grupo"), Tags;
  2. Condições (adicionar, renomear, ↑/↓, remover);
  3. Itens. Cada item tem:
     - seletor "Condição" ("Sempre" ou uma das condições);
     - a lista de opções: a primeira é o texto do item, e o botão "+ opção OU" acrescenta outra com motivo opcional;
     - ↑/↓ dentro do grupo da condição;
     - remover;
  4. Alertas: tipo, gravidade, texto e "vale para" (prescrição inteira ou item N);
  5. Observações (textarea, com a dica "Comece cada parágrafo com o rótulo, ex.: Obs:");
  6. Receita de alta (textarea, fonte mono);
  7. Referência.
  - **Botões:** Salvar/Cancelar numa barra flutuante em pílula.
  - **Ao sair:** avisar quando houver alterações não salvas (`useAvisoSaida`).
  - **Erros:** os de `validarPrescricao` aparecem no topo.
- [ ] **Step 2:** Rode `npm test && npm run typecheck`. Esperado: **PASSA, sem exceções**, porque a janela da Fase 2 fecha aqui.
- [ ] **Step 3:** Confira no preview: criar uma prescrição com condição, item "OU", alerta de item, observações e receita; salvar; ver na tela.
- [ ] **Step 4:** Atualize o `CLAUDE.md`: modelo de itens com `opcoes`, regras de cópia, migração v1 e remoção da dose nos itens.
- [ ] **Step 5: Commit** `git commit -m "v2: editor da prescrição com opções OU, condições e receita"`

**🛑 Fim da Fase 2.** Parar e explicar ao usuário como testar:
- importar um backup antigo em Backup → Importar;
- conferir uma prescrição que tinha dose calculada (o texto mostra a regra e a prescrição fica "importada — revisar");
- marcar condições, escolher o "OU" e copiar;
- conferir a receita ao lado.

Esperar a aprovação.

---

## Fase 3 — Calculadoras e escalas

> **Janela de typecheck:** da Tarefa 9 até o fim da Tarefa 14, `npm run typecheck` pode falhar **somente** em `src/components/calculadoras/*` e `src/views/Calculadora*.vue`. O `npm test` passa em todas as tarefas.

### Task 9: Modelo v2 de calculadoras e escalas

**Files:**
- Modify: `src/dominio/tipos/calculadora.ts`, `src/dominio/tipos/base.ts` (`EscopoCategoria` passa a incluir `'escala'`), `src/dominio/calculadoras/editar.ts` e o teste dele

**Interfaces:**
- Produces:
```ts
export type AreaCalculadora = 'calculadora' | 'escala'
interface CalculadoraBase extends Entidade { area: AreaCalculadora; nome: string; categoriaId: UUID | null; descricao: string; referencia: string; favorito: boolean }
export interface RegraDosePeso { id: UUID; marcador: string; dosePorKg: number; unidade: string; concentracao: number | null /* unidade/mL */; doseMaxima: number | null; casasDecimais: number }
export interface LinhaDosePeso { id: UUID; texto: string; regras: RegraDosePeso[] }
export interface CalculadoraDosePeso extends CalculadoraBase { area: 'calculadora'; tipo: 'dose_peso'; linhas: LinhaDosePeso[] }
export type CampoFormula =
  | { id: UUID; tipo: 'numero'; variavel: string; rotulo: string; unidade: string; min: number | null; max: number | null }
  | { id: UUID; tipo: 'sim_nao'; variavel: string; rotulo: string; valorSim: number; valorNao: number }
export interface SaidaFormula { id: UUID; nome: string; expressao: string; unidade: string; casasDecimais: number; teto: number | null; piso: number | null; faixas: FaixaInterpretacao[] }
export interface CalculadoraFormula extends CalculadoraBase { tipo: 'formula'; campos: CampoFormula[]; saidas: SaidaFormula[] }
export interface CalculadoraPontos extends CalculadoraBase { area: 'escala'; tipo: 'pontos'; campos: CampoPontos[]; faixas: FaixaInterpretacao[] }
export type Calculadora = CalculadoraDosePeso | CalculadoraFormula | CalculadoraPontos
```
- Em `editar.ts`:
  - `calculadoraVazia(area, tipo, gerarId)`
  - `regraDosePesoVazia(marcador)`, com `casasDecimais: 1`, sem concentração e sem máximo
  - `linhaDosePesoVazia()`
  - `campoFormulaVazio(tipo)`, com `valorSim: 1` e `valorNao: 0`
  - `saidaVazia()`
  - `validarCalculadora(d, grupoExiste)`, que exige:
    - nome e grupo;
    - na `dose_peso`: ≥ 1 linha, todo marcador do texto com regra e toda regra usada;
    - na `formula`: ≥ 1 campo, ≥ 1 saída, variáveis únicas e válidas (`PADRAO_VARIAVEL`) e expressões aprovadas por `analisarExpressao`;
    - na `pontos`: as regras da v1.
- **Restrições:** `dose_peso` só existe com `area: 'calculadora'`, e `pontos` só com `area: 'escala'`.

- [ ] **Step 1: Testes** em `calculadoras.spec.ts`:
  - `validarCalculadora` de uma `dose_peso` com o texto `'Medicamento Teste A {inducao}'` e sem regra devolve `'A linha 1 usa {inducao}, que não tem regra.'`;
  - uma regra sem uso devolve `'A regra {manutencao} não é usada em nenhuma linha.'`;
  - variável repetida em `formula` devolve `'Variável repetida: peso.'`.
- [ ] **Step 2:** Rode. Esperado: FALHA.
- [ ] **Step 3:** Implemente os tipos e o `editar.ts`.
- [ ] **Step 4:** Rode `npm test`. Esperado: PASSA.
- [ ] **Step 5: Commit** `git commit -m "v2: modelo de calculadoras (dose por peso, fórmula) e escalas"`

### Task 10: Motor da calculadora de dose por peso

**Files:**
- Create: `src/dominio/calculadoras/dosePeso.ts`, `dosePeso.spec.ts`

**Interfaces:**
- Produces:
```ts
export type ParteLinha = { tipo: 'texto'; texto: string } | { tipo: 'dose'; texto: string; limitada: boolean }
export function calcularRegraDosePeso(r: RegraDosePeso, pesoKg: number | null): { texto: string; limitada: boolean }
export function montarLinhaDosePeso(l: LinhaDosePeso, pesoKg: number | null): ParteLinha[]
```
- Consumes: `lerPeso` (`src/dominio/dose/peso.ts`) na tela; `formatarNumero`, `limpar`.

- [ ] **Step 1: Testes** (marcador `inducao`, 1 mg/kg, casas 1):
  - sem peso → `'1 mg/kg'`;
  - com máximo 50 e sem peso → `'1 mg/kg (máx. 50 mg)'`;
  - 70 kg → `'70 mg'`, `limitada: false`;
  - 0,5 mg/kg com 70 kg → `'35 mg'`;
  - 70,5 kg com 1 mg/kg → `'70,5 mg'`;
  - máximo 50 com 70 kg → `'50 mg'`, `limitada: true`;
  - concentração 5 (mg/mL) com 70 kg → `'70 mg (14 mL)'`;
  - concentração 3 com 10 kg → volume 3,333 arredondado para 1 casa → `'10 mg (3,3 mL)'`;
  - `montarLinhaDosePeso` com `'Midazolam {inducao} na indução e {manutencao} na manutenção'` (1 e 0,5 mg/kg) e 70 kg → partes `['Midazolam ', dose '70 mg', ' na indução e ', dose '35 mg', ' na manutenção']`;
  - marcador sem regra fica como texto literal `{x}`;
  - peso inválido (`lerPeso('')`, `lerPeso('0')`, `lerPeso('abc')`) não dá `ok`, e a tela passa `null`, mostrando as regras. Acrescente esses casos em `peso.spec.ts` se ainda não existirem.
- [ ] **Step 2:** Rode. Esperado: FALHA.
- [ ] **Step 3: Implementar.**
  - **Dose:** `limpar(dosePorKg × peso)`, arredondada a `casasDecimais` (mais próximo). Depois vale `min(dose, doseMaxima)`, e `limitada` indica que o máximo foi aplicado.
  - **Volume:** dose / concentração, com 1 casa decimal (mais próximo).
  - **Marcadores:** regex `/\{([A-Za-z0-9_]+)\}/g`.
- [ ] **Step 4:** Rode `npm test`. Esperado: PASSA.
- [ ] **Step 5: Commit** `git commit -m "v2: motor da calculadora de dose por peso"`

### Task 11: Motor de fórmula com campos sim/não e várias saídas

**Files:**
- Modify: `src/dominio/calculadoras/formula.ts`, `calculadoras.spec.ts`

**Interfaces:**
- Produces:
```ts
export type ValoresFormula = Record<UUID, number | boolean | null> // campo.id → valor
export type ResultadoSaida =
  | { saidaId: UUID; ok: true; valor: number; texto: string; faixa: FaixaInterpretacao | undefined; avisos: string[] }
  | { saidaId: UUID; ok: false; erro: string }
export function calcularSaidas(c: CalculadoraFormula, valores: ValoresFormula): ResultadoSaida[]
```
- O `analisarExpressao` e a instância mathjs restrita ficam como estão. `calcularFormula` passa a ser interna, por saída, e mantém a ordem da v1: validar as entradas (mín./máx.), avaliar, arredondar as casas e aplicar teto/piso com aviso.

- [ ] **Step 1: Testes.**
  - **Noradrenalina (exemplo do usuário):** campos `vazao`, `conc` e `peso`; saída `vazao * conc / peso` com 2 casas. Com `{vazao:10, conc:64, peso:80}`, o texto é `'8 <unidade>'`.
  - **Campo sim/não:** `valorSim 2`, `valorNao 0`, saída `x + 1`. Com `true` dá `3`, com `false` dá `1`, e com `null` dá `{ ok:false, erro:'Preencha todos os campos.' }`.
  - **Duas saídas:** são calculadas de forma independente.
  - **Faixa:** a primeira que contém o valor vem em `faixa`.
- [ ] **Step 2:** Rode. Esperado: FALHA.
- [ ] **Step 3:** Implemente.
- [ ] **Step 4:** Rode `npm test`. Esperado: PASSA.
- [ ] **Step 5: Commit** `git commit -m "v2: fórmula com campos sim/não e várias saídas"`

### Task 12: Migração das calculadoras e grupos (Dexie v3 e backup)

**Files:**
- Create: `src/dominio/migracao/calculadoras.ts`, `calculadoras.spec.ts`
- Modify: `src/dominio/migracao/biblioteca.ts`, `src/db/banco.ts`, `src/dominio/backup/esquema.ts`, `src/db/migracao.spec.ts`, `src/stores/{calculadoras,categorias}.ts`

**Interfaces:**
- Produces:
  - `migrarCalculadoraV1(c: CalculadoraV1, gerarId?): Calculadora`
  - `migrarGruposV1(categorias: Categoria[], calculadorasV1: CalculadoraV1[], gerarId?): { categorias: Categoria[]; remapear: Map<UUID /*calcId*/, UUID | null> }`
  - O `migrarBibliotecaV1` passa a converter tudo.
- O store `categorias` ganha `deEscalas`. O `excluir` também zera `categoriaId` nas calculadoras de escopo `escala`.

- [ ] **Step 1: Testes.**
  - **Pontos:** uma calculadora `pontos` da v1 vira `area:'escala'`, `tipo:'pontos'`, com os mesmos campos e faixas.
  - **Fórmula:** uma `formula` vira `area:'calculadora'`, `tipo:'formula'`:
    - `campos` vêm das `entradas`, com `tipo:'numero'` e `min`/`max` preservados;
    - há uma saída `{ nome:'Resultado', expressao, unidade: unidadeResultado, casasDecimais, teto, piso, faixas: <faixas da v1> }`.
  - **Grupos:**
    - um grupo `calculadora` usado só por escalas muda para `escopo:'escala'`;
    - um usado pelas duas fica e ganha uma cópia `escala` (mesmo nome, ícone e ordem), e as escalas são remapeadas para a cópia;
    - um sem uso fica igual.
  - **Dexie v3:** abrir um banco com dados v1 executa as versões 2 e 3 em sequência.
- [ ] **Step 2:** Rode. Esperado: FALHA.
- [ ] **Step 3: Implementar.**
  - **Dexie:** `version(3).stores({ calculadoras: 'id, categoriaId, area, tipo, atualizadoEm', ... })` e um `upgrade` que lê `categorias` e `calculadoras` e grava os convertidos na mesma transação.
  - **Esquema v2 do arquivo:** passa a usar os tipos novos.
- [ ] **Step 4:** Rode `npm test`. Esperado: PASSA.
- [ ] **Step 5: Commit** `git commit -m "v2: migra calculadoras para calculadoras/escalas (Dexie v3 e backup)"`

### Task 13: Áreas Calculadoras e Escalas e telas de uso

**Files:**
- Modify: `src/components/layout/navegacao.ts` (`AREAS` ganha Escalas `/escalas`), `navegacao.spec.ts`, `src/router/index.ts` (rotas `/escalas`, `/escalas/nova`, `/escalas/:id`, `/escalas/:id/editar`), `src/views/CalculadorasView.vue`
- Create: `src/views/EscalasView.vue`, `src/components/calculadoras/UsoDosePeso.vue`, `UsoFormula.vue`
- Modify: `src/components/calculadoras/UsoCalculadora.vue` (vira um despachante por `tipo`), `src/views/CalculadoraView.vue` (atende as duas áreas pela rota)

- [ ] **Step 1:** Atualize os testes de `AREAS` (3 áreas) e de `rotaBloqueadaNoPenDrive` (`/escalas/nova` e `/escalas/:id/editar` bloqueadas). Rode. Esperado: FALHA.
- [ ] **Step 2: Implementar.**
  - **Painéis:** as duas áreas usam `PainelBiblioteca` com os grupos do escopo delas.
  - **`UsoDosePeso`:** campo grande "Peso (kg)" no topo, lido com `lerPeso`. Abaixo vêm as linhas, com as partes `dose` em negrito na cor de destaque, e um selo "limitada à dose máxima" quando for o caso. Peso inválido mostra a mensagem do `lerPeso` e mantém as regras à vista.
  - **`UsoFormula`:**
    - campos `numero` com `CampoNumero`;
    - campos `sim_nao` como pílulas Sim/Não, sem nenhuma marcada;
    - cada saída num cartão, com o valor grande e a faixa (texto, com a cor da gravidade).
  - **Uso de pontos:** o que já existe.
  - **Layout:** a regra da v1 continua (texto e botões na mesma linha, 2 colunas em `md+`).
  - **Copiar:** não existe nas calculadoras (regra da v1).
- [ ] **Step 3:** Rode `npm test`. Esperado: PASSA.
- [ ] **Step 4: Commit** `git commit -m "v2: áreas Calculadoras e Escalas com telas de uso novas"`

### Task 14: Editores de calculadora e de escala

**Files:**
- Create: `src/components/calculadoras/EditorDosePeso.vue`
- Modify: `src/components/calculadoras/EditorFormula.vue` (campos sim/não e várias saídas, cada uma com `EditorFaixasInterpretacao`), `src/views/CalculadoraEditorView.vue` (a criação pergunta o tipo conforme a área: Calculadora → "Doses por peso" | "Fórmula"; Escala → "Pontos" | "Fórmula")

- [ ] **Step 1: Montar os editores.**
  - **`EditorDosePeso`:**
    - lista de linhas (textarea, com a dica "use {nome} onde a dose deve aparecer");
    - para cada marcador encontrado no texto, um cartão de regra: dose/kg, unidade (sugestões `mg, mcg, g, mL, UI, mEq`), concentração opcional ("<unidade>/mL"), dose máxima opcional e casas decimais;
    - painel "Testar com peso", que usa `UsoDosePeso` e não salva nada.
  - **`EditorFormula`:**
    - campos (tipo número ou sim/não, rótulo, variável, unidade, mín./máx. ou valores do Sim e do Não);
    - saídas (nome, expressão, unidade, casas, teto/piso, faixas);
    - avisos ao vivo de `analisarExpressao` e `analisarFaixas`;
    - painel "Testar" com `UsoFormula`.
- [ ] **Step 2:** Rode `npm test && npm run typecheck`. Esperado: **PASSA, sem exceções**, porque a janela da Fase 3 fecha aqui.
- [ ] **Step 3: Conferir no preview:**
  - criar a calculadora de dose por peso com a linha de Midazolam fictícia "Medicamento Teste A {inducao} … {manutencao}" e testar 70 kg;
  - criar a calculadora de fórmula de vazão × concentração / peso;
  - criar uma escala de pontos e uma de fórmula com um campo sim/não.
- [ ] **Step 4: Commit** `git commit -m "v2: editores de dose por peso, fórmula e escalas"`

### Task 15: Ligar calculadoras e escalas às prescrições

**Files:**
- Modify: `src/components/prescricoes/FormularioPrescricao.vue` (seção "Calculadoras e escalas"), `src/views/PrescricaoView.vue` (aba Calculadoras), `src/dominio/prescricoes/editar.ts` (`validarPrescricao` ignora ids de calculadoras que não existem mais), `src/stores/calculadoras.ts` (`excluirPermanentemente` remove o id das `calculadoraIds` das prescrições)
- Test: `src/dominio/prescricoes/editar.spec.ts`, `src/stores/stores.spec.ts`

- [ ] **Step 1: Testes.**
  - Excluir de vez uma calculadora ligada remove o id dela de `calculadoraIds` na prescrição.
  - Mover uma calculadora para a lixeira **não** remove o vínculo, mas a aba não a mostra.
- [ ] **Step 2:** Rode. Esperado: FALHA.
- [ ] **Step 3: Implementar.**
  - **Editor:** seletor com busca de calculadoras e escalas, agrupado por área; a ordem da lista define a ordem na aba.
  - **Aba "Calculadoras · N":** cada item é um cartão recolhível, com nome e ícone do grupo, que embute o `UsoCalculadora`. A primeira já vem aberta. O link "Abrir" leva à página da calculadora.
- [ ] **Step 4:** Rode `npm test && npm run typecheck`. Esperado: PASSA.
- [ ] **Step 5:** Atualize o `CLAUDE.md` com a seção Calculadoras/Escalas v2.
- [ ] **Step 6: Commit** `git commit -m "v2: calculadoras e escalas ligadas às prescrições"`

**🛑 Fim da Fase 3.** Parar e explicar ao usuário como testar:
- conferir as calculadoras antigas migradas (as de pontos agora estão em Escalas);
- criar a de IOT e a de noradrenalina com dados fictícios;
- ligar uma delas a uma prescrição e abrir a aba.

Esperar a aprovação.

---

## Fase 4 — Importação só pelo chat

### Task 16: Remover a importação por API

**Files:**
- Delete: `src/dominio/ia/provedores.ts`, `src/lib/enviarParaIA.ts`, `src/components/ia/ConfiguracaoIA.vue`
- Modify: `src/dominio/ia/resposta.ts` (remover `JSON_SCHEMA_RESPOSTA` e `paraEsquemaGemini`), `src/dominio/ia/prompt.ts` (remover `montarPedido`), `ia.spec.ts`, `src/dominio/tipos/outros.ts` (`Configuracoes` sem `ia`; `IdProvedor` sai), `src/stores/configuracoes.ts`, `src/views/AjustesView.vue`, `src/views/ImportarView.vue` (remover o caminho da API)

- [ ] **Step 1:** Atualize os testes: em `stores.spec.ts`, uma configuração antiga com `ia: {...}` gravada carrega sem erro, e `config` não tem a chave `ia` depois de `salvar()`.
- [ ] **Step 2:** Rode. Esperado: FALHA.
- [ ] **Step 3:** Remova o código. `carregar()` descarta `ia` do objeto salvo antes de usar.
- [ ] **Step 4:** Rode `npm test && npm run typecheck`. Esperado: PASSA.
- [ ] **Step 5: Commit** `git commit -m "v2: remove importação por API e chaves de IA"`

### Task 17: Resposta e prompt v2 (grupos existentes e grupo novo; opções)

**Files:**
- Modify: `src/dominio/ia/{resposta,prompt,rascunhos}.ts`, `ia.spec.ts`

**Interfaces:**
- Produces:
```ts
// esquemaRespostaIA v2, por prescrição:
// { titulo, grupo: string, grupoNovo: boolean, tags: string[],
//   itens: { opcoes: { texto: string; motivo: string }[]; condicao: number }[],
//   condicoes: string[], alertas: { tipo, gravidade, texto, item }[],
//   receita, observacoes, referencia, duvidas: string[] }
// + duvidas gerais
export function montarPromptChat(trecho: Trecho | null, totalPaginas: number | undefined, grupos: string[]): string
export interface RascunhoImportado { chave: string; dados: DadosPrescricao; grupoSugerido: string; grupoNovo: string | null; lote: ... }
export function criarRascunhos(resposta: RespostaIA, grupos: Categoria[], gerarId?, lote?): RascunhoImportado[]
```

- [ ] **Step 1: Testes.**
  - **Prompt:** contém a linha `Grupos existentes: Grupo Teste A; Grupo Teste B`. Com uma lista vazia, contém `Grupos existentes: (nenhum)`.
  - **Grupo que bate com um existente** (sem diferenciar maiúsculas nem acentos): `categoriaId` desse grupo e `grupoNovo: null`.
  - **Grupo que não bate**, com qualquer valor de `grupoNovo`: `categoriaId: null` e `grupoNovo` com o nome sugerido, sem espaços nas pontas.
  - **Grupo vazio:** `categoriaId: null` e `grupoNovo: null`.
  - **Item com 2 opções** vira um item "OU". **Item com 0 opções** é descartado, com uma dúvida `'O item N veio sem texto e foi descartado.'`.
- [ ] **Step 2:** Rode. Esperado: FALHA.
- [ ] **Step 3: Implementar.** As regras do prompt mudam assim:
  - a regra 3 deixa de proibir categorias;
  - nova regra de grupo: "use exatamente um dos grupos existentes quando a prescrição couber nele; só se nenhum servir, sugira um nome curto de grupo novo e marque `grupoNovo: true`";
  - o formato dos itens passa a ser `opcoes`;
  - todas as outras regras da v1 continuam: só transcrever, nunca calcular, receita, observações com rótulos, condições, "OU" e espaços recolocados.
- [ ] **Step 4:** Rode `npm test`. Esperado: PASSA.
- [ ] **Step 5: Commit** `git commit -m "v2: prompt e resposta da IA com grupos existentes/novos e opções"`

### Task 18: Tela de importação e revisão

**Files:**
- Rewrite: `src/views/ImportarView.vue`, dividida em `src/components/importacao/{EtapaArquivo,ListaLotes,CartaoLote,RevisaoRascunhos,CartaoRascunho}.vue`

**Interfaces:**
- Consumes: `dividirEmLotes`, `dividirTrecho`, `nomeArquivoLote` (lotes), `recortarPaginas`/`contarPaginas` (`src/lib/pdf.ts`), `montarPromptChat`, `lerRespostaIA`, `criarRascunhos`, `encontrarDuplicatas`, `FormularioPrescricao`.

- [ ] **Step 1: Montar o fluxo.**
  1. **Arquivo:** escolher o PDF, o intervalo de páginas e a caixa obrigatória "o PDF não contém dados de pacientes".
  2. **Lotes:** um cartão por lote, com:
     - "Baixar PDF do lote";
     - "Copiar prompt", que já leva os grupos de prescrição ativos;
     - campo "Cole a resposta";
     - status (aguardando, ok com N prescrições, erro);
     - "Dividir em 2".
  3. **Revisão:** libera enquanto os lotes chegam.
     - Cada `CartaoRascunho` mostra o título, o lote/as páginas, as dúvidas, a possível duplicata e o **grupo**.
     - O grupo é um seletor com os existentes. Quando `grupoNovo` vem preenchido, aparece a opção marcada "Novo: <nome>" (editável).
     - Botões: Editar (abre o `FormularioPrescricao`), Descartar e Aprovar.
  - **Ao aprovar com "Novo":** cria o grupo (ícone `'prancheta'`) se ainda não existir um com o mesmo nome normalizado e salva a prescrição como `origem:'importada_ia'`, `revisada:false`.
  - **Dúvidas gerais:** ficam agrupadas por lote.
  - **Sair com pendentes:** pede confirmação.
- [ ] **Step 2:** Rode `npm test && npm run typecheck`. Esperado: PASSA.
- [ ] **Step 3: Conferir no preview** com um PDF fictício de 25 páginas:
  - aparecem 3 lotes (1–10, 10–20, 20–25);
  - colar uma resposta JSON fictícia com um grupo novo;
  - aprovar cria o grupo.
- [ ] **Step 4:** Atualize o `CLAUDE.md` (seção IA: só pelo chat e grupos novos).
- [ ] **Step 5: Commit** `git commit -m "v2: importação só pelo chat com revisão e grupo novo"`

**🛑 Fim da Fase 4.** Parar e explicar ao usuário como testar com um PDF real e a IA que ele usa. Esperar a aprovação.

---

## Fase 5 — Arquivo `biblioteca.js`, pendrive, ajustes

### Task 19: Exportar `biblioteca.js` e importar `.js`/`.json`

**Files:**
- Create: `src/dominio/backup/arquivoJs.ts`, `arquivoJs.spec.ts`
- Modify: `src/dominio/backup/backup.ts` (o formato 2 ganha `corDestaque: CorDestaque`), `esquema.ts`, `src/views/BackupView.vue` (vira "Exportar e importar")

**Interfaces:**
- Produces:
```ts
export const NOME_ARQUIVO_BIBLIOTECA = 'biblioteca.js'
export function serializarBibliotecaJs(arquivo: ArquivoBackup): string // 'window.BIBLIOTECA = ' + JSON.stringify(arquivo) + ';\n'
export function extrairJson(texto: string): string // remove o prefixo `window.BIBLIOTECA =` e o `;` final, se existirem
```
- O `lerBackup(texto)` passa por `extrairJson` antes do `JSON.parse`. Na leitura, `corDestaque` ausente vira `'verde'`.

- [ ] **Step 1: Testes.**
  - `lerBackup(serializarBibliotecaJs(x))` devolve um resultado igual a `x`.
  - Um `.json` puro continua sendo aceito.
  - `extrairJson('  window.BIBLIOTECA = {"a":1};\n')` dá `'{"a":1}'`.
  - Um arquivo v1 sem `corDestaque` é lido com `'verde'`.
- [ ] **Step 2:** Rode. Esperado: FALHA.
- [ ] **Step 3: Implementar.**
  - **Exportar:** "Baixar `biblioteca.js`" e, no Android, "Compartilhar". O texto da tela explica: "Copie este arquivo para o pendrive, na mesma pasta do `plantao-facil.html`, e importe-o nos outros aparelhos".
  - **Importar:** aceita `.js` e `.json`. O resto do fluxo de Mesclar/Substituir fica como está.
  - **Lembrete de backup:** continua.
- [ ] **Step 4:** Rode `npm test && npm run typecheck`. Esperado: PASSA.
- [ ] **Step 5: Commit** `git commit -m "v2: exporta biblioteca.js e importa .js/.json"`

### Task 20: Pendrive novo (carrega `biblioteca.js`, não grava nada)

**Files:**
- Modify: `vite.config.ts` (`modoPenDrive.transformIndexHtml` insere `<script src="./biblioteca.js"></script>` antes do script do app), `src/main.ts`, `src/modo.ts`, `src/router/index.ts`, `src/stores/configuracoes.ts`
- Create: `src/lib/bibliotecaGlobal.ts`, `bibliotecaGlobal.spec.ts`, `src/views/SemBibliotecaView.vue`
- Delete: `src/views/CarregarBibliotecaView.vue`, `src/lib/penDrive.ts`, `Configuracoes.bibliotecaPenDriveDe`

**Interfaces:**
- Produces:
  - `lerBibliotecaGlobal(valor: unknown): LeituraBackup`. Valida o objeto já carregado (em vez do texto) com o mesmo esquema e a mesma migração.
  - `estadoPenDrive: { exportadoEm: string | null; erro: string | null }` em `modo.ts`.

- [ ] **Step 1: Testes** (`bibliotecaGlobal.spec.ts`):
  - `undefined` dá `{ ok:false, erro:'Arquivo biblioteca.js não encontrado ao lado do plantao-facil.html.' }`;
  - um objeto válido dá `ok:true`;
  - um objeto inválido dá `ok:false`, com a mensagem de validação.
- [ ] **Step 2:** Rode. Esperado: FALHA.
- [ ] **Step 3: Implementar.**
  - **`main.ts`** (pendrive):
    - **sempre** `import('fake-indexeddb/auto')`;
    - depois, `lerBibliotecaGlobal(window.BIBLIOTECA)`;
    - se der certo, `substituirBiblioteca` e `estadoPenDrive.exportadoEm`;
    - se der errado, `estadoPenDrive.erro`.
  - **Rotas:**
    - com erro, todas levam a `/sem-biblioteca`, que mostra a mensagem e as instruções (os dois arquivos na mesma pasta, onde exportar no celular);
    - sem erro, as rotas de edição continuam bloqueadas.
  - **Configurações:** no pendrive não salvam. O tema muda só na sessão, e a cor de destaque vem do arquivo.
  - **Faixa do topo:** "Pendrive — somente consulta · biblioteca de dd/mm/aaaa".
  - **Antes de mexer:** confira na documentação atual do vite-plugin-singlefile se o script clássico externo é mantido sem ser embutido.
- [ ] **Step 4:** Rode `npm test && npm run typecheck && npm run build:pendrive`. Esperado: PASSA, gerando `dist-pendrive/plantao-facil.html`.
- [ ] **Step 5: Teste manual** em `file://`:
  - copiar um `biblioteca.js` exportado para `dist-pendrive/` e abrir no Chrome, no Edge e no Firefox;
  - a biblioteca abre e nada fica gravado (o IndexedDB do `file://` aparece vazio em DevTools → Application);
  - sem o arquivo, aparece a tela de instruções.
- [ ] **Step 6: Commit** `git commit -m "v2: pendrive carrega biblioteca.js e não grava nada no PC"`

### Task 21: Ajustes, ícones do PWA e fechamento

**Files:**
- Modify: `src/views/AjustesView.vue` (cor de destaque com 4 pílulas coloridas; tema claro/escuro; armazenamento), `vite.config.ts` (`theme_color`/`background_color` `#eef1f6`), `CLAUDE.md` (todas as decisões da v2; comando `build:pendrive` com `biblioteca.js`)

- [ ] **Step 1:** Implemente o seletor de cor (as opções de `CORES_DESTAQUE`; trocar a cor muda o app na hora).
- [ ] **Step 2:** Rode `npm test && npm run typecheck && npm run build && npm run build:pendrive`. Esperado: PASSA.
- [ ] **Step 3: Conferir no preview** (`preview`):
  - o PWA instala;
  - offline, abre com os dados;
  - a migração de um banco v1 real acontece: copiar o backup atual do celular e importar.
- [ ] **Step 4: Commit** `git commit -m "v2: ajustes de cor, manifesto e CLAUDE.md"`

**🛑 Fim da Fase 5.** Parar e explicar ao usuário:
- como testar o pendrive e a importação do `biblioteca.js` no celular;
- que a publicação (merge de `v2` em `main` → GitHub Pages) só acontece quando ele pedir. Lembrar que, ao abrir a v2, o celular migra os dados sozinho, e recomendar exportar um backup na v1 antes.
