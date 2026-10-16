/** Trecho de páginas do documento original (1-based, inclusivo). */
export interface Trecho {
  de: number
  ate: number
}

/** Páginas novas por lote (decisão do usuário: fixo). */
export const PAGINAS_POR_LOTE = 10

/**
 * Divide o intervalo em lotes de `tamanho` páginas novas. A partir do 2º, cada lote repete a última
 * página do anterior, para não perder prescrição que atravessa a divisa (ex.: 1–10, 10–20, 20–30).
 */
export function dividirEmLotes(de: number, ate: number, tamanho = PAGINAS_POR_LOTE): Trecho[] {
  if (!Number.isInteger(de) || !Number.isInteger(ate) || de < 1 || de > ate || tamanho < 1) {
    throw new Error('Intervalo de páginas inválido.')
  }
  const lotes: Trecho[] = [{ de, ate: Math.min(ate, de + tamanho - 1) }]
  let ultimo = lotes[0]!
  while (ultimo.ate < ate) {
    ultimo = { de: ultimo.ate, ate: Math.min(ate, ultimo.ate + tamanho) }
    lotes.push(ultimo)
  }
  return lotes
}

/**
 * Divide um lote em dois (resposta cortada por tamanho), repetindo a página do meio.
 * null = lote de 1 página, não dá para dividir.
 */
export function dividirTrecho({ de, ate }: Trecho): [Trecho, Trecho] | null {
  if (ate - de < 1) return null
  if (ate - de === 1) return [{ de, ate: de }, { de: ate, ate }]
  const meio = Math.floor((de + ate) / 2)
  return [{ de, ate: meio }, { de: meio, ate }]
}

/** "página 5" / "páginas 10–20". */
export function descreverTrecho({ de, ate }: Trecho): string {
  return de === ate ? `página ${de}` : `páginas ${de}–${ate}`
}

/** Nome do PDF de um lote para baixar (modo chat): "protocolo - paginas 10-20.pdf". */
export function nomeArquivoLote(nomeOriginal: string, { de, ate }: Trecho): string {
  const base = nomeOriginal.replace(/\.pdf$/i, '').trim() || 'documento'
  return `${base} - ${de === ate ? `pagina ${de}` : `paginas ${de}-${ate}`}.pdf`
}
