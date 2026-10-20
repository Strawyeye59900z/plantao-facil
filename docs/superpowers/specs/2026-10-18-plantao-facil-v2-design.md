# Plantão Fácil 2 — Biblioteca de Prescrições — Design

Data: 18/10/2026

Onde: repositório do Plantão Fácil (`E:\Apps\My app`), numa **branch nova a partir de `main`** (`v2`). A decisão foi do usuário: evoluir o Plantão Fácil em vez de reescrever o app, para economizar tempo.

Mockups aprovados: `docs/superpowers/mockups/`. Os arquivos `tela-inicial.html` e `tela-prescricao-v2.html` são fragmentos e abrem sem o estilo da moldura. Os principais são `visual.html` (direção visual), `tela-inicial.html` (opção B), `tela-prescricao-v2.html` e `alertas-ou.html`.

## 1. Para quê e por quê

O usuário é médico e dá plantões em UPAs e UBSs. Ele precisa de uma **biblioteca pessoal de prescrições** que abra rápido, funcione sem internet e permita copiar a prescrição e a receita de alta para o sistema do serviço. Além das prescrições, a biblioteca guarda **calculadoras de dose** e **escalas** cadastradas por ele.

O Plantão Fácil (Vue 3 + PWA) já faz boa parte disso, e as regras dele estão no `CLAUDE.md` do repositório. O usuário deixou de gostar dele por cinco motivos:

- A tela da prescrição era **confusa**.
- As **observações eram difíceis de ler**.
- A **receita de alta** não ficava ao lado da lista de medicações.
- A **calculadora de dose embutida nos itens** da prescrição não era útil.
- A **importação por API** não funcionava.

A v2 mantém a base técnica e o que funcionava, refaz a experiência de uso e muda o modelo onde for preciso.

Sucesso, para o usuário: no meio do plantão, ele abre a prescrição certa em poucos toques, entende a tela de relance, marca as condições do paciente e copia a prescrição e a receita sem erro.

## 2. Objetivos, não-objetivos, anti-objetivos

**Objetivos**

- Funcionar 100% offline:
  - no celular (Android), como PWA;
  - no PC de casa;
  - no PC do hospital, por um **HTML no pendrive**.
- Navegação rápida, por grupos com ícones, com favoritos e busca instantânea.
- Tela de prescrição clara, com:
  - condições do paciente, que mostram ou escondem itens;
  - opções "OU";
  - alertas;
  - observações legíveis;
  - receita de alta lado a lado com a lista de medicações.
- Importação de PDFs grandes com uma IA qualquer, **pelo chat**, em lotes. Cada prescrição importada é revisada pelo usuário.
- Calculadoras e escalas cadastradas pelo usuário:
  - calculadoras de dose por peso e de fórmula livre;
  - escalas por pontos e por fórmula.
  - Elas ficam separadas das prescrições e são ligadas a elas.
- **Migrar a biblioteca existente**, tanto os dados que já estão no aparelho quanto os arquivos de backup antigos.

**Não-objetivos**

- Sincronização automática ou nuvem. A troca entre aparelhos é feita por arquivo.
- Chamada de API de IA. **Removida.**
- Regra de dose dentro dos itens da prescrição. **Removida**: os itens são texto.
- Dose "por dia ÷ tomadas", marcador `{tomadas}` e peso limite. **Removidos**, porque o usuário não usa.
- Recentes. **Removidos.**
- A IA importar calculadoras ou escalas.
- Conversão automática de unidades.
- Editar no PC do hospital.
- Login e uso por mais de uma pessoa.

**Anti-objetivos** (o app fracassa se acontecer):

- **Inventar conteúdo clínico**. Nenhuma dose, prescrição, escala ou texto médico pode vir pronto. Nos testes, usar apenas dados fictícios óbvios ("Medicamento Teste A"). A IA da importação só transcreve.
- **Salvar dado de paciente**. Peso e entradas das calculadoras vivem só na memória da tela.
- A tela da prescrição voltar a ser confusa.
- Copiar uma prescrição com item "OU" sem que o usuário tenha escolhido a opção.
- **Perder dados na migração**: tudo o que existia na v1 precisa aparecer na v2.

