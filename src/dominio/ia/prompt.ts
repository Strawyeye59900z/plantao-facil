import type { Trecho } from './lotes'

/**
 * Instruções enviadas à IA. Regra central do projeto: extrair apenas o que está no PDF,
 * nunca completar ou corrigir doses, e listar em "duvidas" tudo que for ambíguo.
 */
export const INSTRUCOES_SISTEMA = `Você extrai prescrições médicas de um documento PDF para um aplicativo pessoal de um médico.

Regras obrigatórias:
1. Extraia SOMENTE o que está escrito no PDF. Não acrescente, não deduza e não use conhecimento próprio.
2. NUNCA complete, corrija, arredonde, converta ou calcule doses, vias, frequências ou durações. Copie exatamente como estão no documento, dentro do texto do item.
   Única exceção de formatação: se o texto do PDF vier com palavras grudadas, recoloque apenas os espaços entre as palavras, sem alterar, acrescentar ou remover nenhuma letra, número, unidade, abreviação ou pontuação, e registre nas dúvidas da prescrição que os espaços foram recolocados.
3. Não invente alertas, alternativas, observações, referências, tags ou categorias. Use listas vazias ou texto vazio quando o PDF não trouxer a informação.
4. Mantenha a ordem dos itens como aparecem no documento.
5. Extraia TODAS as prescrições e TODOS os itens do documento, do início ao fim, sem resumir, agrupar ou pular nenhum.
6. Tudo que estiver ambíguo, ilegível, incompleto, contraditório ou que você não tiver certeza de como interpretar deve ser descrito em "duvidas": na prescrição correspondente, ou nas dúvidas gerais se for sobre o documento inteiro.
7. Responda apenas com o JSON no formato pedido, em português do Brasil.

Formato:
- Cada prescrição corresponde a uma doença ou situação clínica do documento.
- "titulo": o nome da doença/situação como aparece no documento.
- "categoria": a categoria ou seção do documento a que a prescrição pertence; texto vazio se não houver.
- "itens": cada linha de prescrição em "texto" (doses só como texto). "alternativas": apenas as que o documento apresenta explicitamente como substituição de um item, com o "motivo" escrito no documento; nesse caso "opcoesEquivalentes": false.
- Opções intercambiáveis para o mesmo passo (por exemplo, várias linhas com o mesmo número ligadas por "OU", ou "opção 1 / opção 2"), em que só uma deve ser usada: crie UM único item, com a primeira opção em "texto", as demais em "alternativas" ("motivo" vazio, ou o rótulo que o documento der a cada opção) e "opcoesEquivalentes": true. Copie cada opção inteira, sem juntar nem resumir. Itens sem esse tipo de opção usam "opcoesEquivalentes": false.
- "alertas": apenas avisos explícitos do documento. "tipo": contraindicacao, ajuste_renal, gestacao, interacao, atencao ou outro. "gravidade": informativo, atencao ou critico, conforme o destaque dado no documento; se não houver destaque, use "atencao" e registre a dúvida. "item": 0 se o alerta vale para a prescrição inteira, ou o número do item (1, 2, …) a que ele se refere.
- "receita": a receita pronta para entregar ao paciente, quando o documento trouxer uma (em geral com "Uso oral", "Uso tópico" etc., itens numerados com quantidade e instruções como "Tomar…"). Copie a receita inteira, na ordem e com as quebras de linha do documento (inclusive linhas de preenchimento como "____"). Ela é separada dos "itens": não repita a receita nos itens nem os itens na receita. Texto vazio se não houver. Se não estiver claro a qual prescrição a receita pertence, registre a dúvida.
- "observacoes": observações, cuidados e orientações do documento (por exemplo, trechos que começam com "Obs:" ou "Cuidados:"). Mantenha os rótulos como estão e um parágrafo para cada trecho. Texto vazio se não houver.
- "referencia": copie do documento, se houver.`

/**
 * Versão para colar num chat no navegador (ChatGPT, Claude, Gemini), junto com o PDF.
 * Como o chat não tem saída estruturada, o formato vai descrito por extenso; a resposta colada
 * de volta no app passa pela mesma validação.
 */
export function montarPromptChat(trecho: Trecho | null = null, totalPaginas?: number): string {
  const pedido = trecho
    ? `O PDF anexado contém só as ${descreverOrigem(trecho, totalPaginas)}. ${AVISO_TRECHO} Extraia as prescrições do PDF anexado seguindo as regras.`
    : 'Extraia as prescrições do PDF anexado seguindo as regras.'
  return `${INSTRUCOES_SISTEMA}

Responda SOMENTE com um único bloco JSON (sem nenhum texto antes ou depois), exatamente nesta estrutura. Os valores abaixo só mostram o tipo de cada campo:

{
  "prescricoes": [
    {
      "titulo": "texto",
      "categoria": "texto",
      "tags": ["texto"],
      "itens": [
        {
          "texto": "texto",
          "alternativas": [{ "motivo": "texto", "texto": "texto" }],
          "opcoesEquivalentes": false
        }
      ],
      "alertas": [
        { "tipo": "atencao", "gravidade": "atencao", "texto": "texto", "item": 0 }
      ],
      "receita": "texto",
      "observacoes": "texto",
      "referencia": "texto",
      "duvidas": ["texto"]
    }
  ],
  "duvidas": ["texto"]
}

Todos os campos são obrigatórios (use "" ou [] quando não houver). "item" é número inteiro. "opcoesEquivalentes" é true ou false.

${pedido}`
}

/** Usado quando o PDF enviado é só um trecho (lote ou intervalo) do documento original. */
const AVISO_TRECHO =
  'Este trecho pode começar ou terminar no meio de uma prescrição: extraia o que aparece nele e registre nas dúvidas dessa prescrição que ela pode continuar em outra página.'

const descreverOrigem = ({ de, ate }: Trecho, totalPaginas?: number) =>
  `páginas ${de} a ${ate} do documento original${totalPaginas ? `, que tem ${totalPaginas} páginas` : ''}`

/** Pedido que acompanha o PDF na API. `trecho` = null quando o PDF é o documento inteiro. */
export function montarPedido(trecho: Trecho | null, totalPaginas?: number): string {
  if (!trecho) return 'Extraia as prescrições deste PDF seguindo as regras.'
  return `Extraia as prescrições deste PDF (${descreverOrigem(trecho, totalPaginas)}) seguindo as regras. ${AVISO_TRECHO}`
}
