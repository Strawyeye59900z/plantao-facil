# Plantão Fácil

App pessoal de apoio ao plantão médico (PWA offline-first). O usuário é médico e programa por hobby.

## Regras de trabalho (obrigatórias)

1. **Não inventar conteúdo clínico.** Nenhuma dose, prescrição, escore, alerta ou interpretação pode ser criada pelo Claude, nem no app nem em dados de exemplo. Todo conteúdo médico é cadastrado pelo usuário. Em testes, usar apenas dados fictícios óbvios (ex.: "Medicamento Teste A").
2. **Perguntar antes de decidir** qualquer coisa não definida aqui. Não preencher lacunas com suposições.
3. **Trabalhar por fases.** Antes de codar cada fase: apresentar plano e dúvidas. Ao fim: parar, explicar como testar e esperar aprovação.
4. **Consultar documentação atual** de bibliotecas/APIs externas (vite-plugin-pwa, Dexie, shadcn-vue, Gemini, Anthropic) em vez de confiar na memória — principalmente nomes de modelos, envio de PDF e limites de tamanho.
5. **Manter este arquivo atualizado** com as decisões do projeto.
6. **Interface em português do Brasil.**

## Stack

- Vue 3 (Composition API, `<script setup>`) + Vite 8 + TypeScript 6
- Pinia, Vue Router (hash history)
- Dexie (IndexedDB); pede `navigator.storage.persist()` ao abrir
- vite-plugin-pwa (`registerType: 'prompt'`, precache de todo o build)
- shadcn-vue (Tailwind v4 + Reka UI), ícones `@lucide/vue`, toasts `vue-sonner`. Componentes copiados em `src/components/ui/` (adicionar com `npx shadcn-vue@latest add <nome>`). **Atenção:** o CLI reinsere o import do Google Fonts e um `@layer base` duplicado em `src/style.css` e pergunta se sobrescreve `button` (responder não — ele tem os tamanhos `touch`). Reverter `style.css` após cada `add`.
- Selects: `CampoSelect` (select nativo, melhor no celular). Números: `CampoNumero` (null = vazio) e `CampoNumeroObrigatorio` (vazio = NaN). Confirmações: `DialogoConfirmar`. Aviso de saída de editor: `useAvisoSaida`. Listas: `PainelBiblioteca` + `LateralGrupos` + `CartaoItem` (`src/components/biblioteca/`).
- Vitest + fake-indexeddb
- Validação de dados externos (backup, resposta da IA): **valibot**
- Fórmulas (Fase 4): **mathjs/number** (instância mínima + checagem da árvore) — nunca `eval`/`new Function`
- Recorte de páginas de PDF (Fase 5): `pdf-lib`

## Princípios

- Offline-first: tudo funciona sem internet, exceto a importação de PDF por IA.
- Dados só no aparelho, modelados para sincronização futura: UUID, `criadoEm`, `atualizadoEm`, exclusão lógica (`excluidoEm`).
- **Nenhum dado de paciente é salvo.** Peso e entradas das calculadoras vivem só na memória da tela.
- Rapidez: busca no topo, favoritos.
- Mobile-first, funciona bem no PC. **Tema claro padrão**, opção de escuro. Alvos de toque ≥ 44px (botões `size="touch"` / `"icon-touch"`).
- Sem fontes ou recursos externos em tempo de execução. Fonte **Plus Jakarta Sans embutida** (só o subconjunto latino, `src/assets/fontes/`, licença OFL junto).

## Estrutura

```
src/
  dominio/      TS puro (sem Vue/Dexie) — tipos, motores de cálculo; foco dos testes
    tipos/      modelo de dados de todos os módulos
    texto/      normalização para busca (sem acentos)
    aparencia/  cor de destaque (valores válidos, aplicar no <html>, cache em localStorage)
    biblioteca/ entradas da lateral de grupos (Favoritos, Todas, grupos, Sem grupo) e filtro por chave
    prescricoes/ busca, agrupamento, edição/duplicação/validação
    dose/       formatação de números e peso (o motor de dose dos itens saiu na v2)
    migracao/   conversão da v1 para o modelo atual (banco e backup)
    backup/     esquema (valibot), exportar/ler, planejar e aplicar mesclagem
    calculadoras/ motor de pontos, fórmula (mathjs restrito), interpretação, editor
    ia/         provedores (Gemini/Claude/ChatGPT), prompt, formato da resposta, rascunhos
  db/           Dexie (banco.ts), repositório-base, armazenamento persistente
  stores/       Pinia
  router/
  components/   layout/ (app shell), biblioteca/ (painel, lateral de grupos, cartão) e ui/ (shadcn-vue)
  views/
  lib/utils.ts  cn() do shadcn
```

