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
- Selects: `CampoSelect` (select nativo, melhor no celular). Números: `CampoNumero` (null = vazio) e `CampoNumeroObrigatorio` (vazio = NaN). Confirmações: `DialogoConfirmar`. Aviso de saída de editor: `useAvisoSaida`. Listas: `ListaBiblioteca` + `LinhaItem`.
- Vitest + fake-indexeddb
- Validação de dados externos (backup, resposta da IA): **valibot**
- Fórmulas (Fase 4): **mathjs/number** (instância mínima + checagem da árvore) — nunca `eval`/`new Function`
- Recorte de páginas de PDF (Fase 5): `pdf-lib`

## Princípios

- Offline-first: tudo funciona sem internet, exceto a importação de PDF por IA.
- Dados só no aparelho, modelados para sincronização futura: UUID, `criadoEm`, `atualizadoEm`, exclusão lógica (`excluidoEm`).
- **Nenhum dado de paciente é salvo.** Peso e entradas das calculadoras vivem só na memória da tela.
- Rapidez: busca no topo, favoritos, recentes.
- Mobile-first, funciona bem no PC. Tema escuro padrão, opção de claro. Alvos de toque ≥ 44px (botões `size="touch"` / `"icon-touch"`).
- Sem fontes ou recursos externos em tempo de execução (sistema de fontes do aparelho).

## Estrutura

