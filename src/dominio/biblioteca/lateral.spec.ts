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

  it('todas devolve tudo', () => {
    expect(filtrarPorChave(itens, 'todas')).toHaveLength(3)
  })

  it('um id de grupo devolve os itens daquele grupo', () => {
    expect(filtrarPorChave(itens, 'g-b').map((i) => i.id)).toEqual(['p-2'])
  })
})
