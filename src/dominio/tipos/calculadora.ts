import type { Entidade, Gravidade, UUID } from './base'

/** Faixa fechada: de ≤ x ≤ até. `null` = sem limite naquele lado. */
export interface FaixaInterpretacao {
  id: UUID
  de: number | null
  ate: number | null
  texto: string
  gravidade: Gravidade
}

export type AreaCalculadora = 'calculadora' | 'escala'

interface CalculadoraBase extends Entidade {
  area: AreaCalculadora
  nome: string
  categoriaId: UUID | null
  descricao: string
  referencia: string
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
  area: 'escala'
  tipo: 'pontos'
  campos: CampoPontos[]
  faixas: FaixaInterpretacao[]
}

export interface RegraDosePeso {
  id: UUID
  /** Nome usado no texto da linha entre chaves, ex.: "inducao" em {inducao}. */
  marcador: string
  dosePorKg: number
  unidade: string
  /** Unidade por mL; null = sem conversão para volume. */
  concentracao: number | null
  doseMaxima: number | null
  casasDecimais: number
}

export interface LinhaDosePeso {
  id: UUID
  texto: string
  regras: RegraDosePeso[]
}

export interface CalculadoraDosePeso extends CalculadoraBase {
  area: 'calculadora'
  tipo: 'dose_peso'
  linhas: LinhaDosePeso[]
}

export type CampoFormula =
  | { id: UUID; tipo: 'numero'; variavel: string; rotulo: string; unidade: string; min: number | null; max: number | null }
  | { id: UUID; tipo: 'sim_nao'; variavel: string; rotulo: string; valorSim: number; valorNao: number }

export interface SaidaFormula {
  id: UUID
  nome: string
  expressao: string
  unidade: string
  casasDecimais: number
  teto: number | null
  piso: number | null
  faixas: FaixaInterpretacao[]
}

export interface CalculadoraFormula extends CalculadoraBase {
  tipo: 'formula'
  campos: CampoFormula[]
  saidas: SaidaFormula[]
}

export type Calculadora = CalculadoraDosePeso | CalculadoraFormula | CalculadoraPontos
