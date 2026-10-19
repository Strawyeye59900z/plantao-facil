// Dados fictícios para testes — nenhum conteúdo clínico real.
import { describe, expect, it } from 'vitest'
import type { ItemPrescricao } from '@/dominio/tipos'
import { duplicarPrescricao, paraDados, removerCondicao, validarPrescricao } from './editar'
import { itemEntraNaCopia, ordenarPorCondicao } from './condicoes'
import { filtrarPrescricoes } from './busca'
import { prescricaoTeste } from './fixtures.spec-helper'

const condicoes = [
  { id: 'c-a', nome: 'Condição Teste A' },
  { id: 'c-b', nome: 'Condição Teste B' },
]
const item = (id: string, condicaoId: string | null = null): ItemPrescricao => ({
  id,
  condicaoId,
  opcoes: [{ id: `o-${id}`, texto: `Medicamento Teste ${id}`, motivo: '' }],
})

describe('ordem e cópia por condição', () => {
  it('"Sempre" primeiro, depois cada condição na ordem; estável dentro do grupo', () => {
    const itens = [item('1', 'c-b'), item('2'), item('3', 'c-a'), item('4', 'c-b'), item('5')]
    expect(ordenarPorCondicao(itens, condicoes).map((i) => i.id)).toEqual(['2', '5', '3', '1', '4'])
  })

  it('condição inexistente ou ausente conta como "Sempre"', () => {
    // Registro sem o campo (dado malformado) continua valendo "Sempre".
    const semCampo = { id: 'x', opcoes: [{ id: 'o-x', texto: 'Medicamento Teste X', motivo: '' }] } as unknown as ItemPrescricao
    expect(itemEntraNaCopia(semCampo, condicoes, {})).toBe(true)
    expect(itemEntraNaCopia(item('y', 'apagada'), condicoes, {})).toBe(true)
    expect(itemEntraNaCopia(item('z', 'c-a'), condicoes, {})).toBe(false)
    expect(itemEntraNaCopia(item('z', 'c-a'), condicoes, { 'c-a': true })).toBe(true)
  })
})

describe('edição com condições', () => {
  const p = prescricaoTeste({ condicoes, itens: [item('1'), item('2', 'c-a'), item('3', 'c-b')] })

  it('remover condição: itens dela viram "Sempre" e vão para o grupo "Sempre"', () => {
    const d = removerCondicao(paraDados(p), 'c-a')
    expect(d.condicoes.map((c) => c.id)).toEqual(['c-b'])
    expect(d.itens.map((i) => [i.id, i.condicaoId])).toEqual([
      ['1', null],
      ['2', null],
      ['3', 'c-b'],
    ])
  })

  it('duplicar dá IDs novos às condições e mantém o vínculo dos itens', () => {
    let n = 0
    const d = duplicarPrescricao(p, () => `novo-${++n}`)
    const [ca, cb] = d.condicoes
    expect(ca!.id).not.toBe('c-a')
    expect(d.itens[1]!.condicaoId).toBe(ca!.id)
    expect(d.itens[2]!.condicaoId).toBe(cb!.id)
    expect(d.itens[0]!.condicaoId).toBeNull()
  })

  it('condição sem nome bloqueia salvar', () => {
    const d = { ...paraDados(p), condicoes: [{ id: 'c-a', nome: '  ' }] }
    expect(validarPrescricao(d, () => true)).toContain('Condição 1: informe o nome.')
  })

  it('busca encontra pelo nome da condição', () => {
    expect(filtrarPrescricoes([p], 'condicao teste b', () => '').length).toBe(1)
  })
})
