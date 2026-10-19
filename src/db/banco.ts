import { Dexie, type EntityTable } from 'dexie'
import { migrarPrescricaoV1 } from '@/dominio/migracao/prescricao'
import type { PrescricaoV1 } from '@/dominio/migracao/v1/tipos'
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
  const stores = {
    prescricoes: 'id, categoriaId, *tags, atualizadoEm',
    calculadoras: 'id, categoriaId, tipo, atualizadoEm',
    categorias: 'id, escopo, atualizadoEm',
    configuracoes: 'id',
  }
  banco.version(1).stores(stores)
  // v2: itens com opções (ver migrarPrescricaoV1). Converte todas as prescrições, inclusive as da lixeira.
  // Sem try/catch: se algum registro falhar, a atualização inteira é desfeita e nada se perde.
  banco
    .version(2)
    .stores(stores)
    .upgrade((tx) =>
      tx
        .table('prescricoes')
        .toCollection()
        .modify((registro: PrescricaoV1, ref) => {
          ref.value = migrarPrescricaoV1(registro)
        }),
    )
  return banco
}

export const db = criarBanco()
