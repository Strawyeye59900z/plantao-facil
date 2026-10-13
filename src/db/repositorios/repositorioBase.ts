import type { EntityTable } from 'dexie'
import type { Entidade, ISODate, UUID } from '@/dominio/tipos'

export type DadosNovos<T extends Entidade> = Omit<T, keyof Entidade>
export type Alteracoes<T extends Entidade> = Partial<DadosNovos<T>>

export interface OpcoesRepositorio {
  /** Relógio injetável para testes. */
  agora?: () => ISODate
  gerarId?: () => UUID
}

/**
 * CRUD comum a todas as entidades: preenche id e datas,
 * usa exclusão lógica (lixeira) e só exclui de vez o que já está na lixeira.
 */
export function criarRepositorio<T extends Entidade>(
  tabela: EntityTable<T, 'id'>,
  opcoes: OpcoesRepositorio = {},
) {
  const agora = opcoes.agora ?? (() => new Date().toISOString())
  const gerarId = opcoes.gerarId ?? (() => crypto.randomUUID())

  async function obterOuFalhar(id: UUID): Promise<T> {
    const item = await tabela.get(id as never)
    if (!item) throw new Error(`Registro não encontrado: ${id}`)
    return item
  }

  async function gravar(item: T): Promise<T> {
    // Dexie 4: put aceita a entidade completa; o cast evita o tipo "InsertType".
    await tabela.put(item as never)
    return item
  }

  return {
    async criar(dados: DadosNovos<T>): Promise<T> {
      const momento = agora()
      const item = {
        ...dados,
        id: gerarId(),
        criadoEm: momento,
        atualizadoEm: momento,
        excluidoEm: null,
      } as T
      return gravar(item)
    },

    async obter(id: UUID): Promise<T | undefined> {
      return tabela.get(id as never)
    },

    async atualizar(id: UUID, alteracoes: Alteracoes<T>): Promise<T> {
      const atual = await obterOuFalhar(id)
      return gravar({
        ...atual,
        ...alteracoes,
        id: atual.id,
        criadoEm: atual.criadoEm,
        excluidoEm: atual.excluidoEm,
        atualizadoEm: agora(),
      })
    },

    async listarAtivos(): Promise<T[]> {
      return tabela.filter((item) => item.excluidoEm === null).toArray()
    },

    async listarLixeira(): Promise<T[]> {
      return tabela.filter((item) => item.excluidoEm !== null).toArray()
    },

    async moverParaLixeira(id: UUID): Promise<T> {
      const atual = await obterOuFalhar(id)
      const momento = agora()
      return gravar({ ...atual, excluidoEm: momento, atualizadoEm: momento })
    },

    async restaurar(id: UUID): Promise<T> {
      const atual = await obterOuFalhar(id)
      return gravar({ ...atual, excluidoEm: null, atualizadoEm: agora() })
    },

    /** Exclusão definitiva: só é permitida para itens que já estão na lixeira. */
    async excluirPermanentemente(id: UUID): Promise<void> {
      const atual = await obterOuFalhar(id)
      if (atual.excluidoEm === null) {
        throw new Error('Mova para a lixeira antes de excluir permanentemente.')
      }
      await tabela.delete(id as never)
    },
  }
}

export type Repositorio<T extends Entidade> = ReturnType<typeof criarRepositorio<T>>