## 3. Restrições

- Valem as **regras de trabalho do `CLAUDE.md`**:
  - não inventar conteúdo clínico;
  - perguntar antes de decidir o que não está definido;
  - trabalhar por fases e parar para aprovação;
  - consultar a documentação atual das bibliotecas;
  - manter o `CLAUDE.md` atualizado;
  - interface em pt-BR.
- Sem recursos externos em tempo de execução. Fontes e ícones vão embutidos.
- Navegadores-alvo:
  - Android: Chrome.
  - PC: Chrome e Edge (Windows). O HTML do pendrive deve funcionar também no Firefox.
- O PC do hospital é **somente consulta**. **Nada pode ficar gravado nele.**
- Unidades do sistema métrico, só como rótulo.
- Mobile-first, com alvos de toque de pelo menos 44 px.

## 4. Decisões do usuário

### 4.1 Aparelhos e dados

- Cada aparelho (celular, PC de casa) guarda **a própria cópia** da biblioteca.
- A troca entre aparelhos é feita por **arquivo exportado**: o usuário exporta num aparelho e importa no outro.
- **PC da UPA: apenas consulta e cópia.**
- **Pendrive:**
  - A exportação gera **um único arquivo `.js`**. Por dentro é o JSON da biblioteca, com uma linha de atribuição no começo, por exemplo `window.BIBLIOTECA = {...}`.
  - O HTML do pendrive carrega esse arquivo com `<script src>`, o que funciona em `file://`.
  - Basta dar dois cliques para abrir com a biblioteca mais recente. **Nada é salvo no PC.**
  - O celular e o PC de casa importam **esse mesmo arquivo**.
  - Isso substitui o modo pen drive da v1, que guardava a biblioteca no IndexedDB do PC.

### 4.2 Tela da prescrição

Layout aprovado: opção "C" ajustada, no visual novo.

- **Cabeçalho:**
  - título grande;
  - grupo;
  - estrela de favorito;
  - abas em pílula: **Prescrição** | **Calculadoras · N**. A aba Calculadoras só aparece se houver calculadoras ou escalas ligadas à prescrição.
- **Coluna principal**, de cima para baixo:
  1. **Alertas da prescrição inteira**, em caixas coloridas. Vermelho para grave (contraindicação). Âmbar para atenção.
  2. **"O paciente tem…"**: condições em botões-pílula. **Nenhuma vem marcada.** Várias podem ser marcadas.
  3. **Lista numerada de itens.** Os itens "sempre" aparecem sempre. Os itens de uma condição **só aparecem quando ela está marcada**, entram na lista e são renumerados.
  4. **Item "OU":** as opções aparecem empilhadas para tocar em uma, com o motivo opcional ao lado.
     - **Nenhuma opção vem marcada.**
     - O **Copiar fica bloqueado até o usuário escolher**, com uma mensagem dizendo qual item falta.
  5. Botão **Copiar prescrição**.
  6. **Observações** no **fim da prescrição**:
     - sempre visíveis;
     - em destaque, numa caixa tingida de âmbar;
     - um parágrafo por observação, mantendo o rótulo ("Obs:", "Bizu:", "Cuidados:").
- **Coluna lateral (PC/tablet):** **Receita de alta**, na mesma altura da lista de itens, com o botão próprio **Copiar receita**.
- **Celular:** a receita vira **uma aba própria** (Prescrição | Receita | Calculadoras).
- **Calculadoras e escalas ligadas** à prescrição ficam na aba Calculadoras.

### 4.3 Navegação e tela inicial

Opção "B" aprovada:

