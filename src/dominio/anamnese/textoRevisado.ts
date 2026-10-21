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

export type TipoDestaque = 'incompreensivel' | 'importante'

export interface TrechoDestacado {
  tipo: 'texto' | TipoDestaque
  texto: string
}

const NUMERO_EXTENSO = 'um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|quinze|vinte|trinta|alguns|algumas|v[aá]rios|v[aá]rias'
const UNIDADE_TEMPO = 'dias?|semanas?|mes(?:es)?|m[eê]s|anos?|horas?|minutos?'
const UNIDADE_DOSE = 'mg|mcg|µg|ug|g|kg|ml|mL|UI|U|gotas?|comprimidos?|cp|ampolas?|c[aá]psulas?|puffs?|%'

/** Ordem importa: o primeiro padrão que cobre um trecho vence. */
const PADROES: { tipo: TipoDestaque; regex: RegExp }[] = [
  { tipo: 'incompreensivel', regex: /\[incompreens[ií]vel\]|\(\?\)/gi },
  { tipo: 'importante', regex: /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?!\d)/g }, // datas
  { tipo: 'importante', regex: new RegExp(String.raw`(?<![\w])\d+(?:[.,]\d+)?\s?(?:${UNIDADE_DOSE})(?![\wÀ-ÿ])(?:\s?/\s?[a-zA-Z]+)?`, 'g') }, // doses
  {
    tipo: 'importante', // durações e início dos sintomas
    regex: new RegExp(
      String.raw`\b(?:h[aá]|por|durante|desde|faz|fazem|h[aá] cerca de|h[aá] aproximadamente)\s+(?:(?:\d+|${NUMERO_EXTENSO})\s+(?:${UNIDADE_TEMPO})|ontem(?:\s+[àa]\s+noite)?|hoje|anteontem|a\s+(?:noite|manh[ãa]|tarde))(?![\wÀ-ÿ])` +
        String.raw`|\b(?:\d+|${NUMERO_EXTENSO})\s+(?:${UNIDADE_TEMPO})(?![\wÀ-ÿ])`,
      'gi',
    ),
  },
]

/** Marca o que merece conferência: trechos incompreensíveis e datas, doses e durações. */
export function destacar(texto: string): TrechoDestacado[] {
  const achados: { inicio: number; fim: number; tipo: TipoDestaque }[] = []
  for (const { tipo, regex } of PADROES) {
    for (const m of texto.matchAll(regex)) {
      const inicio = m.index ?? 0
      const fim = inicio + m[0].length
      if (!achados.some((a) => inicio < a.fim && fim > a.inicio)) achados.push({ inicio, fim, tipo })
    }
  }
  achados.sort((a, b) => a.inicio - b.inicio)
  const trechos: TrechoDestacado[] = []
  let ultimo = 0
  for (const a of achados) {
    if (a.inicio > ultimo) trechos.push({ tipo: 'texto', texto: texto.slice(ultimo, a.inicio) })
    trechos.push({ tipo: a.tipo, texto: texto.slice(a.inicio, a.fim) })
    ultimo = a.fim
  }
  if (ultimo < texto.length) trechos.push({ tipo: 'texto', texto: texto.slice(ultimo) })
  return trechos
}
