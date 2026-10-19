import { Dexie, type EntityTable } from 'dexie'
import { migrarCalculadorasEGruposV1 } from '@/dominio/migracao/calculadora'
import { migrarPrescricaoV1 } from '@/dominio/migracao/prescricao'
import type { CalculadoraV1, CategoriaV1, PrescricaoV1 } from '@/dominio/migracao/v1/tipos'
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
  // v3: calculadoras da v1 viram calculadoras (fórmula) ou escalas (pontos), e os grupos de calculadoras
  // usados por escalas passam a ser de escalas (ver migrarGruposV1). Lê tudo, inclusive a lixeira, e grava
  // na mesma transação. Sem try/catch: se algo falhar, as versões 2 e 3 são desfeitas e nada se perde.
  banco
    .version(3)
    .stores({ ...stores, calculadoras: 'id, categoriaId, area, tipo, atualizadoEm' })
    .upgrade(async (tx) => {
      const calculadorasV1: CalculadoraV1[] = await tx.table('calculadoras').toArray()
      const categoriasV1: CategoriaV1[] = await tx.table('categorias').toArray()
      const { calculadoras, categorias } = migrarCalculadorasEGruposV1(calculadorasV1, categoriasV1)
      await tx.table('categorias').bulkPut(categorias)
      await tx.table('calculadoras').bulkPut(calculadoras)
    })
  return banco
}

export const db = criarBanco()
