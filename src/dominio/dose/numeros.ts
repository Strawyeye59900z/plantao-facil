import type { ArredondamentoDose, ArredondamentoVolume, DirecaoArredondamento } from '@/dominio/tipos'

/** Remove ruído de ponto flutuante (ex.: 0,1 × 3 = 0,30000000000000004). */
export function limpar(x: number): number {
  return Math.round(x * 1e9) / 1e9
}

const FUNCAO: Record<DirecaoArredondamento, (x: number) => number> = {
  baixo: Math.floor,
  proximo: Math.round,
  cima: Math.ceil,
}

function multiplo(x: number, passo: number, direcao: DirecaoArredondamento): number {
  return limpar(passo * FUNCAO[direcao](limpar(x / passo)))
}

function casas(x: number, n: number, direcao: DirecaoArredondamento): number {
  const fator = 10 ** n
  return limpar(FUNCAO[direcao](limpar(x * fator)) / fator)
}

export function arredondarDose(x: number, a: ArredondamentoDose): number {
  return a.modo === 'inteiro' ? Math.round(limpar(x)) : multiplo(x, a.passo, a.direcao)
}

/** Maior valor ≤ x que respeita a regra (usado depois de aplicar um teto). */
export function ajustarDoseParaBaixo(x: number, a: ArredondamentoDose): number {
  return a.modo === 'inteiro' ? Math.floor(limpar(x)) : multiplo(x, a.passo, 'baixo')
}

export function doseRespeitaArredondamento(x: number, a: ArredondamentoDose): boolean {
  return ajustarDoseParaBaixo(x, a) === limpar(x)
}

export function arredondarVolume(x: number, a: ArredondamentoVolume): number {
  return a.modo === 'casas_decimais' ? casas(x, a.casas, 'proximo') : multiplo(x, a.passo, a.direcao)
}

export function ajustarVolumeParaBaixo(x: number, a: ArredondamentoVolume): number {
  return a.modo === 'casas_decimais' ? casas(x, a.casas, 'baixo') : multiplo(x, a.passo, 'baixo')
}

const formatador = new Intl.NumberFormat('pt-BR', { useGrouping: false, maximumFractionDigits: 4 })

/** Vírgula decimal, sem separador de milhar, sem zeros sobrando: 2,5 · 300 · 1000. */
export function formatarNumero(x: number): string {
  return formatador.format(limpar(x))
}

/** Para valores intermediários da memória de cálculo: até 2 casas, com "≈" quando corta. */
export function formatarIntermediario(x: number): string {
  const curto = Math.round(x * 100) / 100
  return `${limpar(curto) === limpar(x) ? '' : '≈ '}${formatarNumero(curto)}`
}

export function descreverArredondamentoDose(a: ArredondamentoDose): string {
  if (a.modo === 'inteiro') return 'inteiro mais próximo'
  return `múltiplo de ${formatarNumero(a.passo)} (${ROTULO_DIRECAO[a.direcao]})`
}

export function descreverArredondamentoVolume(a: ArredondamentoVolume): string {
  if (a.modo === 'casas_decimais') {
    return a.casas === 0 ? 'inteiro mais próximo' : `${a.casas} ${a.casas === 1 ? 'casa decimal' : 'casas decimais'}`
  }
  return `múltiplo de ${formatarNumero(a.passo)} (${ROTULO_DIRECAO[a.direcao]})`
}

export const ROTULO_DIRECAO: Record<DirecaoArredondamento, string> = {
  baixo: 'para baixo',
  proximo: 'mais próximo',
  cima: 'para cima',
}

/**
 * Lê número digitado (aceita vírgula ou ponto). Vazio → null. Inválido → NaN.
 */
export function lerNumero(texto: string): number | null {
  const t = texto.trim().replace(',', '.')
  if (t === '') return null
  if (!/^-?\d+(\.\d+)?$/.test(t)) return Number.NaN
  return Number(t)
}
