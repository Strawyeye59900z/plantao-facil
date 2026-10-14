import type { RegraDose, ResultadoDose } from '@/dominio/tipos'
import { formatarNumero } from './numeros'

export const MARCADORES = ['dose', 'volume', 'dose_diaria', 'tomadas'] as const
export type Marcador = (typeof MARCADORES)[number]

const PADRAO_MARCADOR = /\{([^{}]*)\}/g

export function marcadoresUsados(texto: string): string[] {
  return [...texto.matchAll(PADRAO_MARCADOR)].map((m) => m[1]!.trim())
}

/** Erros de marcadores para o editor (texto do item/alternativa + sua regra). */
export function validarMarcadores(texto: string, regra: RegraDose | null): string[] {
  const erros: string[] = []
  for (const nome of new Set(marcadoresUsados(texto))) {
    if (!(MARCADORES as readonly string[]).includes(nome)) {
      erros.push(`marcador desconhecido {${nome}} (use ${MARCADORES.map((m) => `{${m}}`).join(', ')}).`)
    } else if (!regra) {
      erros.push(`usa {${nome}} mas não tem regra de dose.`)
    } else if (nome === 'volume' && !regra.concentracao) {
      erros.push('usa {volume} mas a regra não tem concentração.')
    } else if ((nome === 'dose_diaria' || nome === 'tomadas') && !regra.tomadasPorDia) {
      erros.push(`usa {${nome}} mas a regra não tem tomadas por dia.`)
    } else if (nome === 'tomadas' && !TOMADAS_COM_INTERVALO.includes(regra.tomadasPorDia!)) {
      erros.push(`{tomadas} exige ${TOMADAS_COM_INTERVALO.join(', ')} tomadas por dia (intervalo exato em horas).`)
    }
  }
  return erros
}

/** Quantidades de tomadas que dividem 24h em horas inteiras. */
export const TOMADAS_COM_INTERVALO: readonly number[] = [1, 2, 3, 4, 6, 8, 12, 24]

/** {tomadas} vira intervalo: 1 → "1 vez ao dia"; 3 → "de 8h em 8h". */
export function textoTomadas(tomadas: number): string {
  if (tomadas === 1) return '1 vez ao dia'
  const horas = 24 / tomadas
  return `de ${formatarNumero(horas)}h em ${formatarNumero(horas)}h`
}

function valor(nome: Marcador, regra: RegraDose, r: Extract<ResultadoDose, { ok: true }>): string | null {
  switch (nome) {
    case 'dose':
      return `${formatarNumero(r.dosePorTomada)} ${regra.unidade}`
    case 'volume':
      return r.volumeMl === null ? null : `${formatarNumero(r.volumeMl)} mL`
    case 'dose_diaria':
      return r.doseDiaria === null ? null : `${formatarNumero(r.doseDiaria)} ${regra.unidade}`
    case 'tomadas':
      return regra.tomadasPorDia === null ? null : textoTomadas(regra.tomadasPorDia)
  }
}

/**
 * Substitui os marcadores pelos valores calculados.
 * Sem resultado (peso não informado ou erro), mostra o nome entre colchetes (ex.: "[dose]");
 * {tomadas} não depende do peso e sai sempre com o valor.
 */
export function substituirMarcadores(texto: string, regra: RegraDose | null, resultado: ResultadoDose | null): string {
  return texto.replace(PADRAO_MARCADOR, (original, bruto: string) => {
    const nome = bruto.trim() as Marcador
    if (!regra || !(MARCADORES as readonly string[]).includes(nome)) return original
    if (nome === 'tomadas' && regra.tomadasPorDia !== null) return textoTomadas(regra.tomadasPorDia)
    if (!resultado || !resultado.ok) return `[${nome}]`
    return valor(nome, regra, resultado) ?? original
  })
}