- No topo, três áreas em pílula: **Prescrições, Calculadoras, Escalas**. Junto delas fica a **busca**, que ignora acentos e mostra resultados enquanto o usuário digita.
- **No PC:** os grupos ficam numa **lateral fixa**, nesta ordem: **★ Favoritos**, **Todas**, e depois cada grupo com **ícone** e contagem. A lista do grupo selecionado fica à direita, em cartões.
- **No celular:** os grupos viram uma fileira de pílulas com ícone, que desliza para o lado. Os favoritos ficam na primeira pílula.
- Calculadoras e Escalas usam a mesma estrutura.

### 4.4 Visual

Uma direção nova, que **substitui** o visual atual da v1 (neutros quentes, terracota, Inter):

- fundo cinza-azulado claro;
- cartões brancos bem arredondados, com raio de cerca de 22 px;
- navegação e botões em pílula;
- ícones dentro de quadrados e círculos suaves;
- títulos grandes e fortes;
- bastante respiro;
- fonte Plus Jakarta Sans, embutida (OFL).

**Cor de destaque:** o usuário escolhe nos Ajustes entre azul, coral, verde-água e violeta. **O padrão é o verde-água (`#0f9d8a`).**

### 4.5 Importação com IA

- **Só pelo chat.** Tudo que é de API sai do app:
  - provedores;
  - chaves;
  - envio.
- O arquivo de entrada é um PDF, dividido em **lotes de 10 páginas** que repetem a última página do lote anterior. O fluxo de lotes da v1 continua: para cada lote, **Baixar PDF do lote**, **Copiar prompt**, colar a resposta e, se precisar, **Dividir em 2**.
- **Grupos:**
  - O prompt leva os grupos existentes, e a IA **tenta sempre encaixar** cada prescrição num deles.
  - Se nenhum servir, a IA **pode sugerir um grupo novo**, que aparece marcado como "novo". Na v1, o que não encaixava ia para "Sem categoria".
  - Na revisão, o usuário pode trocar o grupo.
- **Cada prescrição importada é revisada pelo usuário**, que pode editar, trocar o grupo, aprovar ou descartar.
- A IA extrai:
  - itens;
  - condições;
  - opções "OU";
  - alertas;
  - observações, mantendo os rótulos;
  - receita de alta.
- A IA só transcreve e registra as dúvidas.
- Calculadoras e escalas **não** são importadas.

### 4.6 Calculadoras de dose

**Tipo 1 — Doses por peso** (ex.: drogas de IOT):

- O usuário digita **só o peso**. A tela mostra linhas de texto escritas por ele.
- Cada linha pode ter **várias doses calculadas**, cada uma com a sua regra. Exemplo: "Midazolam {inducao} na indução e {manutencao} na manutenção".
- **Sem peso**, a dose aparece como **a regra** ("1 mg/kg"). **Com peso** (70 kg), aparece o valor ("70 mg").
- **Dose máxima:** se o valor calculado passar dela, **mostrar a dose máxima** com o aviso "limitada à dose máxima".
- A dose é sempre **por tomada**. Não existe "por dia ÷ tomadas".

**Tipo 2 — Fórmula livre** (ex.: noradrenalina):

- O usuário **cria os próprios campos** (nome, tipo número ou sim/não, unidade).
- Ele **escreve a própria fórmula**. Exemplo: `dose = vazão * concentração / peso`.

**Unidades:** do sistema métrico, só como rótulo. Se a fórmula precisa converter, a conversão vai na própria fórmula.

### 4.7 Escalas

- **Por pontos:** perguntas com opções, cada opção com um valor. O app soma.
- **Por fórmula:** mesmo motor da fórmula livre. Os campos podem ser sim/não ou número.
- As duas têm **faixas de resultado com texto**. O app mostra o total e o significado.

### 4.8 Migração da v1

**Obrigatória.**

