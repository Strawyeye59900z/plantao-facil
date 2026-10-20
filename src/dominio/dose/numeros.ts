/** Remove ruído de ponto flutuante (ex.: 0,1 × 3 = 0,30000000000000004). */
export function limpar(x: number): number {
  return Math.round(x * 1e9) / 1e9
}

/** Casas decimais que `formatarNumero` mostra (regras de dose e saídas não podem pedir mais). */
export const CASAS_MAXIMAS = 4

const formatador = new Intl.NumberFormat('pt-BR', { useGrouping: false, maximumFractionDigits: CASAS_MAXIMAS })

/** Vírgula decimal, sem separador de milhar, sem zeros sobrando: 2,5 · 300 · 1000. */
export function formatarNumero(x: number): string {
  return formatador.format(limpar(x))
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
