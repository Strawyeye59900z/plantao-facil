import type { RegraDose } from '@/dominio/tipos'

const positivo = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0
const inteiroPositivo = (x: unknown): x is number => positivo(x) && Number.isInteger(x)

/** Erros que impedem salvar uma regra de dose. Lista vazia = válida. */
export function validarRegraDose(r: RegraDose): string[] {
  const erros: string[] = []
  if (!positivo(r.dosePorKg)) erros.push('dose por kg deve ser maior que zero.')
  if (!r.unidade?.trim()) erros.push('informe a unidade.')

  if (r.tomadasPorDia !== null && !inteiroPositivo(r.tomadasPorDia)) {
    erros.push('tomadas por dia deve ser um número inteiro maior que zero.')
  }
  if (r.baseDoseKg === 'por_dia' && r.tomadasPorDia === null) {
    erros.push('dose "por dia" exige tomadas por dia.')
  }
  if (r.doseMaximaDiaria !== null && r.tomadasPorDia === null) {
    erros.push('dose máxima diária exige tomadas por dia.')
  }
  if (r.doseMaximaPorTomada !== null && !positivo(r.doseMaximaPorTomada)) {
    erros.push('dose máxima por tomada deve ser maior que zero.')
  }
  if (r.doseMaximaDiaria !== null && !positivo(r.doseMaximaDiaria)) {
    erros.push('dose máxima diária deve ser maior que zero.')
  }

  if (r.pesoLimite) {
    if (!positivo(r.pesoLimite.acimaDeKg)) erros.push('peso limite deve ser maior que zero.')
    if (!inteiroPositivo(r.pesoLimite.doseFixa)) erros.push('dose fixa deve ser um número inteiro maior que zero.')
  }

  if (r.concentracao) {
    if (!positivo(r.concentracao.quantidade) || !positivo(r.concentracao.volumeMl)) {
      erros.push('concentração: os dois valores devem ser maiores que zero.')
    }
  }

  const ad = r.arredondamentoDose
  if (ad.modo === 'multiplo' && !inteiroPositivo(ad.passo)) {
    erros.push('arredondamento da dose: o passo deve ser inteiro maior que zero.')
  }
  const av = r.arredondamentoVolume
  if (av.modo === 'multiplo' && !positivo(av.passo)) {
    erros.push('arredondamento do volume: o passo deve ser maior que zero.')
  }
  if (av.modo === 'casas_decimais' && !(Number.isInteger(av.casas) && av.casas >= 0 && av.casas <= 3)) {
    erros.push('arredondamento do volume: casas decimais de 0 a 3.')
  }
  return erros
}
