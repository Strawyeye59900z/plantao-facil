import type { ItemPrescricao, RegraDose, ResultadoDose, UUID } from '@/dominio/tipos'
import { calcularDose } from './calculo'
import { substituirMarcadores } from './marcadores'

export interface LinhaCalculada {
  itemId: UUID
  /** Alternativa escolhida no lugar do item (ou null = padrão). */
  alternativaId: UUID | null
  motivoAlternativa: string | null
  /** Texto com marcadores substituídos (ou "[informe o peso]"). */
  texto: string
  regra: RegraDose | null
  resultado: ResultadoDose | null
}

export interface PrescricaoCalculada {
  linhas: LinhaCalculada[]
  /** Algum item que será copiado depende do peso. */
  precisaPeso: boolean
  /** Copiar liberado: não precisa de peso, ou tem peso válido e nenhum erro de cálculo. */
  podeCopiar: boolean
}

/**
 * Monta os itens efetivos (com a alternativa escolhida) e calcula as doses.
 * `pesoKg` null = peso ainda não informado ou inválido.
 */
export function calcularPrescricao(
  itens: ItemPrescricao[],
  escolhidas: Record<UUID, UUID | null>,
  pesoKg: number | null,
): PrescricaoCalculada {
  const linhas = itens.map((item): LinhaCalculada => {
    const alt = escolhidas[item.id] ? item.alternativas.find((a) => a.id === escolhidas[item.id]) : undefined
    const texto = alt?.texto ?? item.texto
    const regra = alt ? alt.regraDose : item.regraDose
    const resultado = regra && pesoKg !== null ? calcularDose(regra, pesoKg) : null
    return {
      itemId: item.id,
      alternativaId: alt?.id ?? null,
      motivoAlternativa: alt?.motivo ?? null,
      texto: substituirMarcadores(texto, regra, resultado),
      regra,
      resultado,
    }
  })
  const precisaPeso = linhas.some((l) => l.regra !== null)
  const podeCopiar = !precisaPeso || (pesoKg !== null && linhas.every((l) => !l.regra || l.resultado?.ok))
  return { linhas, precisaPeso, podeCopiar }
}

/** "1. texto" por linha, sem linha em branco; quebras dentro do item viram espaço. */
export function montarTextoCopia(linhas: Pick<LinhaCalculada, 'texto'>[]): string {
  return linhas.map((l, i) => `${i + 1}. ${l.texto.replace(/\s+/g, ' ').trim()}`).join('\n')
}