Testes ficam ao lado do código: `*.spec.ts`.

## Decisões tomadas

### Geral
- Nome: **Plantão Fácil**. Ícone: prancheta com check, fundo azul (`public/favicon.svg`; PNGs gerados com `@vite-pwa/assets-generator`, maskable feito à parte).
- Publicação: **GitHub Pages** via `.github/workflows/deploy.yml` (`BASE_PATH=/<repositorio>/`). Hash routing por não haver fallback de SPA no Pages.
  - Repositório (público): https://github.com/Strawyeye59900z/plantao-facil — Pages com origem **GitHub Actions**; cada push na `main` testa, gera e publica.
  - App publicado: https://strawyeye59900z.github.io/plantao-facil/
- Celular principal: **Android**.
- Código: nomes de domínio em português; termos técnicos genéricos em inglês.
- Git iniciado; commit ao fim de cada fase.

### Sincronização PC ↔ celular (v3.1, branch `v3.1`)
- O app e a API `/api/sessoes` rodam num **Cloudflare Worker** (`prescricao`, domínio `prescricao.mhvl.com.br`; `wrangler.jsonc`, publicar com `npm run build && npx wrangler deploy`). O GitHub Pages continua só como cópia estática, sem sincronização.
- **Durable Objects com SQLite** (`worker/objetos.js`: `Sessao`, `Entrada`, `Limitador`), no plano grátis. O **KV foi abandonado**: o limite grátis é 1.000 gravações/dia e cada consulta do PC (a cada 3 s) gravava, causando erros 5xx.
- O prazo de 12 h só é renovado a cada 30 min; o limitador de tentativas por IP fica em memória. Limite a vigiar no plano grátis: tempo de execução dos objetos (13 mil GB-s/dia, ~29 h de sessão aberta somadas); se apertar, trocar a consulta por WebSocket.
- Testes do Worker: `node --test worker/sessoes.test.mjs` (fora do Vitest).

### Layout (v2, branch `v2`)
- Largura: a biblioteca (`/prescricoes`, `/calculadoras`) usa `max-w-6xl`; as demais telas ficam em `max-w-3xl`, para leitura.
- Topo único (sem menu lateral nem navegação inferior): logo redondo na cor de destaque, pílulas das áreas (`AREAS` em `navegacao.ts`; a ativa em `--foreground`), busca em pílula (grava `?q=` na rota da área) e botão redondo de menu (`MENU`: Grupos, Importar PDF, Backup, Lixeira, Ajustes). No celular, logo + busca + menu numa linha e as pílulas embaixo: **3 pílulas iguais na largura toda, ícone sobre o rótulo** (cabem em 320 px, 44 px de altura); a partir de `sm`, ícone ao lado do rótulo.
- Rotas `/nova` e `/editar`: o topo mostra só voltar + `route.meta.titulo`.

### Visual (v2, branch `v2`)
- Direção: **fundo cinza-azulado** (`--background`), **cartões brancos bem arredondados** (`--radius: 1.375rem`), **botões e filtros em pílula**, títulos grandes e pesados, **Plus Jakarta Sans**. Tokens em `src/style.css`.
- **Cor de destaque** (`--primary`) aplicada via `data-destaque` no `<html>` (azul, coral, verde, violeta); **padrão verde** (`#0f9d8a`). **O seletor em Ajustes ainda não existe — vem em uma fase posterior** (a ação `definirCorDestaque` da store de configurações já existe). Tema claro padrão, escuro opcional.
- Biblioteca (Prescrições e Calculadoras, `PainelBiblioteca`): no PC, **lateral de grupos** (220px, cartão branco; ícone num quadrado arredondado, rótulo e contagem; a ativa tingida com o destaque) e grade de **2 colunas de cartões**; no celular, a lateral vira **fileira de pílulas rolável** e os cartões ficam em 1 coluna. Entradas: Favoritos, Todas, cada grupo (ordem cadastrada) e Sem grupo (só se houver item). Grupo escolhido em `?grupo=`; busca do topo em `?q=` procura em todos os grupos (título "Resultados").
- Cartão (`CartaoItem`): etiquetas em pílula (ex.: "N condições"; "importada — revisar" em amarelo), título e linha de meta. Cada tela passa `descrever(item)` ao painel — o conteúdo do cartão é genérico.
- Alertas e avisos: caixa com fundo tingido e borda suave da cor da gravidade (sem barra grossa à esquerda).
- Logo do app no topo usa `--primary`. **O ícone do PWA (PNGs) continua azul** — trocar só se o usuário pedir.

