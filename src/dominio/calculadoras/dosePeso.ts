import type { LinhaDosePeso, RegraDosePeso } from '@/dominio/tipos'
import { CASAS_MAXIMAS, formatarNumero, limpar } from '@/dominio/dose/numeros'

export type ParteLinha =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'dose'; texto: string; limitada: boolean }

/** Sem peso: mostra a regra. Com peso: dose (e volume, se houver concentração). */
export function calcularRegraDosePeso(
  r: RegraDosePeso,
  pesoKg: number | null,
): { texto: string; limitada: boolean } {
  if (
    !Number.isFinite(r.dosePorKg) ||
    (r.doseMaxima !== null && !Number.isFinite(r.doseMaxima)) ||
    !Number.isInteger(r.casasDecimais) ||
    r.casasDecimais < 0 ||
    r.casasDecimais > CASAS_MAXIMAS
  )
    return { texto: '[regra incompleta]', limitada: false }
  if (pesoKg === null || !Number.isFinite(pesoKg)) {
    const base = `${formatarNumero(r.dosePorKg)} ${r.unidade}/kg`
    const max =
      r.doseMaxima !== null
        ? ` (máx. ${formatarNumero(r.doseMaxima)} ${r.unidade})`
        : ''
    return { texto: base + max, limitada: false }
  }
  const fator = 10 ** r.casasDecimais
  const semArredondar = limpar(r.dosePorKg * pesoKg)
  const calculada = Math.round(limpar(r.dosePorKg * pesoKg * fator)) / fator
  const limitada = r.doseMaxima !== null && calculada > r.doseMaxima
  let dose = limitada ? (r.doseMaxima as number) : calculada
  let texto = `${formatarNumero(dose)} ${r.unidade}`
  if (!limitada && semArredondar > 0 && calculada === 0) {
    // Dose positiva que some no arredondamento: mostra "< 0,1 mg" e o volume usa a dose sem arredondar.
    texto = `< ${formatarNumero(1 / fator)} ${r.unidade}`
    dose = semArredondar
  }
  if (r.concentracao !== null && Number.isFinite(r.concentracao) && r.concentracao > 0) {
    const bruto = limpar(dose / r.concentracao)
    const casas = bruto >= 1 ? 10 : 100
    const volume = Math.round(limpar(bruto * casas)) / casas
    texto += bruto > 0 && volume === 0 ? ' (< 0,01 mL)' : ` (${formatarNumero(volume)} mL)`
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
