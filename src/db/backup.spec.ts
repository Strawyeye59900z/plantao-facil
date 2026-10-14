import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { criarBanco, type BancoPlantao } from '@/db/banco'
import { categoriaTeste, prescricaoTeste } from '@/dominio/prescricoes/fixtures.spec-helper'
import { gravarNaBiblioteca, lerBiblioteca, substituirBiblioteca } from './backup'

let banco: BancoPlantao

beforeEach(() => {
  banco = criarBanco(`teste-${crypto.randomUUID()}`)
})
afterEach(async () => {
  await banco.delete()
})

describe('backup no banco', () => {
  it('gravar insere e sobrescreve sem apagar o resto', async () => {
    await banco.prescricoes.bulkPut([prescricaoTeste({ id: 'a' }), prescricaoTeste({ id: 'b', titulo: 'Antigo' })])
    await gravarNaBiblioteca(
      { prescricoes: [prescricaoTeste({ id: 'b', titulo: 'Novo' }), prescricaoTeste({ id: 'c' })], calculadoras: [], categorias: [categoriaTeste()] },
      banco,
    )
    const b = await lerBiblioteca(banco)
    expect(b.prescricoes.map((p) => [p.id, p.titulo]).sort()).toEqual([
      ['a', 'Situação Teste A'],
      ['b', 'Novo'],
      ['c', 'Situação Teste A'],
    ])
    expect(b.categorias).toHaveLength(1)
  })

  it('aceita dados reativos do Vue', async () => {
    const reativo = reactive({ prescricoes: [prescricaoTeste()], calculadoras: [], categorias: [] })
    await gravarNaBiblioteca(reativo, banco)
    await substituirBiblioteca(reativo, banco)
    expect((await lerBiblioteca(banco)).prescricoes).toHaveLength(1)
  })

  it('substituir apaga o que havia', async () => {
    await banco.prescricoes.bulkPut([prescricaoTeste({ id: 'a' }), prescricaoTeste({ id: 'b' })])
    await banco.categorias.put(categoriaTeste({ id: 'velha' }))
    await substituirBiblioteca({ prescricoes: [prescricaoTeste({ id: 'z' })], calculadoras: [], categorias: [] }, banco)
    const b = await lerBiblioteca(banco)
    expect(b.prescricoes.map((p) => p.id)).toEqual(['z'])
    expect(b.categorias).toEqual([])
  })

  it('erro no meio desfaz tudo (transação)', async () => {
    await banco.prescricoes.put(prescricaoTeste({ id: 'a' }))
    // ID inválido para chave do IndexedDB (objeto) força erro na gravação.
    const invalida = prescricaoTeste({ id: {} as unknown as string })
    await expect(
      substituirBiblioteca({ prescricoes: [prescricaoTeste({ id: 'z' }), invalida], calculadoras: [], categorias: [] }, banco),
    ).rejects.toThrow()
    expect((await lerBiblioteca(banco)).prescricoes.map((p) => p.id)).toEqual(['a'])
  })
})
