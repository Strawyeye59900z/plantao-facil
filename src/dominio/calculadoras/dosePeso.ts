import type { LinhaDosePeso, RegraDosePeso } from '@/dominio/tipos'
import { formatarNumero, limpar } from '@/dominio/dose/numeros'

export type ParteLinha =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'dose'; texto: string; limitada: boolean }

/** Sem peso: mostra a regra. Com peso: dose (e volume, se houver concentração). */
export function calcularRegraDosePeso(
  r: RegraDosePeso,
  pesoKg: number | null,
): { texto: string; limitada: boolean } {
  if (pesoKg === null) {
    const base = `${formatarNumero(r.dosePorKg)} ${r.unidade}/kg`
    const max = r.doseMaxima !== null ? ` (máx. ${formatarNumero(r.doseMaxima)} ${r.unidade})` : ''
    return { texto: base + max, limitada: false }
  }
  const fator = 10 ** r.casasDecimais
  const calculada = Math.round(limpar(r.dosePorKg * pesoKg) * fator) / fator
  const limitada = r.doseMaxima !== null && calculada > r.doseMaxima
  const dose = limitada ? (r.doseMaxima as number) : calculada
  let texto = `${formatarNumero(dose)} ${r.unidade}`
  if (r.concentracao !== null && r.concentracao > 0) {
    const volume = Math.round(limpar(dose / r.concentracao) * 10) / 10
    texto += ` (${formatarNumero(volume)} mL)`
  }
  return { texto, limitada }
}

/** Substitui cada {marcador} pela dose; marcador sem regra permanece literal. */
export function montarLinhaDosePeso(l: LinhaDosePeso, pesoKg: number | null): ParteLinha[] {
  const partes: ParteLinha[] = []
  const addTexto = (t: string) => {
    if (t === '') return
    const ultima = partes[partes.length - 1]
    if (ultima && ultima.tipo === 'texto') ultima.texto += t
    else partes.push({ tipo: 'texto', texto: t })
  }
  let pos = 0
  for (const m of l.texto.matchAll(/\{([A-Za-z0-9_]+)\}/g)) {
    addTexto(l.texto.slice(pos, m.index))
    const r = l.regras.find((x) => x.marcador === m[1])
    if (r) {
      const { texto, limitada } = calcularRegraDosePeso(r, pesoKg)
      partes.push({ tipo: 'dose', texto, limitada })
    } else {
      addTexto(m[0])
    }
    pos = m.index + m[0].length
  }
  addTexto(l.texto.slice(pos))
  return partes
}
