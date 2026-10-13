import { describe, expect, it } from 'vitest'
import { agruparPorCategoria } from './agrupar'
import { categoriaTeste, prescricaoTeste } from './fixtures.spec-helper'

describe('agruparPorCategoria', () => {
  const categorias = [
    categoriaTeste({ id: 'c-1', nome: 'Categoria B', ordem: 1 }),
    categoriaTeste({ id: 'c-2', nome: 'Categoria A', ordem: 0 }),
    categoriaTeste({ id: 'c-3', nome: 'Categoria Vazia', ordem: 2 }),
    categoriaTeste({ id: 'c-4', nome: 'Categoria Excluída', ordem: 3, excluidoEm: '2026-01-02T00:00:00.000Z' }),
  ]

  it('ordena grupos pela ordem cadastrada e títulos alfabeticamente; omite grupos vazios', () => {
    const grupos = agruparPorCategoria(
      [
        prescricaoTeste({ id: 'p-1', titulo: 'Zeta', categoriaId: 'c-1' }),
        prescricaoTeste({ id: 'p-2', titulo: 'Ômega', categoriaId: 'c-1' }),
        prescricaoTeste({ id: 'p-3', titulo: 'Alfa', categoriaId: 'c-2' }),
      ],
      categorias,
    )
    expect(grupos.map((g) => g.categoria?.id)).toEqual(['c-2', 'c-1'])
    expect(grupos[1]!.prescricoes.map((p) => p.titulo)).toEqual(['Ômega', 'Zeta'])
  })

  it('sem categoria, categoria inexistente ou excluída vão para "Sem categoria" no fim', () => {
    const grupos = agruparPorCategoria(
      [
        prescricaoTeste({ id: 'p-1', titulo: 'B', categoriaId: null }),
        prescricaoTeste({ id: 'p-2', titulo: 'A', categoriaId: 'nao-existe' }),
        prescricaoTeste({ id: 'p-3', titulo: 'C', categoriaId: 'c-4' }),
        prescricaoTeste({ id: 'p-4', titulo: 'D', categoriaId: 'c-2' }),
      ],
      categorias,
    )
    expect(grupos.map((g) => g.categoria?.id ?? null)).toEqual(['c-2', null])
    expect(grupos[1]!.prescricoes.map((p) => p.titulo)).toEqual(['A', 'B', 'C'])
  })
})