```
src/
  dominio/      TS puro (sem Vue/Dexie) — tipos, motores de cálculo; foco dos testes
    tipos/      modelo de dados de todos os módulos
    texto/      normalização para busca (sem acentos)
    prescricoes/ busca, agrupamento, edição/duplicação/validação
    dose/       motor de cálculo de dose, marcadores, peso
    backup/     esquema (valibot), exportar/ler, planejar e aplicar mesclagem
    calculadoras/ motor de pontos, fórmula (mathjs restrito), interpretação, editor
    ia/         provedores (Gemini/Claude/ChatGPT), prompt, formato da resposta, rascunhos
  db/           Dexie (banco.ts), repositório-base, armazenamento persistente
  stores/       Pinia
  router/
  components/   layout/ (app shell) e ui/ (shadcn-vue)
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

### Dados
- Categorias: **lista gerenciada**, separada por módulo (`escopo: 'prescricao' | 'calculadora'`). Prescrições/calculadoras referenciam `categoriaId`.
- Categorias têm **ícone opcional** (`icone`: chave da galeria fixa de ~70 ícones Lucide em `src/components/categorias/icones.ts`; não renomear chaves). Escolhido em Categorias (galeria em diálogo). Aparece no cabeçalho dos grupos, nos chips, em Recentes/Favoritos e na tela da prescrição. Registros/backups antigos sem o campo = `null`.
- Exclusão: vai para a **lixeira** (exclusão lógica); dentro da lixeira pode **excluir permanentemente**.
- **Recentes: 5 últimos, só em memória** enquanto o app está aberto (não persistem, não vão para o backup).
- Favoritos: campo `favorito` na entidade; entram no backup.
- Configurações (tema, chaves de IA) ficam na tabela `configuracoes`, fora do backup. Tema também em `localStorage` só para evitar piscar na abertura.
- IndexedDB não indexa booleanos nem `null`: favorito/excluidoEm filtrados em memória.

### Prescrições e dose (Fases 1–2)
- Lista: Recentes e Favoritos no topo; depois **agrupada por categoria** (ordem cadastrada), títulos em ordem alfabética, **grupos colapsáveis** (estado só em memória; durante a busca todos abrem). Chips filtram por categoria.
- Busca (tempo real, sem acentos, todas as palavras): título, categoria, tags, texto dos itens, **motivo e texto das alternativas, observações**.
- Obrigatórios ao salvar: **título, categoria e ≥1 item** (itens/alternativas/alertas sem texto e alternativa sem motivo também bloqueiam).
- Reordenar itens: botões ↑/↓.
- Excluir categoria: prescrições ficam **"Sem categoria"** (categoria vai para exclusão lógica; não aparece na Lixeira).
- **Opções equivalentes ("OU")**: item com `opcoesEquivalentes: true` — texto principal = opção 1, alternativas = opções 2, 3… (motivo opcional, vira rótulo). Na tela: **todas as opções por extenso** (com doses calculadas), **nenhuma pré-escolhida**, Copiar bloqueado até escolher ("Escolha uma opção no item N"); copia só a escolhida. Precisa de ≥2 opções. No editor: chave por item (ligar cria a opção 2). A IA marca `opcoesEquivalentes` quando o documento lista opções intercambiáveis ("OU"). Ausente em dados antigos = false.
- Recentes: conta ao abrir a prescrição. Alternativa escolhida por **lista suspensa ao lado do item** ("Padrão" + motivos); vive só na tela e volta ao padrão ao sair.
- Duplicar: "(cópia)" no título, sem favorito, mantém origem/revisão (cópia de não revisada continua não revisada); abre o editor da cópia.
- Observações/referência: texto simples com quebras de linha.
- Alertas: da prescrição (topo) **ou ligados a um item** (`itemId`): aparecem junto do item e também no topo. Remover um item transforma seus alertas em alertas da prescrição inteira.
- Editor avisa ao sair com alterações não salvas.
- Dose/kg pode ser **por tomada ou por dia** (`baseDoseKg`).
- **Tetos sempre respeitados** (por tomada e/ou diário, conforme cadastrado), inclusive com peso limite (dose fixa por tomada) e **reaplicados após o arredondamento**.
- Concentração na **mesma unidade da dose**, sem conversão automática.
- Unidade: texto livre com sugestões.
- Marcadores: `{dose}`, `{volume}`, `{dose_diaria}` (valor com unidade) e `{tomadas}`, que vira **intervalo em horas**: 1 → "1 vez ao dia", 2 → "de 12h em 12h", 3 → "de 8h em 8h"… Só aceito com 1, 2, 3, 4, 6, 8, 12 ou 24 tomadas/dia (o editor bloqueia o marcador nos outros casos; a regra continua válida).
- Peso: **até 1 casa decimal**, rejeita zero/negativo/não numérico; **sem limite máximo e sem confirmação** de valor alto.
- Copiar: **apenas os itens, numerados** ("1. …"), um por linha, **sem linha em branco** entre itens; quebras de linha dentro do item **não** são copiadas. Alternativa escolhida entra no lugar do item.
- Números: **vírgula decimal, sem zeros sobrando, sem separador de milhar** ("2,5 mL", "300 mg", "1000 mg"), sempre com a unidade cadastrada.
- **Dose sempre inteira**: arredondamento = inteiro mais próximo ou múltiplo de passo inteiro (baixo/próximo/cima). Volume: casas decimais (0–3) ou múltiplo.
- Ordem do cálculo (src/dominio/dose/calculo.ts): peso limite (peso **>** X, estritamente; dose fixa sem arredondamento) → dose/kg × peso (÷ tomadas se "por dia") → arredondamento → **tetos por último** (por tomada e diário ÷ tomadas; se o teto não for inteiro/múltiplo, ajusta para baixo) → dose diária → volume. Se o volume arredondado equivaler a mais que a dose máxima, arredonda o volume **para baixo** com aviso. Dose ou volume zero = erro (bloqueia copiar).
- Peso é obrigatório para copiar **só se algum item efetivo** (com a alternativa escolhida) tiver regra de dose. Campo de peso aparece se qualquer item/alternativa tiver regra.
- Sem peso, marcadores aparecem como "[dose]", "[volume]"; {tomadas} sai sempre com o intervalo.
- Editor: "Testar com peso" (não salvo) mostra prévia e memória de cálculo de cada regra.
- Regra nova: base "por tomada", arredondamento do volume 1 casa decimal (padrões de formulário, editáveis).

### Backup (Fase 3)
- JSON (`plantao-facil-backup-AAAA-MM-DD-HHMM.json`) com `formato` + `versaoFormato: 1`; prescrições, categorias e calculadoras **incluindo lixeira**. Fora: configurações, chaves de IA, recentes.
- Validação com **valibot** (esquemas em `src/dominio/backup/esquema.ts`, tipados contra o modelo). Rejeita JSON inválido, arquivo que não é do app, versão de formato mais nova e IDs repetidos.
- Exportar: **Baixar** e **Compartilhar** (menu do Android, se o navegador suportar). Guarda `ultimoBackupEm` (só no aparelho) e mostra lembrete; destaque em âmbar a partir de 7 dias.
- Importar: pré-visualização (novos/iguais/conflitos por tipo) → **Mesclar** ou **Substituir**.
- Mesclar: novo entra; igual (diferença só em `atualizadoEm` conta como igual) é ignorado; o que só existe no aparelho fica; mesmo ID com conteúdo diferente = conflito, escolha da **entidade inteira**, **pré-seleciona a mais recente** (empate: aparelho); botão "usar sempre a mais recente". Lixeira num lado e ativa no outro = conflito.
- Categorias ativas de **mesmo nome e escopo** (sem maiúsculas/acentos) com IDs diferentes são **juntadas** à do aparelho; prescrições do arquivo são remapeadas.
- Substituir: aviso + diálogo que oferece **baixar backup antes** (ou substituir sem baixar).
- Gravação em **uma transação** (tudo ou nada). Dados passam por cópia JSON antes do IndexedDB (proxies do Vue).
- Exclusão permanente não é propagada: se o item ainda existir no aparelho destino, ele fica (decisão do usuário).

### Calculadoras (Fase 4)
- "Medicações chaves dinâmicas" = calculadoras médicas em geral, cadastradas pelo usuário (ex.: escores de checklist). Nenhuma vem pronta.
- Motores em `src/dominio/calculadoras/`: `pontos.ts`, `formula.ts`, `interpretacao.ts`, `editar.ts` (vazios, duplicar, validar, avisos), `busca.ts`.
- Faixas fechadas `de ≤ x ≤ até` (null = sem limite); a primeira faixa que contém o valor vence. Lacunas detectadas respeitando casas decimais; no escore, também confere se cobre do menor ao maior total possível. **Sobreposição/lacuna só avisa** (não bloqueia salvar); "de > até" bloqueia.
- Escore mostra **resultado parcial** ("parcial: X de Y") enquanto há campos sem resposta; interpretação do parcial aparece marcada como parcial. Campo numérico **sem faixa para o valor = erro** (não soma).
- Fórmula: **mathjs/number** em instância mínima + checagem da árvore (só números, variáveis declaradas, + − * / ^, parênteses e `sqrt, log, log10, exp, abs, min, max, round, floor, ceil`). Recusa import, acesso a propriedade, condicionais, atribuição, strings, matrizes, constantes como `pi`. Decimal na expressão com ponto; nas entradas, vírgula. Ordem: entradas (mín./máx.) → avaliar → casas decimais → teto/piso (com aviso). Resultado não finito = erro.
- Entradas numéricas aceitam **qualquer número de casas**.
- **Sem botão Copiar** nas calculadoras: só exibe o valor final (decisão do usuário).
- Tela de uso compacta: **texto do campo e botões na mesma linha**; **2 colunas no PC/tablet (md+), 1 no celular**. Opções de seleção quebram linha se não couberem.
- Obrigatórios ao salvar: nome, categoria, ≥1 campo/entrada e o necessário de cada tipo. Novos campos começam **sem pontos** (o usuário preenche; nenhum padrão como 0).
- Editor com painel **"Testar calculadora"** (mesma tela de uso) e avisos ao vivo. Tipo escolhido na criação.
- Lista igual à de prescrições (`ListaBiblioteca` genérica); **busca do topo é por aba** (Calculadoras busca nome/categoria/descrição). Categorias com abas Prescrições/Calculadoras. Lixeira mostra os dois.
- Pen drive: calculadoras só para uso (sem editar/duplicar/excluir/favoritar).

### Modo pen drive (PCs do hospital com restrição)
- Build extra que gera **um único `.html`** aberto como arquivo (file://), levado em pen drive junto com o backup JSON.
- **Somente leitura**: no hospital só consulta e copia; edição apenas em casa (celular/PC pessoal).
- Importação de PDF por IA desativada nesse modo (chave de API nunca fica em PC do hospital).
- Biblioteca **salva no navegador do PC** (carregada do backup do pen drive; abre direto nas próximas vezes). Precisa de "atualizar biblioteca" (substituir pelo backup novo) e "apagar dados deste PC".
- Navegadores-alvo: desconhecidos → testar em Chrome, Edge e Firefox.
- Implementação (Fase 3b): `npm run build:pendrive` → `dist-pendrive/plantao-facil.html` (vite `--mode pendrive` + `vite-plugin-singlefile`; sem PWA — `virtual:pwa-register/vue` vira stub; favicon embutido). `MODO_PENDRIVE` em `src/modo.ts`.
- Rotas de edição bloqueadas (`rotaBloqueadaNoPenDrive`); sem biblioteca carregada → `/carregar`. Somem: Nova, Editar, Duplicar, Excluir, Marcar revisada, Categorias, Lixeira, Backup, Importar. Favorito só exibido (não alterável). Não revisadas aparecem com aviso.
- Faixa "Modo pen drive — somente leitura · biblioteca de dd/mm/aaaa". Ajustes: tema, **Atualizar biblioteca** (substitui tudo) e **Apagar dados deste PC**. Aviso de privacidade na tela Carregar.
- Se o IndexedDB não funcionar no `file://`, usa `fake-indexeddb` em memória (só na aba) e avisa. `main.ts` detecta antes de importar o app.
- **Ordem de inicialização (`src/app.ts`)**: carregar stores **antes** de `app.use(router)` — a navegação inicial começa no install do router e as guardas precisam das configurações.
- Testado (puppeteer-core, fora do projeto) em **Chrome, Edge e Firefox 158** abrindo como `file://`: IndexedDB persiste, carregar/atualizar/apagar, dose, Copiar e bloqueio de rotas OK. Fallback em memória não foi exercitado (nenhum dos três bloqueou).

