import { formatarNumero } from '@/dominio/dose/numeros'
import type { RegraDoseV1 } from './tipos'

/**
 * Regra de dose da v1 escrita por extenso, com todos os números cadastrados (exceto o arredondamento).
 * Ex.: "30 mg/kg/dia, 3 tomadas/dia, máx. 1500 mg/dia, acima de 40 kg: 400 mg, concentração 100 mg em 5 mL".
 */
export function descreverRegraV1(r: RegraDoseV1): string {
  const n = formatarNumero
  const u = r.unidade
  const partes = [`${n(r.dosePorKg)} ${u}/kg${r.baseDoseKg === 'por_dia' ? '/dia' : ''}`]
  if (r.tomadasPorDia !== null) partes.push(`${n(r.tomadasPorDia)} ${r.tomadasPorDia === 1 ? 'tomada' : 'tomadas'}/dia`)
  if (r.doseMaximaPorTomada !== null) partes.push(`máx. ${n(r.doseMaximaPorTomada)} ${u}/tomada`)
  if (r.doseMaximaDiaria !== null) partes.push(`máx. ${n(r.doseMaximaDiaria)} ${u}/dia`)
  if (r.pesoLimite) partes.push(`acima de ${n(r.pesoLimite.acimaDeKg)} kg: ${n(r.pesoLimite.doseFixa)} ${u}`)
  if (r.concentracao) partes.push(`concentração ${n(r.concentracao.quantidade)} ${u} em ${n(r.concentracao.volumeMl)} mL`)
  return partes.join(', ')
}

// ===== Tabela de intervalos da v1 (copiada de src/dominio/dose/marcadores.ts antes de apagá-lo) =====

/** Quantidades de tomadas que dividem 24h em horas inteiras. */
export const TOMADAS_COM_INTERVALO_V1: readonly number[] = [1, 2, 3, 4, 6, 8, 12, 24]

/** {tomadas} vira intervalo: 1 → "1 vez ao dia"; 3 → "de 8h em 8h". */
export function textoTomadasV1(tomadas: number): string {
  if (tomadas === 1) return '1 vez ao dia'
  const horas = 24 / tomadas
  return `de ${formatarNumero(horas)}h em ${formatarNumero(horas)}h`
}

const PADRAO_MARCADOR = /\{([^{}]*)\}/g

/**
 * Converte o texto de um item/alternativa da v1 que tinha regra de dose em texto puro:
 * - o primeiro {dose} ou {dose_diaria} vira "[<regra por extenso>]"; os seguintes, "[dose]"/"[dose diária]";
 * - {volume} vira "[volume]";
 * - {tomadas} vira o intervalo da v1 ("de 8h em 8h") com 1, 2, 3, 4, 6, 8, 12 ou 24 tomadas; senão "[tomadas]";
 * - sem {dose}/{dose_diaria}, a regra por extenso é anexada ao fim, para nenhum número se perder.
 * Marcadores desconhecidos ficam como estavam (como na v1).
 */
export function converterTextoComRegraV1(texto: string, regra: RegraDoseV1): string {
  const descricao = `[${descreverRegraV1(regra)}]`
  let descricaoUsada = false
  const convertido = texto.replace(PADRAO_MARCADOR, (original, bruto: string) => {
    switch (bruto.trim()) {
      case 'dose':
      case 'dose_diaria': {
        if (!descricaoUsada) {
          descricaoUsada = true
          return descricao
        }
        return bruto.trim() === 'dose' ? '[dose]' : '[dose diária]'
      }
      case 'volume':
        return '[volume]'
      case 'tomadas':
        return regra.tomadasPorDia !== null && TOMADAS_COM_INTERVALO_V1.includes(regra.tomadasPorDia)
          ? textoTomadasV1(regra.tomadasPorDia)
          : '[tomadas]'
      default:
        return original
    }
  })
  if (descricaoUsada) return convertido
  const base = convertido.trimEnd()
  return base ? `${base} ${descricao}` : descricao
}
