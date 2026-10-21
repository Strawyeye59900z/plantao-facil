/**
 * Texto devolvido pelo @nova-consulta no Gemini. Os trechos entre ⟦ ⟧ são para conferir (doses,
 * durações, datas): o app destaca em negrito e tira os marcadores na hora de copiar.
 */

export interface SegmentoTexto {
  tipo: 'texto' | 'destaque'
  texto: string
}

const MARCADOR = /⟦([^⟧]*)⟧/g

/** Quebra o texto em segmentos normais e destacados. */
export function segmentar(texto: string): SegmentoTexto[] {
  const segmentos: SegmentoTexto[] = []
  let ultimo = 0
  for (const m of texto.matchAll(MARCADOR)) {
    const inicio = m.index ?? 0
    if (inicio > ultimo) segmentos.push({ tipo: 'texto', texto: texto.slice(ultimo, inicio) })
    segmentos.push({ tipo: 'destaque', texto: m[1] ?? '' })
    ultimo = inicio + m[0].length
  }
  if (ultimo < texto.length) segmentos.push({ tipo: 'texto', texto: texto.slice(ultimo) })
  return segmentos
}

/** Texto para o prontuário: sem os marcadores. */
export function textoLimpo(texto: string): string {
  return texto.replace(MARCADOR, '$1')
}

/**
 * Números que aparecem no texto revisado mas não na transcrição original.
 * Não bloqueia: é uma lista para você conferir (ex.: o texto pode ter formatado um número de outro jeito).
 */
export function numerosNaoEncontrados(transcricao: string, revisado: string): string[] {
  const noOriginal = new Set((transcricao.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/[.,]/g, '')))
  const vistos = new Set<string>()
  for (const n of revisado.match(/\d+(?:[.,]\d+)*/g) ?? []) {
    const normal = n.replace(/[.,]/g, '')
    if (!noOriginal.has(normal)) vistos.add(n)
  }
  return [...vistos]
}
