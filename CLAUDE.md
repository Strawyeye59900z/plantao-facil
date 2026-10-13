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
- Selects: `CampoSelect` (select nativo, melhor no celular). Confirmações: `DialogoConfirmar`.
- Vitest + fake-indexeddb
- Fórmulas (Fase 4): **mathjs** com escopo restrito — nunca `eval`/`new Function`
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
- Celular principal: **Android**.
- Código: nomes de domínio em português; termos técnicos genéricos em inglês.
- Git iniciado; commit ao fim de cada fase.

### Dados
- Categorias: **lista gerenciada**, separada por módulo (`escopo: 'prescricao' | 'calculadora'`). Prescrições/calculadoras referenciam `categoriaId`.
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
- Recentes: conta ao abrir a prescrição. Alternativa escolhida vive só na tela e volta ao padrão ao sair.
- Duplicar: "(cópia)" no título, sem favorito, mantém origem/revisão (cópia de não revisada continua não revisada); abre o editor da cópia.
- Observações/referência: texto simples com quebras de linha.
- Alertas: da prescrição (topo) **ou ligados a um item** (`itemId`): aparecem junto do item e também no topo. Remover um item transforma seus alertas em alertas da prescrição inteira.
- Editor avisa ao sair com alterações não salvas.
- Dose/kg pode ser **por tomada ou por dia** (`baseDoseKg`).
- **Tetos sempre respeitados** (por tomada e/ou diário, conforme cadastrado), inclusive com peso limite (dose fixa por tomada) e **reaplicados após o arredondamento**.
- Concentração na **mesma unidade da dose**, sem conversão automática.
- Unidade: texto livre com sugestões.
- Marcadores: `{dose}`, `{volume}`, `{dose_diaria}`, `{tomadas}` (valor com unidade).
- Peso: inteiro, sem mínimo/máximo definidos pelo usuário (ver pendências).
- Copiar: **apenas os itens**, com a alternativa escolhida no lugar do item (formato exato a confirmar na Fase 2).

### Backup (Fase 3)
- JSON com `formato` + `versaoFormato`; inclui itens na lixeira (para propagar exclusões).
- Conflito (mesmo id, conteúdo diferente): mostra os dois lados, **pré-seleciona o mais recente** (`atualizadoEm`).

### Calculadoras (Fase 4)
- Faixas fechadas `de ≤ x ≤ até`; lacunas detectadas respeitando casas decimais.
- Escore mostra **resultado parcial** enquanto há campos sem resposta.

### Modo pen drive (PCs do hospital com restrição)
- Build extra que gera **um único `.html`** aberto como arquivo (file://), levado em pen drive junto com o backup JSON.
- **Somente leitura**: no hospital só consulta e copia; edição apenas em casa (celular/PC pessoal).
- Importação de PDF por IA desativada nesse modo (chave de API nunca fica em PC do hospital).
- Biblioteca **salva no navegador do PC** (carregada do backup do pen drive; abre direto nas próximas vezes). Precisa de "atualizar biblioteca" (substituir pelo backup novo) e "apagar dados deste PC".
- Navegadores-alvo: desconhecidos → testar em Chrome, Edge e Firefox.
- Entra como **Fase 3b**, logo após o backup.

### IA (Fase 5)
- Chave de API no IndexedDB, nunca no backup, com botão para apagar.

## Pendências (perguntar ao usuário)

- Fase 2: confirmar peso só inteiro e sem limites (risco em neonatos/lactentes e erro de digitação); formato exato do texto copiado.
- Fase 4: o que significa "cadastrar medicações chaves de forma dinâmica" nas calculadoras.

## Comandos

```bash
npm run dev        # desenvolvimento (http://localhost:5173)
npm test           # testes (Vitest)
npm run build      # checagem de tipos + build de produção (dist/)
npm run preview    # serve o build (http://localhost:4173) — para testar PWA/offline
```
