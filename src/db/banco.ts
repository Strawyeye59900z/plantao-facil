import { Dexie, type EntityTable } from 'dexie'
import type { Calculadora, Categoria, Configuracoes, Prescricao } from '@/dominio/tipos'

export const NOME_BANCO = 'plantao-facil'

export type BancoPlantao = Dexie & {
  prescricoes: EntityTable<Prescricao, 'id'>
  calculadoras: EntityTable<Calculadora, 'id'>
  categorias: EntityTable<Categoria, 'id'>
  configuracoes: EntityTable<Configuracoes, 'id'>
}

/**
 * IndexedDB não indexa booleanos nem null: favorito e excluidoEm
 * são filtrados em memória (biblioteca pequena, continua instantâneo).
 */
export function criarBanco(nome = NOME_BANCO): BancoPlantao {
  const banco = new Dexie(nome) as BancoPlantao
  banco.version(1).stores({
    prescricoes: 'id, categoriaId, *tags, atualizadoEm',
    calculadoras: 'id, categoriaId, tipo, atualizadoEm',
    categorias: 'id, escopo, atualizadoEm',
    configuracoes: 'id',
  })
  return banco
}

export const db = criarBanco()
