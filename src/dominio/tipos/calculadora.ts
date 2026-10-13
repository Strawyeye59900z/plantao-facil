import type { Entidade, Gravidade, UUID } from './base'

/** Faixa fechada: de ≤ x ≤ até. `null` = sem limite naquele lado. */
export interface FaixaInterpretacao {
  id: UUID
  de: number | null
  ate: number | null
  texto: string
  gravidade: Gravidade
}

interface CalculadoraBase extends Entidade {
  nome: string
  categoriaId: UUID | null
  descricao: string
  referencia: string
  faixas: FaixaInterpretacao[]
  favorito: boolean
}

export interface CampoSimNao {
  id: UUID
  tipo: 'sim_nao'
  rotulo: string
  pontosSim: number
  pontosNao: number
}

export interface OpcaoSelecao {
  id: UUID
  rotulo: string
  pontos: number
}

export interface CampoSelecao {
  id: UUID
  tipo: 'selecao'
  rotulo: string
  opcoes: OpcaoSelecao[]
}

export interface FaixaPontos {
  id: UUID
  de: number | null
  ate: number | null
  pontos: number
}

export interface CampoNumero {
  id: UUID
  tipo: 'numero'
  rotulo: string
  unidade: string
  min: number | null
  max: number | null
  faixas: FaixaPontos[]
}

export type CampoPontos = CampoSimNao | CampoSelecao | CampoNumero

export interface CalculadoraPontos extends CalculadoraBase {
  tipo: 'pontos'
  campos: CampoPontos[]
}

export interface EntradaFormula {
  id: UUID
  /** Nome usado na expressão, ex.: "peso". */
  variavel: string
  rotulo: string
  unidade: string
  min: number
  max: number
}

export interface CalculadoraFormula extends CalculadoraBase {
  tipo: 'formula'
  entradas: EntradaFormula[]
  expressao: string
  unidadeResultado: string
  casasDecimais: number
  teto: number | null
  piso: number | null
}

export type Calculadora = CalculadoraPontos | CalculadoraFormula