### Dados
- **"Grupo" é o nome na interface** para o que o código chama de `Categoria` (tipo, tabela, rotas e campos continuam `categoria*`). "Sem categoria" = **"Sem grupo"**. Tela `/categorias` = "Grupos".
- Grupos (`Categoria`): **lista gerenciada**, separada por módulo (`escopo: 'prescricao' | 'calculadora' | 'escala'`; abas Prescrições, Calculadoras e Escalas na tela Grupos, com a contagem "N prescrições/calculadoras/escalas"). Prescrições, calculadoras e escalas referenciam `categoriaId`.
- Grupos têm **ícone opcional** (`icone`: chave da galeria fixa de ~70 ícones Lucide em `src/components/categorias/icones.ts`; não renomear chaves). Escolhido em Grupos (galeria em diálogo). Aparece na lateral/pílulas da biblioteca e na tela da prescrição. Registros/backups antigos sem o campo = `null`.
- Exclusão: vai para a **lixeira** (exclusão lógica); dentro da lixeira pode **excluir permanentemente**.
- **Recentes foram removidos na v2** (sem store nem seção).
- Favoritos: campo `favorito` na entidade; entram no backup.
- Configurações (tema, `corDestaque`, chaves de IA) ficam na tabela `configuracoes`, fora do backup. Tema e cor de destaque também em `localStorage` (`plantao-facil:tema`, `plantao-facil:destaque`) só para evitar piscar na abertura.
- IndexedDB não indexa booleanos nem `null`: favorito/excluidoEm filtrados em memória.

### Prescrições (v1 Fases 1–2; modelo v2, branch `v2`)
- Lista: painel com **lateral de grupos** (Favoritos, Todas, grupos, Sem grupo) e cartões em ordem alfabética (ver "Visual"). Durante a busca, procura em todos os grupos.
- Busca (tempo real, sem acentos, todas as palavras): título, grupo, tags, **texto e motivo de todas as opções dos itens**, nome das condições, receita, observações.
- Obrigatórios ao salvar (`validarPrescricao`): **título, grupo e ≥1 item**; cada opção precisa de texto (o motivo é opcional); alerta sem texto e condição sem nome também bloqueiam. Os erros aparecem no topo do editor.
- Excluir grupo: prescrições ficam **"Sem grupo"** (o grupo vai para exclusão lógica; não aparece na Lixeira).
- Duplicar: "(cópia)" no título, sem favorito, mantém origem/revisão (cópia de não revisada continua não revisada); IDs novos em itens, opções, condições e alertas, mantendo os vínculos; abre o editor da cópia.

#### Itens e opções "OU" (v2)
- `ItemPrescricao { id, condicaoId, opcoes: OpcaoItem[] }`, `OpcaoItem { id, texto, motivo }`. **1 opção = item simples; ≥ 2 opções = item "OU"** (opções equivalentes). O motivo é opcional e aparece ao lado da opção.
- **Sem cálculo de dose nos itens (v2):** `regraDose`, `alternativas` e `opcoesEquivalentes` da v1 foram removidos; doses ficam só no texto. (O motor de `src/dominio/dose/` pode ser reaproveitado na calculadora por peso, Fase 3.)
- Tela: item "OU" mostra **todas as opções por extenso** para tocar em uma; **nenhuma vem escolhida** (escolha só em memória, volta ao padrão ao sair).
- Editor: a primeira opção é o texto do item; **"+ opção OU"** acrescenta outra (com motivo opcional); cada opção de um item "OU" pode ser removida (com 1 opção o item volta a ser simples).

