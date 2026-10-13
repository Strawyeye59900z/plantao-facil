import type { Entidade, Gravidade, UUID } from './base'
import type { RegraDose } from './dose'

export type TipoAlerta =
  | 'contraindicacao'
  | 'ajuste_renal'
  | 'gestacao'
  | 'interacao'
  | 'atencao'
  | 'outro'

export const ROTULO_TIPO_ALERTA: Record<TipoAlerta, string> = {
  contraindicacao: 'Contraindicação',
  ajuste_renal: 'Ajuste renal',
  gestacao: 'Gestação',
  interacao: 'Interação',
  atencao: 'Atenção',
  outro: 'Outro',
}

export interface Alerta {
  id: UUID
  tipo: TipoAlerta
  gravidade: Gravidade
  texto: string
  /** null = alerta da prescrição; preenchido = ligado a um item (aparece junto dele e também no topo). */
  itemId: UUID | null
}

export interface Alternativa {
  id: UUID
  /** Ex.: "alergia a ...". */
  motivo: string
  texto: string
  regraDose: RegraDose | null
}

export interface ItemPrescricao {
  id: UUID
  /** Pode conter marcadores ({dose}, {volume}, {dose_diaria}, {tomadas}). */
  texto: string
  regraDose: RegraDose | null
  alternativas: Alternativa[]
}

export type OrigemPrescricao = 'manual' | 'importada_ia'

export interface Prescricao extends Entidade {
  /** Doença/situação. */
  titulo: string
  categoriaId: UUID | null
  tags: string[]
  /** A ordem do array é a ordem de exibição. */
  itens: ItemPrescricao[]
  alertas: Alerta[]
  observacoes: string
  referencia: string
  favorito: boolean
  origem: OrigemPrescricao
  /** false = "importada — não revisada". Prescrições manuais nascem revisadas. */
  revisada: boolean
  /** Campo "dúvidas" devolvido pela IA na importação. */
  duvidasImportacao: string[]
}
