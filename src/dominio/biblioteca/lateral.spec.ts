import { describe, expect, it } from 'vitest'
import { categoriaTeste, prescricaoTeste } from '@/dominio/prescricoes/fixtures.spec-helper'
import { filtrarPorChave, montarLateral } from './lateral'

const grupoA = categoriaTeste({ id: 'g-a', nome: 'Grupo Teste A', ordem: 1, icone: 'prancheta' })
const grupoB = categoriaTeste({ id: 'g-b', nome: 'Grupo Teste B', ordem: 0 })

describe('montarLateral', () => {
  it('ordem: favoritos, todas, grupos na ordem cadastrada e sem-grupo', () => {
    const itens = [
      prescricaoTeste({ id: 'p-1', categoriaId: 'g-a' }),
      prescricaoTeste({ id: 'p-2', categoriaId: 'g-b' }),
      prescricaoTeste({ id: 'p-3', categoriaId: null }),
    ]
    const lateral = montarLateral(itens, [grupoA, grupoB])
    expect(lateral.map((e) => e.chave)).toEqual(['favoritos', 'todas', 'g-b', 'g-a', 'sem-grupo'])
    expect(lateral[0]).toMatchObject({ rotulo: 'Favoritos', icone: 'estrela' })
    expect(lateral[1]).toMatchObject({ rotulo: 'Todas' })
    expect(lateral[3]).toMatchObject({ rotulo: 'Grupo Teste A', icone: 'prancheta' })
    expect(lateral[4]).toMatchObject({ rotulo: 'Sem grupo', icone: null })
  })

  it('sem-grupo só aparece se houver item sem grupo', () => {
    const lateral = montarLateral([prescricaoTeste({ categoriaId: 'g-a' })], [grupoA])
    expect(lateral.map((e) => e.chave)).toEqual(['favoritos', 'todas', 'g-a'])
  })

  it('favoritos aparece mesmo com quantidade 0', () => {
    const lateral = montarLateral([], [])
    expect(lateral).toHaveLength(2)
    expect(lateral[0]).toMatchObject({ chave: 'favoritos', quantidade: 0 })
    expect(lateral[1]).toMatchObject({ chave: 'todas', quantidade: 0 })
  })

  it('conta os itens de cada entrada; grupo vazio aparece com 0', () => {
    const itens = [
      prescricaoTeste({ id: 'p-1', categoriaId: 'g-a', favorito: true }),
      prescricaoTeste({ id: 'p-2', categoriaId: 'g-a' }),
      prescricaoTeste({ id: 'p-3', categoriaId: null, favorito: true }),
    ]
    const lateral = montarLateral(itens, [grupoA, grupoB])
    const quantidades = Object.fromEntries(lateral.map((e) => [e.chave, e.quantidade]))
    expect(quantidades).toEqual({ favoritos: 2, todas: 3, 'g-b': 0, 'g-a': 2, 'sem-grupo': 1 })
  })

  it('item de grupo desconhecido ou excluído conta como sem-grupo', () => {
    const excluido = categoriaTeste({ id: 'g-x', nome: 'Grupo Teste X', excluidoEm: '2026-02-01T00:00:00.000Z' })
    const itens = [
      prescricaoTeste({ id: 'p-1', categoriaId: 'g-a' }),
      prescricaoTeste({ id: 'p-2', categoriaId: 'g-inexistente' }),
      prescricaoTeste({ id: 'p-3', categoriaId: 'g-x' }),
    ]
    const lateral = montarLateral(itens, [grupoA, excluido])
    const quantidades = Object.fromEntries(lateral.map((e) => [e.chave, e.quantidade]))
    expect(quantidades).toEqual({ favoritos: 0, todas: 3, 'g-a': 1, 'sem-grupo': 2 })
  })

  it('omite grupos com excluidoEm preenchido', () => {
    const excluido = categoriaTeste({ id: 'g-x', nome: 'Grupo Teste X', excluidoEm: '2026-02-01T00:00:00.000Z' })
    const lateral = montarLateral([], [grupoA, excluido])
    expect(lateral.map((e) => e.chave)).toEqual(['favoritos', 'todas', 'g-a'])
  })

  it('empate em ordem desempata pelo nome', () => {
    const z = categoriaTeste({ id: 'g-z', nome: 'Zeta Teste', ordem: 5 })
    const a = categoriaTeste({ id: 'g-a2', nome: 'Alfa Teste', ordem: 5 })
    const lateral = montarLateral([], [z, a])
    expect(lateral.map((e) => e.chave)).toEqual(['favoritos', 'todas', 'g-a2', 'g-z'])
  })
})

describe('filtrarPorChave', () => {
  const itens = [
    prescricaoTeste({ id: 'p-1', categoriaId: 'g-a', favorito: true }),
    prescricaoTeste({ id: 'p-2', categoriaId: 'g-b' }),
    prescricaoTeste({ id: 'p-3', categoriaId: null }),
  ]

  it('favoritos devolve só favorito: true', () => {
    expect(filtrarPorChave(itens, 'favoritos').map((i) => i.id)).toEqual(['p-1'])
  })

  it('sem-grupo devolve só categoriaId null', () => {
    expect(filtrarPorChave(itens, 'sem-grupo').map((i) => i.id)).toEqual(['p-3'])
  })

  it('sem-grupo, com os grupos informados, inclui item de grupo desconhecido ou excluído', () => {
    const excluido = categoriaTeste({ id: 'g-x', nome: 'Grupo Teste X', excluidoEm: '2026-02-01T00:00:00.000Z' })
    const com = [
      ...itens,
      prescricaoTeste({ id: 'p-4', categoriaId: 'g-inexistente' }),
      prescricaoTeste({ id: 'p-5', categoriaId: 'g-x' }),
    ]
    const resultado = filtrarPorChave(com, 'sem-grupo', [grupoA, grupoB, excluido])
    expect(resultado.map((i) => i.id)).toEqual(['p-3', 'p-4', 'p-5'])
  })

  it('todas devolve tudo', () => {
    expect(filtrarPorChave(itens, 'todas')).toHaveLength(3)
  })

  it('um id de grupo devolve os itens daquele grupo', () => {
    expect(filtrarPorChave(itens, 'g-b').map((i) => i.id)).toEqual(['p-2'])
  })
})