#### Condições
- `condicoes` na prescrição, `condicaoId` no item (`src/dominio/prescricoes/condicoes.ts`): etapas/situações com nome livre. Item sem condição = **"Sempre"**. Itens sempre **agrupados**: "Sempre" primeiro, depois cada condição na ordem (`ordenarPorCondicao`; `paraDados` já ordena).
- Tela: pílulas "O paciente tem…"; **várias podem ser marcadas**; **nenhuma vem marcada** (só em memória). Só aparecem os itens "Sempre" + os das condições marcadas.
- Editor: seção "Condições" (adicionar, renomear, ↑/↓ — os grupos de itens acompanham —, remover → itens viram "Sempre"); seletor "Condição" em cada item (trocar leva o item para o fim do grupo novo — `definirCondicaoDoItem`); ↑/↓ de item **só dentro do grupo** (`moverItemNoGrupo`).
- Alertas **não** se ligam a condição. Backup/dados antigos sem os campos: `[]`/"Sempre".

#### Copiar (`src/dominio/prescricoes/copia.ts`)
- Copia **só os itens visíveis** ("Sempre" + condições marcadas), **renumerados** ("1. …"), um por linha, **sem linha em branco**; quebras de linha dentro do item viram espaço.
- Item "OU" visível **sem opção escolhida bloqueia** ("Escolha uma opção no item N.", com o número da tela; o item é destacado); copia só a opção escolhida.
- Só itens condicionais e nada marcado → "Marque uma condição para copiar.".

#### Alertas
- Da prescrição inteira (`itemId: null`) ou **ligados a um item** ("vale para" no editor). Tela: os da prescrição ficam no **topo**; os de item ficam **junto do item**. Alerta ligado a um **item que não existe** (dados importados/migrados) também aparece no **topo** (`alertasDaPrescricao`) — nunca fica escondido.
- Remover um item transforma seus alertas em alertas da prescrição inteira.

#### Observações, receita e referência
- **Observações**: um parágrafo por observação. Parágrafo novo começa numa linha em branco ou numa linha que abre com **rótulo** ("Obs:", "# Cuidados:", "#Bizu:" — até ~25 letras/espaços antes dos dois-pontos), mostrado em negrito (`paragrafosObservacoes`). Rótulo seguido de "//" **não** conta (links como "https://…"). Editor: dica "Comece cada parágrafo com o rótulo, ex.: Obs:".
- **Receita de alta** (`receita`): texto simples com quebras de linha, **sem marcadores/cálculo**, fonte mono. Na tela: coluna da direita no PC, aba "Receita" no celular, botão **"Copiar receita"** (copia o texto como cadastrado). Entra na busca e no backup; ausente = `''`.
- Referência: texto simples com quebras de linha.

#### Editor
- Cartões brancos, nesta ordem: título/grupo ("Novo grupo")/tags → condições → itens → alertas → observações → receita → referência. Salvar/Cancelar numa **barra flutuante em pílula**. Avisa ao sair com alterações não salvas (`useAvisoSaida`).

#### Migração v1 → v2 (`src/dominio/migracao/`)
- **Dexie versão 2** converte todas as prescrições do aparelho (inclusive lixeira) ao abrir; se falhar, nada é gravado (os dados ficam na v1). **Backups v1 (`versaoFormato: 1`) são aceitos** na importação e convertidos (`migrarBibliotecaV1`).
- Texto principal + alternativas viram as opções (mesmo `item.id`). Em item da v1 **com alternativas e sem "OU"**, a opção principal recebe o motivo **"Padrão"**. IDs das opções **determinísticos**: principal = `${item.id}-principal`, alternativas mantêm o id da v1 (migrar o mesmo dado duas vezes dá o mesmo resultado, sem falso conflito na mesclagem).
- **Regra de dose vira texto** com **todos os números**, inclusive arredondamento (`descreverRegraV1`): o primeiro `{dose}`/`{dose_diaria}` vira "[regra por extenso]", os seguintes "[dose]"/"[dose diária]", `{volume}` → "[volume]", `{tomadas}` → intervalo ("de 8h em 8h") ou "[tomadas]"; sem marcador de dose, a regra é anexada ao fim. A prescrição fica **"importada — revisar"** (`revisada: false`) com uma dúvida por item convertido.
- Campos ausentes em registros antigos: receita `''`, condições `[]`, condição "Sempre"; `calculadoraIds` começa vazio.

