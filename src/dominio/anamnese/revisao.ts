/**
 * Revisão da transcrição por IA de chat (Gemini, colado pelo usuário).
 * A IA corrige só a grafia, marca doses/durações/datas em negrito e dúvidas em amarelo.
 * Trava: se a resposta alterar qualquer número, ela é recusada.
 */

export type TipoSegmento = 'texto' | 'destaque' | 'duvida'

export interface SegmentoRevisao {
  tipo: TipoSegmento
  texto: string
}

export interface RevisaoTranscricao {
  segmentos: SegmentoRevisao[]
  mudancas: { original: string; corrigido: string }[]
}

export const INSTRUCOES_REVISAO = `Você revisa a transcrição de uma consulta médica em português do Brasil. A transcrição veio de reconhecimento de voz e pode ter palavras mal reconhecidas. Não há identificação de quem fala.

Regras obrigatórias:
1. Corrija SOMENTE a grafia de palavras que claramente foram mal reconhecidas, usando o contexto. Não reescreva frases, não resuma e não mude a ordem.
2. NUNCA altere números, doses, unidades, durações ou datas. Copie exatamente como estão.
3. NUNCA acrescente informação, não faça hipóteses diagnósticas e não complete o que não foi dito.
4. Nome de medicamento ou de doença só é corrigido quando houver certeza pelo contexto. Na dúvida, mantenha como foi dito e marque como "duvida".
5. Marque como "destaque" (negrito) o texto exato de: doses (com unidade), durações de sintomas (ex.: "há 3 dias"), e datas importantes.
6. Marque como "duvida" trechos incompreensíveis, ambíguos ou com possível erro de reconhecimento, mantendo o texto original neles.

Responda somente com JSON neste formato, sem nenhum texto antes ou depois:
{
  "segmentos": [ { "tipo": "texto" | "destaque" | "duvida", "texto": "..." } ],
  "mudancas": [ { "original": "...", "corrigido": "..." } ]
}
A concatenação de todos os "texto" dos segmentos, na ordem, deve formar a transcrição inteira, já com as correções. Cada "mudanca" deve aparecer também nos segmentos.`

/** Prompt completo para colar no chat: regras + transcrição. */
export function montarPromptRevisao(transcricao: string): string {
  return `${INSTRUCOES_REVISAO}\n\nTranscrição:\n"""\n${transcricao}\n"""`
}

/** Números do texto (inteiros e decimais), normalizados com ponto. */
export function numerosDoTexto(texto: string): string[] {
  return (texto.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/\./g, '').replace(',', '.'))
}

/**
 * Extrai o JSON da resposta colada. Aceita cercas ```json e texto antes/depois.
 * Devolve null se não houver JSON.
 */
export function extrairJson(resposta: string): unknown {
  const limpo = resposta.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const inicio = limpo.indexOf('{')
  const fim = limpo.lastIndexOf('}')
  if (inicio === -1 || fim <= inicio) return null
  try {
    return JSON.parse(limpo.slice(inicio, fim + 1))
  } catch {
    return null
  }
}

export type ResultadoValidacao = { ok: true; revisao: RevisaoTranscricao } | { ok: false; motivo: string }

/** Confere o formato da resposta e a trava de números contra a transcrição original. */
export function validarRevisao(original: string, bruto: unknown): ResultadoValidacao {
  const dados = bruto as { segmentos?: unknown; mudancas?: unknown } | null
  if (!dados || !Array.isArray(dados.segmentos) || dados.segmentos.length === 0) {
    return { ok: false, motivo: 'A resposta não tem os segmentos da revisão.' }
  }
  const tipos = new Set<string>(['texto', 'destaque', 'duvida'])
  const segmentos: SegmentoRevisao[] = []
  for (const s of dados.segmentos as { tipo?: unknown; texto?: unknown }[]) {
    if (!s || typeof s.tipo !== 'string' || !tipos.has(s.tipo) || typeof s.texto !== 'string') {
      return { ok: false, motivo: 'Um dos segmentos da resposta está fora do formato.' }
    }
    segmentos.push({ tipo: s.tipo as TipoSegmento, texto: s.texto })
  }
  const mudancas = Array.isArray(dados.mudancas)
    ? (dados.mudancas as { original?: unknown; corrigido?: unknown }[]).filter(
        (m) => typeof m?.original === 'string' && typeof m?.corrigido === 'string',
      ) as { original: string; corrigido: string }[]
    : []

  // Trava: a IA não pode criar nem alterar números (comparação de multiconjunto).
  const entrada = numerosDoTexto(original).sort()
  const saida = numerosDoTexto(segmentos.map((s) => s.texto).join('')).sort()
  if (entrada.length !== saida.length || entrada.some((n, i) => n !== saida[i])) {
    return { ok: false, motivo: 'A IA alterou números. Use o texto original e tente de novo.' }
  }
  return { ok: true, revisao: { segmentos, mudancas } }
}
