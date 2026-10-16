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
  /**
   * Opções equivalentes ("OU"): o texto principal é a opção 1 e as alternativas são as opções 2, 3…;
   * nenhuma vem escolhida e copiar fica bloqueado até escolher. Motivo opcional. Ausente em dados antigos = false.
   */
  opcoesEquivalentes?: boolean
  /** Condição em que o item entra (ex.: "Refratário após 5 min"). null/ausente = "Sempre". */
  condicaoId?: UUID | null
}

/**
 * Condição/etapa da prescrição. Os itens dela só entram no Copiar quando a condição
 * está marcada na tela (marcação só em memória; nenhuma vem marcada).
 */
export interface Condicao {
  id: UUID
  nome: string
}

export type OrigemPrescricao = 'manual' | 'importada_ia'

export interface Prescricao extends Entidade {
  /** Doença/situação. */
  titulo: string
  categoriaId: UUID | null
  tags: string[]
  /** A ordem do array é a ordem de exibição (o editor mantém "Sempre" primeiro e depois cada condição). */
  itens: ItemPrescricao[]
  /** Condições na ordem de exibição. Ausente em dados antigos = []. */
  condicoes: Condicao[]
  alertas: Alerta[]
  /** Receita pronta (texto simples, quebras de linha preservadas). Ausente em dados antigos = ''. */
  receita: string
  observacoes: string
  referencia: string
  favorito: boolean
  origem: OrigemPrescricao
  /** false = "importada — não revisada". Prescrições manuais nascem revisadas. */
  revisada: boolean
  /** Campo "dúvidas" devolvido pela IA na importação. */
  duvidasImportacao: string[]
}
