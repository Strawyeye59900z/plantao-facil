/** Texto livre com sugestões (mg, mcg, g, UI, mEq, mL…). */
export type UnidadeDose = string

export const SUGESTOES_UNIDADE_DOSE: readonly string[] = ['mg', 'mcg', 'g', 'UI', 'mEq', 'mL']

export type Arredondamento =
  | { modo: 'nenhum' }
  | { modo: 'casas_decimais'; casas: number }
  | { modo: 'multiplo'; passo: number; direcao: 'baixo' | 'proximo' | 'cima' }

/**
 * Regra de dose por peso. Todos os valores são cadastrados pelo usuário.
 * O motor de cálculo (Fase 2) reaplica os tetos depois do arredondamento:
 * a dose final nunca ultrapassa a máxima cadastrada.
 */
export interface RegraDose {
  dosePorKg: number
  unidade: UnidadeDose
  /** Se a dose/kg se refere a cada tomada ou ao total do dia (dividido pelas tomadas). */
  baseDoseKg: 'por_tomada' | 'por_dia'
  tomadasPorDia: number | null
  doseMaximaPorTomada: number | null
  doseMaximaDiaria: number | null
  /** Acima de `acimaDeKg`, usar `doseFixa` (por tomada) em vez do cálculo; tetos continuam valendo. */
  pesoLimite: { acimaDeKg: number; doseFixa: number } | null
  /** "X <unidade> em Y mL" — mesma unidade da dose, sem conversão automática. */
  concentracao: { quantidade: number; volumeMl: number } | null
  arredondamentoDose: Arredondamento
  arredondamentoVolume: Arredondamento
}

/** Resultado do cálculo — só em memória, nunca salvo. */
export interface ResultadoDose {
  dosePorTomada: number
  doseDiaria: number | null
  volumeMl: number | null
  tetoAplicado: 'nenhum' | 'por_tomada' | 'diario' | 'peso_limite'
  /** Ex.: ["15 mg/kg × 20 kg = 300 mg", "teto 500 mg: não aplicado"]. */
  memoria: string[]
}
