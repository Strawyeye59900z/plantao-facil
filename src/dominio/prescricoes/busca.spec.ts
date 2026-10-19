import { describe, expect, it } from 'vitest'
import { filtrarPrescricoes } from './busca'
import { prescricaoTeste } from './fixtures.spec-helper'

const nomes: Record<string, string> = { 'c-1': 'Categoria Ácida', 'c-2': 'Outra Categoria' }
const nomeCategoria = (id: string | null) => (id ? (nomes[id] ?? '') : '')

const lista = [
  prescricaoTeste({ id: 'p-1', titulo: 'Situação Teste Pressão', categoriaId: 'c-1' }),
  prescricaoTeste({
    id: 'p-2',
    titulo: 'Situação Teste B',
    categoriaId: 'c-2',
    tags: ['etiqueta-x'],
    observacoes: 'Nota Zeta',
    receita: 'Receita Sigma',
    itens: [
      {
        id: 'i-2',
        condicaoId: null,
        opcoes: [
          { id: 'o-1', texto: 'Medicamento Teste B', motivo: '' },
          { id: 'o-2', texto: 'Medicamento Kappa', motivo: 'Motivo Ômega' },
        ],
      },
    ],
  }),
]

function ids(termo: string) {
  return filtrarPrescricoes(lista, termo, nomeCategoria).map((p) => p.id)
}

describe('filtrarPrescricoes', () => {
  it('termo vazio devolve tudo', () => {
    expect(ids('   ')).toEqual(['p-1', 'p-2'])
  })

  it('busca no título ignorando acentos e maiúsculas', () => {
    expect(ids('PRESSAO')).toEqual(['p-1'])
    expect(ids('situação')).toEqual(['p-1', 'p-2'])
  })

  it('busca no nome da categoria', () => {
    expect(ids('acida')).toEqual(['p-1'])
  })

  it('busca nas tags', () => {
    expect(ids('etiqueta-x')).toEqual(['p-2'])
  })

  it('busca no texto da primeira opção dos itens', () => {
    expect(ids('medicamento teste b')).toEqual(['p-2'])
  })

  it('busca no motivo e no texto das demais opções', () => {
    expect(ids('omega')).toEqual(['p-2'])
    expect(ids('kappa')).toEqual(['p-2'])
  })

  it('busca nas observações e na receita pronta', () => {
    expect(ids('zeta')).toEqual(['p-2'])
    expect(ids('sigma')).toEqual(['p-2'])
  })

  it('todas as palavras precisam aparecer (em campos diferentes vale)', () => {
    expect(ids('zeta outra')).toEqual(['p-2'])
    expect(ids('zeta acida')).toEqual([])
  })
})
