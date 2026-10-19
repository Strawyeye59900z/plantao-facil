/**
 * Cópia congelada do modelo de dados da v1 (formato de backup 1 e banco antes da v2).
 * Usada só pela migração v1 → v2. NÃO alterar: descreve dados que já existem nos aparelhos e nos backups.
 * Só depende dos tipos básicos estáveis (UUID, ISODate, Entidade, Gravidade).
 */
import type { Entidade, Gravidade, ISODate, UUID } from '@/dominio/tipos/base'

// ===== Categoria =====
export type EscopoCategoriaV1 = 'prescricao' | 'calculadora'

export interface CategoriaV1 extends Entidade {
  nome: string
  escopo: EscopoCategoriaV1
  ordem: number
  /** Nome de um ícone da galeria; null = sem ícone. Ausente em backups antigos = null. */
  icone: string | null
}

// ===== Dose =====
export type UnidadeDoseV1 = string

export type DirecaoArredondamentoV1 = 'baixo' | 'proximo' | 'cima'

export type ArredondamentoDoseV1 =
  | { modo: 'inteiro' }
  | { modo: 'multiplo'; passo: number; direcao: DirecaoArredondamentoV1 }

export type ArredondamentoVolumeV1 =
  | { modo: 'casas_decimais'; casas: number }
  | { modo: 'multiplo'; passo: number; direcao: DirecaoArredondamentoV1 }

export interface RegraDoseV1 {
  dosePorKg: number
  unidade: UnidadeDoseV1
  /** Se a dose/kg se refere a cada tomada ou ao total do dia (dividido pelas tomadas). */
  baseDoseKg: 'por_tomada' | 'por_dia'
  tomadasPorDia: number | null
  doseMaximaPorTomada: number | null
  doseMaximaDiaria: number | null
  /** Peso > `acimaDeKg` (estritamente maior): usa `doseFixa` por tomada. */
  pesoLimite: { acimaDeKg: number; doseFixa: number } | null
  /** "X <unidade> em Y mL" — mesma unidade da dose. */
  concentracao: { quantidade: number; volumeMl: number } | null
  arredondamentoDose: ArredondamentoDoseV1
  arredondamentoVolume: ArredondamentoVolumeV1
}

// ===== Prescrição =====
export type TipoAlertaV1 = 'contraindicacao' | 'ajuste_renal' | 'gestacao' | 'interacao' | 'atencao' | 'outro'

export interface AlertaV1 {
  id: UUID
  tipo: TipoAlertaV1
  gravidade: Gravidade
  texto: string
  /** null = alerta da prescrição; preenchido = ligado a um item. */
  itemId: UUID | null
}

export interface AlternativaV1 {
  id: UUID
  motivo: string
  texto: string
  regraDose: RegraDoseV1 | null
}

export interface ItemPrescricaoV1 {
  id: UUID
  /** Pode conter marcadores ({dose}, {volume}, {dose_diaria}, {tomadas}). */
  texto: string
  regraDose: RegraDoseV1 | null
  alternativas: AlternativaV1[]
  /** Opções equivalentes ("OU"): texto principal = opção 1, alternativas = opções 2, 3… Ausente = false. */
  opcoesEquivalentes?: boolean
  /** null/ausente = "Sempre". */
  condicaoId?: UUID | null
}

export interface CondicaoV1 {
  id: UUID
  nome: string
}

export type OrigemPrescricaoV1 = 'manual' | 'importada_ia'

export interface PrescricaoV1 extends Entidade {
  titulo: string
  categoriaId: UUID | null
  tags: string[]
  itens: ItemPrescricaoV1[]
  /** Ausente em dados antigos = []. */
  condicoes: CondicaoV1[]
  alertas: AlertaV1[]
  /** Ausente em dados antigos = ''. */
  receita: string
  observacoes: string
  referencia: string
  favorito: boolean
  origem: OrigemPrescricaoV1
  revisada: boolean
  duvidasImportacao: string[]
}

// ===== Calculadora =====
export interface FaixaInterpretacaoV1 {
  id: UUID
  de: number | null
  ate: number | null
  texto: string
  gravidade: Gravidade
}

interface CalculadoraBaseV1 extends Entidade {
  nome: string
  categoriaId: UUID | null
  descricao: string
  referencia: string
  faixas: FaixaInterpretacaoV1[]
  favorito: boolean
}

export interface CampoSimNaoV1 {
  id: UUID
  tipo: 'sim_nao'
  rotulo: string
  pontosSim: number
  pontosNao: number
}

export interface OpcaoSelecaoV1 {
  id: UUID
  rotulo: string
  pontos: number
}

export interface CampoSelecaoV1 {
  id: UUID
  tipo: 'selecao'
  rotulo: string
  opcoes: OpcaoSelecaoV1[]
}

export interface FaixaPontosV1 {
  id: UUID
  de: number | null
  ate: number | null
  pontos: number
}

export interface CampoNumeroV1 {
  id: UUID
  tipo: 'numero'
  rotulo: string
  unidade: string
  min: number | null
  max: number | null
  faixas: FaixaPontosV1[]
}

export type CampoPontosV1 = CampoSimNaoV1 | CampoSelecaoV1 | CampoNumeroV1

export interface CalculadoraPontosV1 extends CalculadoraBaseV1 {
  tipo: 'pontos'
  campos: CampoPontosV1[]
}

export interface EntradaFormulaV1 {
  id: UUID
  variavel: string
  rotulo: string
  unidade: string
  min: number
  max: number
}

export interface CalculadoraFormulaV1 extends CalculadoraBaseV1 {
  tipo: 'formula'
  entradas: EntradaFormulaV1[]
  expressao: string
  unidadeResultado: string
  casasDecimais: number
  teto: number | null
  piso: number | null
}

export type CalculadoraV1 = CalculadoraPontosV1 | CalculadoraFormulaV1

// ===== Backup =====
export interface ArquivoBackupV1 {
  formato: 'plantao-facil-backup'
  versaoFormato: 1
  exportadoEm: ISODate
  versaoApp: string
  /** Inclui itens na lixeira (excluidoEm preenchido). */
  prescricoes: PrescricaoV1[]
  calculadoras: CalculadoraV1[]
  categorias: CategoriaV1[]
}
