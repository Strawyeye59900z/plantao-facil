# Sistema de design — Plantão Fácil v2 (rascunho para aprovação)

Data: 20/10/2026. Status: **direção visual aprovada (20/10/2026)**; textos da seção 7 aprovados nas telas de prescrição; tela inicial e modo consulta em aplicação.

Decisões de aprovação: cor padrão verde-água (`#0f9d8a`) escolhível nos Ajustes; prioridade: prescrições, depois modo consulta.

## 1. Direção aprovada até aqui

Já aprovada na Fase 1: fundo cinza-azulado claro, cartões brancos bem arredondados, botões e áreas em pílula, títulos grandes e fortes, ícones em quadrados/círculos suaves, cor de destaque escolhida pelo usuário (padrão verde-água `#0f9d8a`).

## 2. Auditoria de consistência (medida no navegador, 375 px e 1280 px)

| Tela | Achado | Gravidade |
|---|---|---|
| Topo (todas) | Rótulos das áreas com 11 px ("Prescrições", "Calculadoras", "Escalas") | Média: abaixo do mínimo confortável para leitura à distância de um braço |
| Importação | Link "Alterar em Ajustes" com 18 px de altura | Alta: alvo de toque menor que 44 px |
| Prescrição | Rótulo "O PACIENTE TEM…" muito pequeno e cinza | Média |
| Prescrição | Observações em caixa âmbar sem título forte | Baixa |
| Editor | Textos de ajuda longos e densos ocupam muito do celular | Média |
| Lista | Muito espaço vazio no PC; cartão único fica pequeno | Baixa |
| Importação | Ainda mostra a opção por API (será removida na Fase 4 do plano de importação) | Planejado |

## 3. Tokens (valores propostos)

- **Cores (claro):** fundo `#eef1f6`, cartão `#ffffff`, texto `#151a2d`, texto secundário `#5b6378` (sobe de `#7b8297` para contraste ≥ 4,5:1 sobre branco), borda `#d8deea`.
- **Cores de estado:** crítico `#9b1c1c` sobre `#fdecec`; atenção `#7a4d00` sobre `#fff4dc`; observações `#7a5d00` sobre `#fff8e1`; informativo azul-acinzentado.
- **Destaque:** azul `#2f5bea`, coral `#ef5b5b`, verde-água `#0f9d8a` (padrão), violeta `#6d4fe0`. Texto sobre o destaque: branco em negrito. Coral e verde-água ficam perto de 3,5:1: uso reservado a botões grandes e textos em negrito.
- **Tipografia:** Plus Jakarta Sans embutida. Escala: 12 (rótulo, mínimo), 14 (apoio), 16 (corpo), 18 (itens), 22 (títulos de seção), 28+ (títulos de tela). **Nada abaixo de 12 px.** Rótulos em caixa-alta foram substituídos por texto normal em negrito pequeno, para melhorar a leitura.
- **Espaçamento:** múltiplos de 4 px. Padding de cartão 16 px (celular) e 20 px (PC).
- **Raio:** cartão 22 px, pílula 99 px, campo 14 px.
- **Sombra:** nenhuma (regra da v1 mantida).
- **Alvo de toque:** mínimo 44 × 44 px em todo elemento clicável, em qualquer largura.

## 4. Componentes

| Componente | Estados obrigatórios | Acessibilidade |
|---|---|---|
| Área (pílula do topo) | normal, ativa, foco | `aria-current` na ativa; 44 px de altura |
| Botão primário | normal, foco, desativado, carregando | texto de ação explícito |
| Botão secundário / fantasma | normal, foco, desativado | — |
| Cartão de item | normal, favorito, importada-a-revisar | o título é o link principal |
| Lateral de grupos | normal, ativo, vazio | `aria-current`; ícone sempre com rótulo textual |
| Item de prescrição | sempre, condicional marcada, condicional desmarcada | condição é botão com `aria-pressed` |
| Opção "OU" | nenhuma escolhida, escolhida, faltando escolha | grupo de rádio com legenda |
| Alerta | crítico, atenção, informativo | cor **e** texto de gravidade (não só cor) |
| Campo numérico | normal, erro, vazio | `inputmode="decimal"`; erro com `aria-describedby` |
| Barra de ação flutuante | Salvar/Copiar, desativado com motivo | o motivo aparece perto do botão |

## 5. Padrões de tela (resumo)

- **Lista:** busca no topo, grupos à esquerda (PC) ou em pílulas (celular), cartões em grade.
- **Prescrição:** título, grupo, condições, itens numerados, observações, receita ao lado (PC) ou em aba (celular).
- **Editor:** um cartão por seção, ajuda curta sempre visível, erros no topo após a primeira tentativa.
- **Importação:** passos numerados visíveis (1 arquivo, 2 lotes, 3 revisão), com o texto do que fazer em cada lote.
- **Calculadora e escala:** campos de entrada no topo, resultado grande, memória de cálculo recolhida.
- **Modo consulta (anamnese):** ampulheta e tempo grandes, lembretes em pílulas, sem texto de menu.

## 6. Crítica de usabilidade (prioridades)

1. **Alvo de toque no link de importação (18 px).** Transformar em botão de 44 px.
2. **Rótulos de área em 11 px.** Subir para 12 px e rever o peso.
3. **Rótulo "O PACIENTE TEM…".** Trocar por texto normal em negrito, 14 px.
4. **Editor com ajuda densa no celular.** Mostrar só a primeira frase de ajuda; o resto em "Saiba mais".
5. **Lista vazia no PC.** Aproveitar o espaço com a grade de grupos.

## 7. Textos (UX copy) — exemplos propostos

| Hoje | Proposto | Motivo |
|---|---|---|
| "Buscar prescrição…" | "Buscar prescrição, grupo ou medicação" | cobre o que realmente se busca |
| "Copiar prescrição" | "Copiar prescrição" (mantido) | ação clara |
| "Escolha uma opção no item N" | "Falta escolher uma opção no item N" | diz o que falta, sem jargão |
| "Marque uma condição para copiar." | "Marque a condição do paciente para copiar." | mais concreto |
| "Importada — não revisada" | "Revisar antes de usar" | ação, não estado |

## 8. Decisões de aprovação

- Direção visual aprovada.
- Verde-água como padrão.
- Prioridade: prescrições e modo consulta.
- Modo consulta mantém o fundo escuro da referência enviada pelo Gabriel, por ser usado durante a consulta.
- Rótulo da lista de lembretes: "Perguntar ainda" (a referência dizia "Não esquecer"); pendente de confirmação.

## 9. Perguntas em aberto (históricas)

1. Você aprova a direção visual acima (cores, tamanhos, pílulas)?
2. O tamanho mínimo de texto de 12 px serve para o seu uso na UPA?
3. Quer manter o destaque padrão verde-água ou prefere outra cor como padrão?
4. Os textos propostos na seção 7 estão no tom certo?
5. Quais telas devo levar primeiro para mockup de aprovação: lista, prescrição ou modo consulta?