#### Exclusão em massa (v3.1)
- **Selecionar** (botão na lista de Prescrições ou **tocar e segurar** um cartão): caixas nos cartões, barra flutuante com "N selecionadas", **Todas/Nenhuma** (só as visíveis) e **Excluir**. Trocar de grupo ou de busca desmarca tudo. Só em Prescrições (`PainelBiblioteca` com `selecionavel`); não existe no pen drive.
- Excluir selecionadas e **excluir grupo** mandam as prescrições para a **Lixeira** (restauráveis). **Excluir grupo** (botão no cabeçalho, só com um grupo aberto) também exclui o grupo, que não aparece na Lixeira; restauradas, as prescrições caem em "Sem grupo".
- **Excluir biblioteca inteira** (Ajustes → `ExcluirBiblioteca.vue`): apaga **de vez** prescrições, calculadoras, escalas, grupos e lixeira; mantém as configurações. Oferece baixar backup antes e exige digitar EXCLUIR.
- Regras em `src/db/exclusao.ts` (uma transação cada; testes em `exclusao.spec.ts`).

### Backup (Fase 3)
- JSON (`plantao-facil-backup-AAAA-MM-DD-HHMM.json`) com `formato` + **`versaoFormato: 2`** (v2); backups `versaoFormato: 1` (v1) são aceitos e convertidos (ver "Migração v1 → v2"); prescrições, categorias e calculadoras **incluindo lixeira**. Fora: configurações, chaves de IA.
- Backups `versaoFormato: 2` feitos na Fase 2 (calculadoras/grupos ainda no formato da v1, sem `area`) passam por `migrarCalculadorasEGruposV1` antes da validação; os que já têm `area` não mudam.
- Validação com **valibot** (esquemas em `src/dominio/backup/esquema.ts`, tipados contra o modelo). Rejeita JSON inválido, arquivo que não é do app, versão de formato mais nova e IDs repetidos.
- Exportar: **Baixar** e **Compartilhar** (menu do Android, se o navegador suportar). Guarda `ultimoBackupEm` (só no aparelho) e mostra lembrete; destaque em âmbar a partir de 7 dias.
- Importar: pré-visualização (novos/iguais/conflitos por tipo) → **Mesclar** ou **Substituir**.
- Mesclar: novo entra; igual (diferença só em `atualizadoEm` conta como igual) é ignorado; o que só existe no aparelho fica; mesmo ID com conteúdo diferente = conflito, escolha da **entidade inteira**, **pré-seleciona a mais recente** (empate: aparelho); botão "usar sempre a mais recente". Lixeira num lado e ativa no outro = conflito.
- Grupos ativos de **mesmo nome e escopo** (sem maiúsculas/acentos) com IDs diferentes são **juntadas** à do aparelho; prescrições do arquivo são remapeadas.
- Substituir: aviso + diálogo que oferece **baixar backup antes** (ou substituir sem baixar).
- Gravação em **uma transação** (tudo ou nada). Dados passam por cópia JSON antes do IndexedDB (proxies do Vue).
- Exclusão permanente não é propagada: se o item ainda existir no aparelho destino, ele fica (decisão do usuário).

