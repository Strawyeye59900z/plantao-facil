import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { criarBanco, type BancoPlantao } from '@/db/banco'
import { categoriaTeste, prescricaoTeste } from '@/dominio/prescricoes/fixtures.spec-helper'
import { apagarBibliotecaInteira, excluirGrupoComPrescricoes, moverPrescricoesParaLixeira } from './exclusao'

let banco: BancoPlantao
const MOMENTO = '2026-05-05T10:00:00.000Z'
const agora = () => MOMENTO

beforeEach(() => {
  banco = criarBanco(`teste-${crypto.randomUUID()}`)
})
afterEach(async () => {
  await banco.delete()
})

describe('moverPrescricoesParaLixeira', () => {
  it('move só as escolhidas e devolve a quantidade', async () => {
    await banco.prescricoes.bulkPut([prescricaoTeste({ id: 'a' }), prescricaoTeste({ id: 'b' }), prescricaoTeste({ id: 'c' })])
    expect(await moverPrescricoesParaLixeira(['a', 'c'], banco, agora)).toBe(2)
    const todas = await banco.prescricoes.toArray()
    const por = Object.fromEntries(todas.map((p) => [p.id, p.excluidoEm]))
    expect(por).toEqual({ a: MOMENTO, b: null, c: MOMENTO })
    expect(todas.find((p) => p.id === 'a')!.atualizadoEm).toBe(MOMENTO)
  })

  it('ignora ids inexistentes e as que já estão na lixeira (sem trocar a data)', async () => {
    await banco.prescricoes.bulkPut([prescricaoTeste({ id: 'a', excluidoEm: '2026-01-02T00:00:00.000Z' })])
    expect(await moverPrescricoesParaLixeira(['a', 'nao-existe'], banco, agora)).toBe(0)
    expect((await banco.prescricoes.get('a'))!.excluidoEm).toBe('2026-01-02T00:00:00.000Z')
  })

  it('lista vazia não altera nada', async () => {
    await banco.prescricoes.put(prescricaoTeste({ id: 'a' }))
    expect(await moverPrescricoesParaLixeira([], banco, agora)).toBe(0)
    expect((await banco.prescricoes.get('a'))!.excluidoEm).toBeNull()
  })
})

describe('excluirGrupoComPrescricoes', () => {
  it('manda as prescrições do grupo para a lixeira e exclui o grupo, sem tocar nos outros', async () => {
    await banco.categorias.bulkPut([categoriaTeste({ id: 'cardio' }), categoriaTeste({ id: 'outro' })])
    await banco.prescricoes.bulkPut([
      prescricaoTeste({ id: 'a', categoriaId: 'cardio' }),
      prescricaoTeste({ id: 'b', categoriaId: 'cardio' }),
      prescricaoTeste({ id: 'c', categoriaId: 'outro' }),
      prescricaoTeste({ id: 'd', categoriaId: null }),
    ])
    expect(await excluirGrupoComPrescricoes('cardio', banco, agora)).toBe(2)
    const prescricoes = Object.fromEntries((await banco.prescricoes.toArray()).map((p) => [p.id, p.excluidoEm]))
    expect(prescricoes).toEqual({ a: MOMENTO, b: MOMENTO, c: null, d: null })
    expect((await banco.categorias.get('cardio'))!.excluidoEm).toBe(MOMENTO)
    expect((await banco.categorias.get('outro'))!.excluidoEm).toBeNull()
  })

  it('grupo vazio é excluído e devolve 0', async () => {
    await banco.categorias.put(categoriaTeste({ id: 'vazio' }))
    expect(await excluirGrupoComPrescricoes('vazio', banco, agora)).toBe(0)
    expect((await banco.categorias.get('vazio'))!.excluidoEm).toBe(MOMENTO)
  })

  it('grupo inexistente falha e não altera nada (tudo ou nada)', async () => {
    await banco.prescricoes.put(prescricaoTeste({ id: 'a', categoriaId: 'fantasma' }))
    await expect(excluirGrupoComPrescricoes('fantasma', banco, agora)).rejects.toThrow('Grupo não encontrado')
    expect((await banco.prescricoes.get('a'))!.excluidoEm).toBeNull()
  })
})

describe('apagarBibliotecaInteira', () => {
  it('apaga prescrições, calculadoras e grupos, inclusive a lixeira', async () => {
    await banco.categorias.put(categoriaTeste())
    await banco.prescricoes.bulkPut([prescricaoTeste({ id: 'a' }), prescricaoTeste({ id: 'b', excluidoEm: MOMENTO })])
    await apagarBibliotecaInteira(banco)
    expect(await banco.prescricoes.count()).toBe(0)
    expect(await banco.calculadoras.count()).toBe(0)
    expect(await banco.categorias.count()).toBe(0)
  })

  it('não apaga as configurações', async () => {
    await banco.configuracoes.put({ id: 'principal', tema: 'escuro' } as never)
    await apagarBibliotecaInteira(banco)
    expect(await banco.configuracoes.count()).toBe(1)
  })
})