### IA (Fase 5)
- Provedores: **Gemini, Claude e ChatGPT**, atrás da mesma interface (`src/dominio/ia/provedores.ts`: montar requisição / ler resposta). Chamada **direto do navegador** (CORS conferido em 14/10/2026; Claude exige `anthropic-dangerous-direct-browser-access: true`).
  - Gemini: `v1beta/models/{modelo}:generateContent`, PDF `inline_data`, `responseSchema` (tipos em maiúsculas, sem additionalProperties). Limite 50 MB / 1000 págs. Chave: https://aistudio.google.com/apikey
  - Claude: `/v1/messages`, bloco `document` base64, `output_config.format` json_schema. Limite requisição 32 MB (PDF ~23 MB) / 600 págs. Chave: https://platform.claude.com/settings/keys
  - ChatGPT: `/v1/responses`, `input_file` com data URI, `text.format` json_schema strict. Limite 50 MB (PDF ~37 MB), páginas não informadas. Chave: https://platform.openai.com/api-keys
- **Usuário escolhe o modelo** (lista com 3 por provedor — equilíbrio/mais barato/mais capaz — + "Outro"); padrão = o de equilíbrio (`gemini-3.8-flash`, `claude-sonnet-5-5`, `gpt-6.1-sol`).
- Chave de API no IndexedDB (configuracoes), nunca no backup nem no pen drive, com mostrar/ocultar, link "Obter chave" e apagar.
- Prompt (`src/dominio/ia/prompt.ts`): só o que está no PDF; nunca completar/corrigir/calcular doses; dúvidas em "duvidas". Resposta validada com valibot (`src/dominio/ia/resposta.ts`); inválida → erro claro + "Tentar de novo".
- **IA não cria regra de dose**: doses só como texto no item; o usuário cadastra a regra na revisão.
- Categoria sugerida: se bater (sem maiúsculas/acentos) com categoria existente, já seleciona; senão **"Sem categoria"** (aprovação aceita sem categoria).
- **Dúvidas gerais do documento só na tela de revisão**; dúvidas de cada prescrição ficam salvas em `duvidasImportacao`.
- Intervalo de páginas recortado no aparelho com `pdf-lib`; limites conferidos antes do envio. **Caixa de confirmação a cada envio** ("não contém dados de pacientes").
- Revisão: cada prescrição com Editar (mesmo `FormularioPrescricao` do editor), Descartar, Aprovar. Aprovada = salva como "importada — não revisada". Sair com pendentes pede confirmação.
- **Chat no navegador (sem chave)**: na tela Importar PDF, "Copiar prompt"/"Ver prompt" (`montarPromptChat`: mesmas regras + formato JSON descrito por extenso) e campo para colar a resposta do chat → mesma validação e revisão. A leitura aceita texto antes/depois do JSON e cercas ```json.
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