- Os dados que já estão no aparelho são migrados **automaticamente**, numa nova versão do Dexie.
- **Importar** também aceita os arquivos de backup antigos da v1 e os converte.
- Itens que tinham **dose calculada no texto** (`{dose}`, `{volume}`, `{dose_diaria}`, `{tomadas}`):
  - passam a ser texto puro, com **a regra cadastrada escrita no lugar do marcador**. Exemplo: `{dose}` vira "10 mg/kg (máx. 500 mg)". O formato exato é escolha de quem constrói, mas tem que conter todos os números da regra;
  - a prescrição fica marcada como **"importada — revisar"**, para o usuário conferir.

## 5. Decisões minhas (o usuário pode revisar)

### 5.1 Base técnica

- Fica a stack atual do Plantão Fácil (veja o `CLAUDE.md`): Vue 3, TS, Vite, Tailwind v4, shadcn-vue, Dexie, valibot, mathjs restrito, pdf-lib, vite-plugin-pwa e vite-plugin-singlefile.
- **Reaproveitar:**
  - domínio de busca;
  - lotes de PDF;
  - leitura da resposta da IA;
  - motores de fórmula, pontos e faixas;
  - backup (validação, mesclagem com conflitos);
  - lixeira;
  - grupos (as categorias da v1) e a galeria de ícones.
- **Refazer:**
  - o tema e os tokens;
  - o layout do app (topo com áreas em pílula e lateral de grupos);
  - a tela da prescrição e o editor da prescrição;
  - a tela de importação, sem API;
  - o modo pendrive;
  - a separação entre Calculadoras e Escalas.
- **Remover:**
  - provedores de IA, chaves e envio por API;
  - o motor de dose dos itens (`src/dominio/dose/`, que pode ser aproveitado para a calculadora por peso);
  - os recentes.

### 5.2 Builds

- **PWA:** continua publicado no GitHub Pages atual. **Publicar a v2 em `main` só com a aprovação do usuário**, porque o celular dele usa esse endereço.
- **Pendrive:** `npm run build:pendrive` gera um único `.html`, que carrega `biblioteca.js` da mesma pasta.
  - Se o arquivo não existir, mostra uma tela explicando como colocá-lo no pendrive.
  - É somente leitura.
  - **Não grava nada**: nem IndexedDB, nem localStorage. A cor de destaque vem do arquivo.

### 5.3 Exportar e importar

- **Exportar** gera `biblioteca.js`, que contém `window.BIBLIOTECA = <JSON>;`.
  - O JSON tem `formato` e `versaoFormato: 2`.
  - Inclui grupos, prescrições, calculadoras, escalas, a lixeira, os favoritos e a cor de destaque.
  - No Android, oferecer também "Compartilhar".
- **Importar** aceita:
  - `.js` (o app remove o prefixo);
  - `.json` da v2;
  - **backups da v1** (`versaoFormato: 1`), que são convertidos conforme a seção 4.8.
- **Mesclar e Substituir:** reaproveitar a lógica da v1, adaptada ao formato novo.
  - Na pré-visualização, mostrar o que é novo, o que é igual e o que está em conflito.
  - Em conflito, vem pré-selecionado o mais recente.
  - Antes de substituir, oferecer um backup.

### 5.4 Copiar

- **Copiar prescrição:**
  - leva os itens visíveis, com a opção "OU" escolhida;
  - numerados ("1. …"), um por linha;
  - não leva alertas, observações nem receita.
- **Copiar receita:** leva o texto exatamente como foi cadastrado.

### 5.5 Calculadora por peso: detalhes

- A regra de cada marcador tem:
  - dose por kg, com valor e unidade;
  - **concentração** opcional, sempre na unidade da dose por mL. Com ela, o app mostra também o volume em mL;
  - dose máxima opcional (veja 4.6);
  - casas decimais.
- Peso com até uma casa decimal, só em memória.
- Números com vírgula decimal.
- O editor tem uma área para testar a calculadora com um peso.

### 5.6 Fórmula e escalas: detalhes

