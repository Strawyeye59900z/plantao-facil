import type { AvisoDose, RegraDose, ResultadoDose } from '@/dominio/tipos'
import {
  ajustarDoseParaBaixo,
  ajustarVolumeParaBaixo,
  arredondarDose,
  arredondarVolume,
  descreverArredondamentoDose,
  descreverArredondamentoVolume,
  doseRespeitaArredondamento,
  formatarIntermediario,
  formatarNumero,
  limpar,
} from './numeros'

/**
 * Calcula a dose de um item para o peso informado (kg, já validado).
 *
 * Ordem (aprovada pelo usuário):
 *  1. Peso limite: peso > X kg → dose fixa por tomada (sem arredondamento).
 *  2. Cálculo: dose/kg × peso (por tomada) ou (dose/kg × peso) ÷ tomadas (por dia).
 *  3. Arredondamento da dose (sempre inteira).
 *  4. Tetos por último (por tomada e diário ÷ tomadas). Se o teto não for inteiro/múltiplo,
 *     ajusta para baixo — a dose final nunca ultrapassa a máxima.
 *  5. Dose diária = dose × tomadas.
 *  6. Volume pela concentração, com arredondamento próprio; se o volume arredondado
 *     equivaler a mais que a dose máxima, arredonda para baixo.
 */
export function calcularDose(regra: RegraDose, pesoKg: number): ResultadoDose {
  const u = regra.unidade
  const n = (x: number) => formatarNumero(x)
  const memoria: string[] = []
  const avisos: AvisoDose[] = []
  const tomadas = regra.tomadasPorDia

  // 1–3. Dose por tomada antes dos tetos
  let dose: number
  if (regra.pesoLimite && pesoKg > regra.pesoLimite.acimaDeKg) {
    dose = regra.pesoLimite.doseFixa
    avisos.push('peso_limite')
    memoria.push(`peso ${n(pesoKg)} kg > ${n(regra.pesoLimite.acimaDeKg)} kg → dose fixa ${n(dose)} ${u}`)
  } else {
    let bruto: number
    if (regra.baseDoseKg === 'por_tomada') {
      bruto = regra.dosePorKg * pesoKg
      memoria.push(`${n(regra.dosePorKg)} ${u}/kg × ${n(pesoKg)} kg = ${formatarIntermediario(bruto)} ${u}`)
    } else {
      if (!tomadas) return { ok: false, erro: 'Regra "por dia" sem tomadas por dia.', memoria }
      const diaria = regra.dosePorKg * pesoKg
      bruto = diaria / tomadas
      memoria.push(`${n(regra.dosePorKg)} ${u}/kg/dia × ${n(pesoKg)} kg = ${formatarIntermediario(diaria)} ${u}/dia`)
      memoria.push(`${formatarIntermediario(diaria)} ${u} ÷ ${n(tomadas)} tomadas = ${formatarIntermediario(bruto)} ${u} por tomada`)
    }
    dose = arredondarDose(bruto, regra.arredondamentoDose)
    memoria.push(`arredondamento (${descreverArredondamentoDose(regra.arredondamentoDose)}): ${n(dose)} ${u}`)
  }

  // 4. Tetos
  let limiteDose = Number.POSITIVE_INFINITY
  let tetoAplicado = false

  if (regra.doseMaximaPorTomada !== null) {
    limiteDose = Math.min(limiteDose, regra.doseMaximaPorTomada)
    if (dose > regra.doseMaximaPorTomada) {
      dose = regra.doseMaximaPorTomada
      tetoAplicado = true
      avisos.push('teto_tomada')
      memoria.push(`teto por tomada ${n(regra.doseMaximaPorTomada)} ${u}: aplicado → ${n(dose)} ${u}`)
    } else {
      memoria.push(`teto por tomada ${n(regra.doseMaximaPorTomada)} ${u}: não aplicado`)
    }
  }

  if (regra.doseMaximaDiaria !== null) {
    if (!tomadas) return { ok: false, erro: 'Dose máxima diária exige tomadas por dia.', memoria }
    const limite = limpar(regra.doseMaximaDiaria / tomadas)
    limiteDose = Math.min(limiteDose, limite)
    const descricao = `teto diário ${n(regra.doseMaximaDiaria)} ${u} ÷ ${n(tomadas)} tomadas = ${formatarIntermediario(limite)} ${u} por tomada`
    if (dose > limite) {
      dose = limite
      tetoAplicado = true
      avisos.push('teto_diario')
      memoria.push(`${descricao}: aplicado`)
    } else {
      memoria.push(`${descricao}: não aplicado`)
    }
  }

  if (tetoAplicado && !doseRespeitaArredondamento(dose, regra.arredondamentoDose)) {
    dose = ajustarDoseParaBaixo(dose, regra.arredondamentoDose)
    memoria.push(`ajuste para baixo (${descreverArredondamentoDose(regra.arredondamentoDose)}): ${n(dose)} ${u}`)
  }

  if (!(dose > 0)) {
    return { ok: false, erro: 'A dose calculada ficou em zero. Confira a regra.', memoria }
  }

  // 5. Dose diária
  let doseDiaria: number | null = null
  if (tomadas) {
    doseDiaria = limpar(dose * tomadas)
    memoria.push(`dose diária: ${n(dose)} ${u} × ${n(tomadas)} = ${n(doseDiaria)} ${u}`)
  }

  // 6. Volume
  let volumeMl: number | null = null
  if (regra.concentracao) {
    const { quantidade, volumeMl: mlRef } = regra.concentracao
    const exato = (dose * mlRef) / quantidade
    volumeMl = arredondarVolume(exato, regra.arredondamentoVolume)
    memoria.push(
      `volume: ${n(dose)} ${u} × (${n(mlRef)} mL ÷ ${n(quantidade)} ${u}) = ${formatarIntermediario(exato)} mL` +
        ` → ${descreverArredondamentoVolume(regra.arredondamentoVolume)}: ${n(volumeMl)} mL`,
    )
    const doseEquivalente = limpar((volumeMl * quantidade) / mlRef)
    if (doseEquivalente > limiteDose) {
      volumeMl = ajustarVolumeParaBaixo(exato, regra.arredondamentoVolume)
      avisos.push('volume_reduzido')
      memoria.push(`volume arredondado para baixo: ${n(volumeMl)} mL (não passa de ${n(limiteDose)} ${u})`)
    }
    if (!(volumeMl > 0)) {
      return { ok: false, erro: 'O volume calculado ficou em zero. Confira a regra.', memoria }
    }
  }

  return { ok: true, dosePorTomada: dose, doseDiaria, volumeMl, avisos, memoria }
}
