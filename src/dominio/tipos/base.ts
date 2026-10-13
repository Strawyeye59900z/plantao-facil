/** Identificador único (crypto.randomUUID). */
export type UUID = string

/** Data/hora em ISO 8601 UTC, ex.: "2026-10-13T19:47:00.000Z". */
export type ISODate = string

/**
 * Campos comuns a toda entidade sincronizável no futuro.
 * Exclusão é lógica: `excluidoEm` preenchido = item na lixeira.
 */
export interface Entidade {
  id: UUID
  criadoEm: ISODate
  atualizadoEm: ISODate
  excluidoEm: ISODate | null
}

export type Gravidade = 'informativo' | 'atencao' | 'critico'

export const GRAVIDADES: readonly Gravidade[] = ['informativo', 'atencao', 'critico']

export const ROTULO_GRAVIDADE: Record<Gravidade, string> = {
  informativo: 'Informativo',
  atencao: 'Atenção',
  critico: 'Crítico',
}

/** Lista gerenciada de categorias, separada por módulo. */
export type EscopoCategoria = 'prescricao' | 'calculadora'

export interface Categoria extends Entidade {
  nome: string
  escopo: EscopoCategoria
  ordem: number
}
