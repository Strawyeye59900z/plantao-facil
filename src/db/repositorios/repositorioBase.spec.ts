import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { criarBanco, type BancoPlantao } from '@/db/banco'
import type { Categoria } from '@/dominio/tipos'
import { criarRepositorio, type Repositorio } from './repositorioBase'

let banco: BancoPlantao
let repo: Repositorio<Categoria>
let relogio: string[]
let contadorId: number

function proximoInstante(): string {
  const valor = relogio.shift()
  if (!valor) throw new Error('relógio de teste esgotado')
  return valor
}

beforeEach(() => {
  banco = criarBanco(`teste-${crypto.randomUUID()}`)
  relogio = [
    '2026-01-01T00:00:00.000Z',
    '2026-01-02T00:00:00.000Z',
    '2026-01-03T00:00:00.000Z',
    '2026-01-04T00:00:00.000Z',
  ]
  contadorId = 0
  repo = criarRepositorio(banco.categorias, {
    agora: proximoInstante,
    gerarId: () => `id-${++contadorId}`,
  })
})

afterEach(async () => {
  await banco.delete()
})

const dadosTeste = { nome: 'Categoria Teste A', escopo: 'prescricao' as const, ordem: 0, icone: null }

describe('repositorioBase', () => {
  it('criar preenche id, criadoEm, atualizadoEm e excluidoEm nulo', async () => {
    const criado = await repo.criar(dadosTeste)
    expect(criado).toEqual({
      ...dadosTeste,
      id: 'id-1',
      criadoEm: '2026-01-01T00:00:00.000Z',
      atualizadoEm: '2026-01-01T00:00:00.000Z',
      excluidoEm: null,
    })
    expect(await repo.obter('id-1')).toEqual(criado)
  })

  it('atualizar muda atualizadoEm e preserva id e criadoEm', async () => {
    await repo.criar(dadosTeste)
    const atualizado = await repo.atualizar('id-1', { nome: 'Categoria Teste B' })
    expect(atualizado.nome).toBe('Categoria Teste B')
    expect(atualizado.id).toBe('id-1')
    expect(atualizado.criadoEm).toBe('2026-01-01T00:00:00.000Z')
    expect(atualizado.atualizadoEm).toBe('2026-01-02T00:00:00.000Z')
  })

  it('mover para a lixeira é exclusão lógica', async () => {
    await repo.criar(dadosTeste)
    const naLixeira = await repo.moverParaLixeira('id-1')
    expect(naLixeira.excluidoEm).toBe('2026-01-02T00:00:00.000Z')
    expect(naLixeira.atualizadoEm).toBe('2026-01-02T00:00:00.000Z')
    expect(await repo.listarAtivos()).toHaveLength(0)
    expect(await repo.listarLixeira()).toHaveLength(1)
    expect(await repo.obter('id-1')).toBeDefined()
  })

  it('restaurar tira da lixeira', async () => {
    await repo.criar(dadosTeste)
    await repo.moverParaLixeira('id-1')
    const restaurado = await repo.restaurar('id-1')
    expect(restaurado.excluidoEm).toBeNull()
    expect(await repo.listarAtivos()).toHaveLength(1)
  })

  it('exclusão permanente só funciona para itens na lixeira', async () => {
    await repo.criar(dadosTeste)
    await expect(repo.excluirPermanentemente('id-1')).rejects.toThrow()
    expect(await repo.obter('id-1')).toBeDefined()

    await repo.moverParaLixeira('id-1')
    await repo.excluirPermanentemente('id-1')
    expect(await repo.obter('id-1')).toBeUndefined()
  })

  it('falha ao atualizar registro inexistente', async () => {
    await expect(repo.atualizar('nao-existe', { nome: 'x' })).rejects.toThrow()
  })
})