### Calculadoras e Escalas (v2)
- Nenhuma vem pronta: todo conteúdo clínico é cadastrado pelo usuário. Nada digitado nas telas de uso é salvo (peso, entradas e respostas só na memória).
- **Duas áreas** (pílulas do topo, rotas `/calculadoras` e `/escalas`), **uma tabela** `calculadoras` com o campo `area: 'calculadora' | 'escala'`. Grupos têm `escopo: 'calculadora' | 'escala'`. Lista, grupos, favoritos, lixeira e busca do topo (nome/grupo/descrição, por área) seguem o padrão das prescrições (`PainelBiblioteca`).
- **Três tipos** (`src/dominio/tipos/calculadora.ts`; motores em `src/dominio/calculadoras/`), todos com editor, painel **"Testar"** e avisos ao vivo:
  - **Dose por peso** (`dose_peso`, só em Calculadoras; `dosePeso.ts`): linhas de texto com marcadores `{nome}`; cada marcador tem uma **regra** (dose por kg, unidade, concentração opcional — *unidade da dose por mL*, dose máxima opcional, casas decimais). Sem peso mostra a regra ("2 mg/kg (máx. 100 mg)"); com peso mostra dose e volume. **Dose máxima**: mostra o máximo e a etiqueta **"limitada à dose máxima"**. **Volume**: 1 casa decimal se ≥ 1 mL, 2 casas se < 1 mL, e **"< 0,01 mL"** se arredondar para zero. Dose positiva que arredonda para zero nas casas da regra mostra **"< 0,1 mg"** ("< 1" com 0 casas, "< 0,01" com 2) e o volume sai da dose sem arredondar. Casas decimais de **0 a 4** (regras e saídas de fórmula; `CASAS_MAXIMAS` em `dose/numeros.ts`, o máximo que `formatarNumero` mostra). Regra com número faltando ou casas inválidas mostra **"[regra incompleta]"**. Marcador sem regra permanece literal. **Renomear marcador** no texto leva a regra já preenchida junto, com um aviso do nome de origem (só na memória da tela; some ao editar o cartão ou sair); regra que perdeu o marcador fica no fim, com aviso.
  - **Fórmula** (`formula`, só em Calculadoras; `formula.ts`): **campos** número (variável, unidade, mín./máx.) ou **sim/não** (valor para sim e para não) e **várias saídas**, cada uma com expressão, unidade, casas decimais, **teto/piso** opcionais e **faixas** de interpretação. Ordem: entradas (mín./máx.) → avaliar → casas decimais → teto/piso (com aviso). Resultado não finito = erro. Motor **mathjs/number** em instância mínima + checagem da árvore (só números, variáveis declaradas, + − * / ^, parênteses e `sqrt, log, log10, exp, abs, min, max, round, floor, ceil`; recusa import, acesso a propriedade, condicionais, atribuição, strings, matrizes e constantes como `pi`). Decimal na expressão com ponto; nas entradas, vírgula.
  - **Pontos** (`pontos`, só em Escalas; `pontos.ts`): campos sim/não, seleção e número (faixas de pontos por valor), faixas de interpretação do total. Mostra **resultado parcial** ("parcial: X de Y") enquanto há campos sem resposta, com a interpretação marcada como parcial. Campo numérico sem faixa para o valor = erro (não soma). Novos campos começam **sem pontos** (nenhum padrão como 0).
- Faixas fechadas `de ≤ x ≤ até` (null = sem limite); a primeira que contém o valor vence. Lacunas detectadas respeitando as casas decimais (no escore, também confere se cobre do menor ao maior total possível). **Sobreposição/lacuna só avisa**; "de > até" bloqueia. Entradas numéricas aceitam qualquer número de casas. **Sem botão Copiar** (decisão do usuário): só exibe o valor.
- Tela de uso compacta: texto do campo e botões na mesma linha; 2 colunas no PC/tablet (md+), 1 no celular. `UsoCalculadora.vue` escolhe a tela pelo tipo e aceita a calculadora salva ou os dados em edição.
- Obrigatórios ao salvar: nome, grupo e o necessário de cada tipo (ver `validarCalculadora` em `editar.ts`). Tipo escolhido na criação.
- **Migração v1 → v2** (Dexie **versão 3**, `src/dominio/migracao/calculadora.ts`; também ao importar backup v1): calculadora de pontos vira **escala** (`area: 'escala'`); calculadora de fórmula vira fórmula com **campos** (as entradas) e uma saída "Resultado" (id determinístico `<id>-saida`, com expressão, unidade, casas, teto/piso e faixas). Grupos: só com escalas → o grupo passa a `escopo: 'escala'`; com escalas e calculadoras → o grupo fica e ganha uma **cópia de escala** (id `<id>-escala`, mesmo nome, ícone, ordem e datas) para onde as escalas vão. Ids determinísticos: migrar o mesmo dado duas vezes dá o mesmo resultado (sem falso conflito na mesclagem). Registros que já têm `area` passam sem mudança.
- **Ligação com prescrições**: `Prescricao.calculadoraIds` (calculadoras **e** escalas, na ordem escolhida). Editor: cartão "Calculadoras e escalas" (`SeletorCalculadoras`) com lista ligada (↑/↓/desligar) e busca das disponíveis agrupadas por área. Tela da prescrição: aba **"Calculadoras · N"** (some se N = 0; no PC e no celular) com um **cartão recolhível por item** (`CartaoCalculadoraLigada`: ícone do grupo, nome, link "Abrir" para `/calculadoras/:id` ou `/escalas/:id`, e o `UsoCalculadora` embutido); o primeiro já vem aberto. Item na **lixeira não aparece** (e não conta no N), mas o **vínculo é mantido** (volta ao restaurar). **Excluir permanentemente** remove o id de `calculadoraIds` de todas as prescrições (inclusive da lixeira). Ao salvar no editor, ids de calculadoras que não existem mais são descartados (`semCalculadorasInexistentes`); `validarPrescricao` ignora esses ids e nunca bloqueia por eles.
- Pen drive: calculadoras só para uso (sem editar/duplicar/excluir/favoritar).