- **Campos:**
  - número, com mínimo e máximo opcionais;
  - sim/não, com o valor do "sim" e do "não" editáveis (padrões 1 e 0).
- **Resultados:** uma calculadora de fórmula pode ter **um ou mais resultados**, cada um com nome, fórmula, unidade, casas decimais e faixas.
- O que a fórmula aceita é o mesmo da v1.
- A escala por pontos mostra o resultado parcial enquanto houver pergunta sem resposta.
- **Faixas:** seguem as regras da v1. Lacunas e sobreposições só geram aviso.
- **Migração das calculadoras da v1:**
  - as de pontos viram **Escalas por pontos**;
  - as de fórmula viram **Calculadoras de fórmula**;
  - o grupo é recriado na área de destino quando necessário.

### 5.7 Prescrição: outras escolhas

- **Alerta de item:**
  - aparece como etiqueta com o tipo ("⚠ Gestação");
  - **logo abaixo do item, aparece o texto completo** numa linha pequena tingida. Uma contraindicação nunca fica escondida atrás de um toque;
  - o tipo vem da lista fixa da v1.
- **"OU" na migração:** os itens da v1 que tinham alternativas por motivo, como a lista "Padrão / se alergia…", viram itens "OU". Com isso, a v2 passa a exigir a escolha.
- **Ligação com calculadoras e escalas:** muitos para muitos, configurada no editor da prescrição.
- **Favoritos:** estrela na prescrição, na calculadora e na escala. Entram na exportação.
- **Tags:** as da v1 continuam no modelo e na busca.
- **Lixeira, revisão e duplicatas:** a lixeira, o status "importada — revisar" e o aviso de possível duplicata continuam como na v1.
- **Tema escuro:** opcional nos Ajustes, com o claro como padrão.

## 6. Modelo de dados v2 (esboço)

Todas as entidades têm `id`, `criadoEm`, `atualizadoEm` e `excluidoEm?`.

```
Grupo        { area: 'prescricao'|'calculadora'|'escala', nome, icone, ordem }   (era Categoria/escopo)

Prescricao   { titulo, grupoId|null, tags, favorito, condicoes: Condicao[], itens: Item[],
               alertas: Alerta[], observacoes, receita, calculadoraIds, escalaIds,
               referencia, origem, revisada, duvidasImportacao }
Item         { id, condicaoId|null, opcoes: Opcao[] }      (1 opção = simples; ≥2 = "OU")
Opcao        { id, texto, motivo? }
Alerta       { id, tipo, gravidade, texto, itemId|null }

Calculadora  { nome, grupoId|null, favorito, tipo: 'dosePeso'|'formula', descricao?,
               linhas?: { texto, regras: { marcador, dosePorKg, unidade, concentracao?, doseMaxima?, casas } }[],
               campos?, resultados? }
Escala       { nome, grupoId|null, favorito, tipo: 'pontos'|'formula', perguntas?, campos?, formula?, faixas }
Campo        { id, nome, variavel, tipo: 'numero'|'simNao', unidade?, min?, max?, valorSim?, valorNao? }
Resultado    { nome, formula, unidade?, casas, faixas }
Faixa        { de|null, ate|null, texto }

Arquivo      { formato, versaoFormato: 2, exportadoEm, corDestaque, grupos, prescricoes, calculadoras, escalas }
```

## 7. Fica a critério de quem constrói

- A divisão em fases. Sugestão:
  1. modelo, migração e importação de backups v1;
  2. visual e navegação;
  3. tela e editor da prescrição;
  4. calculadoras e escalas;
  5. importação sem API;
  6. pendrive.
- O nome da branch, se não for `v2`, e o nome final do app.
- A redação do prompt e o esquema da resposta da IA, respeitando a seção 4.5.
- O layout do editor e da tela de revisão, seguindo a mesma clareza e o mesmo visual.
- Estados vazios, mensagens e textos de ajuda, em pt-BR.
- A atualização do `CLAUDE.md`, que acompanha cada fase.
