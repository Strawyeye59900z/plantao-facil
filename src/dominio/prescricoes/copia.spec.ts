import { describe, expect, it } from 'vitest'
import type { ItemPrescricao } from '@/dominio/tipos'
import { itensVisiveis, montarCopiaPrescricao } from './copia'
import { prescricaoTeste } from './fixtures.spec-helper'

function simples(id: string, texto: string, condicaoId: string | null = null): ItemPrescricao {
  return { id, condicaoId, opcoes: [{ id: `${id}-o`, texto, motivo: '' }] }
}

function ou(id: string, textos: string[], condicaoId: string | null = null): ItemPrescricao {
  return { id, condicaoId, opcoes: textos.map((texto, i) => ({ id: `${id}${i + 1}`, texto, motivo: '' })) }
}

const condicoes = [
  { id: 'x', nome: 'Condição Teste X' },
  { id: 'y', nome: 'Condição Teste Y' },
]

describe('itensVisiveis', () => {
  const itens = [
    simples('a', 'A'),
    simples('y1', 'Y1', 'y'),
    simples('x1', 'X1', 'x'),
    simples('c', 'C'),
  ]
  const p = prescricaoTeste({ itens, condicoes })

  it('sem condição marcada, só os itens "Sempre"', () => {
    expect(itensVisiveis(p, {}).map((i) => i.id)).toEqual(['a', 'c'])
  })

  it('"Sempre" primeiro, depois cada condição marcada na ordem das condições', () => {
    expect(itensVisiveis(p, { x: true, y: true }).map((i) => i.id)).toEqual(['a', 'c', 'x1', 'y1'])
    expect(itensVisiveis(p, { y: true }).map((i) => i.id)).toEqual(['a', 'c', 'y1'])
  })

  it('condição marcada como false não entra', () => {
    expect(itensVisiveis(p, { x: false, y: true }).map((i) => i.id)).toEqual(['a', 'c', 'y1'])
  })
})

describe('montarCopiaPrescricao', () => {
  it('"Sempre" + condições marcadas, renumerados', () => {
    const p = prescricaoTeste({
      itens: [
        simples('a', 'Medicamento Teste A'),
        simples('x1', 'Medicamento Teste B', 'x'),
        simples('y1', 'Medicamento Teste C', 'y'),
      ],
      condicoes,
    })
    expect(montarCopiaPrescricao(p, {}, {})).toEqual({ ok: true, texto: '1. Medicamento Teste A' })
    expect(montarCopiaPrescricao(p, { y: true }, {})).toEqual({
      ok: true,
      texto: '1. Medicamento Teste A\n2. Medicamento Teste C',
    })
    expect(montarCopiaPrescricao(p, { x: true, y: true }, {})).toEqual({
      ok: true,
      texto: '1. Medicamento Teste A\n2. Medicamento Teste B\n3. Medicamento Teste C',
    })
  })

  describe('item "OU"', () => {
    const p = prescricaoTeste({
      itens: [simples('A', 'A'), ou('B', ['b1', 'b2'], 'x'), simples('C', 'C')],
      condicoes,
    })

    it('condição desmarcada: o "OU" não bloqueia a cópia', () => {
      expect(montarCopiaPrescricao(p, {}, {})).toEqual({ ok: true, texto: '1. A\n2. C' })
    })

    it('condição marcada sem escolha: erro com o número VISÍVEL (renumerado)', () => {
      // ordem visível: A, C, B -> B é o 3º (posição de cadastro é 2)
      expect(montarCopiaPrescricao(p, { x: true }, {})).toEqual({ ok: false, erro: 'Falta escolher uma opção no item 3.' })
    })

    it('condição marcada com escolha: copia o texto da opção escolhida', () => {
      expect(montarCopiaPrescricao(p, { x: true }, { B: 'B2' })).toEqual({ ok: true, texto: '1. A\n2. C\n3. b2' })
    })

    it('escolha para uma opção que não existe no item conta como sem escolha', () => {
      expect(montarCopiaPrescricao(p, { x: true }, { B: 'inexistente' })).toEqual({
        ok: false,
        erro: 'Falta escolher uma opção no item 3.',
      })
    })

    it('opção de outro item não vale como escolha', () => {
      expect(montarCopiaPrescricao(p, { x: true }, { B: 'C-o' })).toEqual({
        ok: false,
        erro: 'Falta escolher uma opção no item 3.',
      })
    })

    it('com vários "OU" sem escolha, aponta o primeiro na ordem visível', () => {
      const q = prescricaoTeste({ itens: [ou('P', ['p1', 'p2']), ou('Q', ['q1', 'q2'])], condicoes: [] })
      expect(montarCopiaPrescricao(q, {}, { P: 'P1' })).toEqual({ ok: false, erro: 'Falta escolher uma opção no item 2.' })
      expect(montarCopiaPrescricao(q, {}, {})).toEqual({ ok: false, erro: 'Falta escolher uma opção no item 1.' })
    })
  })

  it('quebra de linha dentro da opção vira espaço', () => {
    const p = prescricaoTeste({ itens: [simples('a', 'Medicamento Teste A\n  1 comprimido\r\n a cada 8h')] })
    expect(montarCopiaPrescricao(p, {}, {})).toEqual({
      ok: true,
      texto: '1. Medicamento Teste A 1 comprimido a cada 8h',
    })
  })

  it('só itens condicionais e nada marcado: pede para marcar uma condição', () => {
    const p = prescricaoTeste({ itens: [simples('x1', 'X1', 'x'), simples('y1', 'Y1', 'y')], condicoes })
    expect(montarCopiaPrescricao(p, {}, {})).toEqual({ ok: false, erro: 'Marque a condição do paciente para copiar.' })
    expect(montarCopiaPrescricao(p, { x: false }, {})).toEqual({ ok: false, erro: 'Marque a condição do paciente para copiar.' })
    expect(montarCopiaPrescricao(p, { x: true }, {})).toEqual({ ok: true, texto: '1. X1' })
  })

  it('item com condição inexistente conta como "Sempre"', () => {
    const p = prescricaoTeste({ itens: [simples('a', 'A', 'removida')], condicoes })
    expect(montarCopiaPrescricao(p, {}, {})).toEqual({ ok: true, texto: '1. A' })
  })

  it('prescrição sem itens: nada para copiar', () => {
    const p = prescricaoTeste({ itens: [] })
    expect(montarCopiaPrescricao(p, {}, {})).toEqual({ ok: false, erro: 'Não há itens para copiar.' })
  })
})
