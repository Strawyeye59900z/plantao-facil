import type { Entidade, Gravidade, UUID } from './base'

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
  /** null = alerta da prescrição; preenchido = ligado a um item (aparece só junto dele; se o item não existir, aparece no topo — ver `alertasDaPrescricao`). */
  itemId: UUID | null
}

export interface OpcaoItem {
  id: UUID
  texto: string
  /** Rótulo opcional da opção (ex.: "alergia a ..."). Vazio = sem motivo. */
  motivo: string
}

/**
 * Item da prescrição. `opcoes.length === 1`: item simples; ≥ 2: item "OU"
 * (nenhuma opção vem escolhida e copiar fica bloqueado até escolher).
 */
export interface ItemPrescricao {
  id: UUID
  /** Condição em que o item entra (ex.: "Refratário após 5 min"). null = "Sempre". */
  condicaoId: UUID | null
  opcoes: OpcaoItem[]
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
  /** Condições na ordem de exibição. */
  condicoes: Condicao[]
  alertas: Alerta[]
  /** Calculadoras ligadas à prescrição (aba Calculadoras). */
  calculadoraIds: UUID[]
  /** Receita pronta (texto simples, quebras de linha preservadas). */
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
