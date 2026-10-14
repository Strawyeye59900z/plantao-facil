/** Texto livre com sugestões (mg, mcg, g, UI, mEq, mL…). */
export type UnidadeDose = string

export const SUGESTOES_UNIDADE_DOSE: readonly string[] = ['mg', 'mcg', 'g', 'UI', 'mEq', 'mL']

export type DirecaoArredondamento = 'baixo' | 'proximo' | 'cima'

/** A dose é sempre inteira: inteiro mais próximo ou múltiplo de um passo inteiro. */
export type ArredondamentoDose =
  | { modo: 'inteiro' }
  | { modo: 'multiplo'; passo: number; direcao: DirecaoArredondamento }

export type ArredondamentoVolume =
  | { modo: 'casas_decimais'; casas: number }
  | { modo: 'multiplo'; passo: number; direcao: DirecaoArredondamento }

/**
 * Regra de dose por peso. Todos os valores são cadastrados pelo usuário.
 * Ordem do cálculo (src/dominio/dose/calculo.ts): peso limite → cálculo → arredondamento → tetos.
 * Os tetos vêm por último: a dose final nunca ultrapassa a máxima cadastrada.
 */
export interface RegraDose {
  dosePorKg: number
  unidade: UnidadeDose
  /** Se a dose/kg se refere a cada tomada ou ao total do dia (dividido pelas tomadas). */
  baseDoseKg: 'por_tomada' | 'por_dia'
  tomadasPorDia: number | null
  doseMaximaPorTomada: number | null
  doseMaximaDiaria: number | null
  /** Peso > `acimaDeKg` (estritamente maior): usa `doseFixa` por tomada; tetos continuam valendo. */
  pesoLimite: { acimaDeKg: number; doseFixa: number } | null
  /** "X <unidade> em Y mL" — mesma unidade da dose, sem conversão automática. */
  concentracao: { quantidade: number; volumeMl: number } | null
  arredondamentoDose: ArredondamentoDose
  arredondamentoVolume: ArredondamentoVolume
}

export type AvisoDose = 'peso_limite' | 'teto_tomada' | 'teto_diario' | 'volume_reduzido'

export const TEXTO_AVISO_DOSE: Record<AvisoDose, string> = {
  peso_limite: 'Peso limite aplicado: dose fixa',
  teto_tomada: 'Dose máxima por tomada aplicada',
  teto_diario: 'Dose máxima diária aplicada',
  volume_reduzido: 'Volume arredondado para baixo para não ultrapassar a dose máxima',
}

/** Resultado do cálculo — só em memória, nunca salvo. */
export type ResultadoDose =
  | {
      ok: true
      dosePorTomada: number
      doseDiaria: number | null
      volumeMl: number | null
      avisos: AvisoDose[]
      /** Ex.: ["10 mg/kg × 20 kg = 200 mg", "teto por tomada 150 mg: aplicado → 150 mg"]. */
      memoria: string[]
    }
  | { ok: false; erro: string; memoria: string[] }