### Modo pen drive (PCs do hospital com restrição)
- Build extra que gera **um único `.html`** aberto como arquivo (file://), levado em pen drive junto com o backup JSON.
- **Somente leitura**: no hospital só consulta e copia; edição apenas em casa (celular/PC pessoal).
- Importação de PDF por IA desativada nesse modo (chave de API nunca fica em PC do hospital).
- Biblioteca **salva no navegador do PC** (carregada do backup do pen drive; abre direto nas próximas vezes). Precisa de "atualizar biblioteca" (substituir pelo backup novo) e "apagar dados deste PC".
- Navegadores-alvo: desconhecidos → testar em Chrome, Edge e Firefox.
- Implementação (Fase 3b): `npm run build:pendrive` → `dist-pendrive/plantao-facil.html` (vite `--mode pendrive` + `vite-plugin-singlefile`; sem PWA — `virtual:pwa-register/vue` vira stub; favicon embutido). `MODO_PENDRIVE` em `src/modo.ts`.
- Rotas de edição bloqueadas (`rotaBloqueadaNoPenDrive`); sem biblioteca carregada → `/carregar`. Somem: Nova, Editar, Duplicar, Excluir, Marcar revisada, Grupos, Lixeira, Backup, Importar. Favorito só exibido (não alterável). Não revisadas aparecem com aviso.
- Faixa "Modo pen drive — somente leitura · biblioteca de dd/mm/aaaa". Ajustes: tema, **Atualizar biblioteca** (substitui tudo) e **Apagar dados deste PC**. Aviso de privacidade na tela Carregar.
- Se o IndexedDB não funcionar no `file://`, usa `fake-indexeddb` em memória (só na aba) e avisa. `main.ts` detecta antes de importar o app.
- **Ordem de inicialização (`src/app.ts`)**: carregar stores **antes** de `app.use(router)` — a navegação inicial começa no install do router e as guardas precisam das configurações.
- **Falha ao abrir o banco** (ex.: atualização do Dexie desfeita): `carregarAoAbrir` (`src/abertura.ts`) não lança; `montarApp` monta `FalhaAbertura.vue` com a mensagem "Não foi possível atualizar os dados deste aparelho…" e o botão **Recarregar** (vale também no pen drive).
- Testado (puppeteer-core, fora do projeto) em **Chrome, Edge e Firefox 158** abrindo como `file://`: IndexedDB persiste, carregar/atualizar/apagar, dose, Copiar e bloqueio de rotas OK. Fallback em memória não foi exercitado (nenhum dos três bloqueou).

### IA (Fase 5)
- Provedores: **Gemini, Claude e ChatGPT**, atrás da mesma interface (`src/dominio/ia/provedores.ts`: montar requisição / ler resposta). Chamada **direto do navegador** (CORS conferido em 14/10/2026; Claude exige `anthropic-dangerous-direct-browser-access: true`).
  - Gemini: `v1beta/models/{modelo}:generateContent`, PDF `inline_data`, `responseSchema` (tipos em maiúsculas, sem additionalProperties). Limite 50 MB / 1000 págs. Chave: https://aistudio.google.com/apikey
  - Claude: `/v1/messages`, bloco `document` base64, `output_config.format` json_schema. Limite requisição 32 MB (PDF ~23 MB) / 600 págs. Chave: https://platform.claude.com/settings/keys
  - ChatGPT: `/v1/responses`, `input_file` com data URI, `text.format` json_schema strict. Limite 50 MB (PDF ~37 MB), páginas não informadas. Chave: https://platform.openai.com/api-keys
- **Usuário escolhe o modelo** (lista com 3 por provedor — equilíbrio/mais barato/mais capaz — + "Outro"); padrão = o de equilíbrio (`gemini-3.8-flash`, `claude-sonnet-5-5`, `gpt-6.1-sol`).
- Chave de API no IndexedDB (configuracoes), nunca no backup nem no pen drive, com mostrar/ocultar, link "Obter chave" e apagar.
- Prompt (`src/dominio/ia/prompt.ts`): só o que está no PDF; nunca completar/corrigir/calcular doses; dúvidas em "duvidas". Resposta validada com valibot (`src/dominio/ia/resposta.ts`); inválida → erro claro + "Tentar de novo".
- **IA não cria cálculo de dose**: doses só como texto no item. A resposta da IA ainda está no formato da v1 (texto + alternativas); `criarRascunhos` converte para opções (adaptação temporária até a Fase 4).
- **Receita e observações na extração**: a IA preenche `receita` **só com a receita de alta/para levar, com quantidade a dispensar** ("28 cps", "____ cps"); trechos com "Uso oral/intravenoso" **sem** quantidade viram **itens**. Receita inteira, com quebras de linha, separada dos itens. `observacoes`: "Obs:", "# Cuidados:" e "#Bizu" juntos, **mantendo os rótulos**, um parágrafo cada. Listas de contraindicações → alerta `contraindicacao` da prescrição inteira. Na leitura, `receita` ausente = `''` (respostas de prompts antigos).
- **Condições na extração**: a IA devolve `condicoes` (nomes dos títulos de etapa/situação, como escritos) e `condicao` em cada item (0 = "Sempre", n = n-ésima condição). Condição inexistente → "Sempre" + dúvida. Ausentes na leitura = `[]`/0.
- **Única correção de formatação permitida à IA**: recolocar **espaços entre palavras grudadas** do PDF, sem alterar letras, números, unidades, abreviações ou pontuação, registrando isso nas dúvidas da prescrição.
- Grupo sugerido: se bater (sem maiúsculas/acentos) com grupo existente, já seleciona; senão **"Sem grupo"** (aprovação aceita sem grupo).
- **Dúvidas gerais do documento só na tela de revisão**; dúvidas de cada prescrição ficam salvas em `duvidasImportacao`.
- Intervalo de páginas recortado no aparelho com `pdf-lib`; limites conferidos antes do envio. **Caixa de confirmação a cada importação** ("não contém dados de pacientes"; vale para todos os lotes dela).
- Revisão: cada prescrição com Editar (mesmo `FormularioPrescricao` do editor), Descartar, Aprovar. Aprovada = salva como "importada — não revisada". Sair com pendentes pede confirmação.
- **Chat no navegador (sem chave)**: na tela Importar PDF, "Copiar prompt"/"Ver prompt" (`montarPromptChat`: mesmas regras + formato JSON descrito por extenso) e campo para colar a resposta do chat → mesma validação e revisão. A leitura aceita texto antes/depois do JSON e cercas ```json.
- **Importação em lotes** (`src/dominio/ia/lotes.ts`): sempre em lotes **fixos de 10 páginas novas**, cada lote repetindo a **última página do anterior** (1–10, 10–20, 20–30…), dentro do intervalo escolhido. Motivo: PDFs de ~100 páginas estouravam o limite de saída (32 mil tokens) e cortes manuais vinham incompletos.
  - Prompt de cada lote informa "páginas X a Y do documento original, que tem Z páginas" e que o trecho pode cortar uma prescrição (registrar nas dúvidas). Regra extra no prompt: extrair **todas** as prescrições/itens, sem resumir nem pular.
  - API: **uma confirmação para o envio inteiro**; lotes enviados **um por vez**; lote com erro fica com "Tentar de novo" e os outros seguem; Cancelar pausa ("Continuar envio"). Resposta **cortada** (`cortada: true` em `lerResposta`) ou lote acima do limite de bytes → **divide automaticamente em 2** (repetindo a página do meio; "Lote 3.1", "3.2").
  - Chat (sem chave): mesmos lotes; para cada um, **baixar o PDF do lote**, copiar o prompt do lote e colar a resposta; botão "Dividir em 2" manual.
  - **Revisão liberada enquanto os lotes chegam**; cada prescrição mostra o lote/páginas; dúvidas gerais agrupadas por lote.
  - **Possível duplicata** (`src/dominio/ia/duplicatas.ts`): mesmo título (sem maiúsculas/acentos) entre as importadas **ou com uma já salva** na biblioteca → só marca; o usuário decide.
- Mensagens de validação (backup e IA) em português via `descreverProblemas`.
- Testado com rede simulada (sem chamadas reais). **Teste com chave real fica com o usuário.**

## Pendências (perguntar ao usuário)

- (nenhuma no momento)

## Comandos

```bash
npm run dev        # desenvolvimento (http://localhost:5173)
npm test           # testes (Vitest)
npm run build      # checagem de tipos + build de produção (dist/)
npm run preview    # serve o build (http://localhost:4173) — para testar PWA/offline
npm run build:pendrive  # arquivo único dist-pendrive/plantao-facil.html (modo pen drive)
```
