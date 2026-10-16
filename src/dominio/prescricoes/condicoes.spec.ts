// Dados fictícios para testes — nenhum conteúdo clínico real.
import { describe, expect, it } from 'vitest'
import type { ItemPrescricao } from '@/dominio/tipos'
import { calcularPrescricao, montarTextoCopia, OPCAO_PRINCIPAL } from '@/dominio/dose/prescricaoCalculada'
import { duplicarPrescricao, paraDados, regraDoseVazia, removerCondicao, validarPrescricao } from './editar'
import { itemEntraNaCopia, ordenarPorCondicao } from './condicoes'
import { filtrarPrescricoes } from './busca'
import { prescricaoTeste } from './fixtures.spec-helper'

const condicoes = [
  { id: 'c-a', nome: 'Condição Teste A' },
  { id: 'c-b', nome: 'Condição Teste B' },
]
const item = (id: string, condicaoId: string | null = null, extra: Partial<ItemPrescricao> = {}): ItemPrescricao => ({
  id,
  texto: `Medicamento Teste ${id}`,
  regraDose: null,
  alternativas: [],
  condicaoId,
  ...extra,
})

describe('ordem e cópia por condição', () => {
  it('"Sempre" primeiro, depois cada condição na ordem; estável dentro do grupo', () => {
    const itens = [item('1', 'c-b'), item('2'), item('3', 'c-a'), item('4', 'c-b'), item('5')]
    expect(ordenarPorCondicao(itens, condicoes).map((i) => i.id)).toEqual(['2', '5', '3', '1', '4'])
  })

  it('condição inexistente ou ausente conta como "Sempre"', () => {
    const semCampo = { id: 'x', texto: 'Medicamento Teste X', regraDose: null, alternativas: [] }
    expect(itemEntraNaCopia(semCampo, condicoes, {})).toBe(true)
    expect(itemEntraNaCopia(item('y', 'apagada'), condicoes, {})).toBe(true)
    expect(itemEntraNaCopia(item('z', 'c-a'), condicoes, {})).toBe(false)
    expect(itemEntraNaCopia(item('z', 'c-a'), condicoes, { 'c-a': true })).toBe(true)
  })

  it('copia "Sempre" + condições marcadas, renumerando', () => {
    const itens = [item('1'), item('2', 'c-a'), item('3', 'c-b')]
    const c = calcularPrescricao(itens, {}, null, condicoes, { 'c-b': true })
    expect(c.linhas.map((l) => l.copiar)).toEqual([true, false, true])
    expect(montarTextoCopia(c.linhas)).toBe('1. Medicamento Teste 1\n2. Medicamento Teste 3')
    expect(c.podeCopiar).toBe(true)
  })

  it('várias condições marcadas ao mesmo tempo', () => {
    const itens = [item('1', 'c-a'), item('2', 'c-b')]
    const c = calcularPrescricao(itens, {}, null, condicoes, { 'c-a': true, 'c-b': true })
    expect(montarTextoCopia(c.linhas)).toBe('1. Medicamento Teste 1\n2. Medicamento Teste 2')
  })

  it('só itens de condição e nenhuma marcada: nada para copiar, Copiar bloqueado', () => {
    const c = calcularPrescricao([item('1', 'c-a'), item('2', 'c-b')], {}, null, condicoes, {})
    expect(c.nadaParaCopiar).toBe(true)
    expect(c.podeCopiar).toBe(false)
  })

  it('item fora da cópia não exige peso nem escolha de opção', () => {
    const comRegra = item('1', 'c-a', { texto: 'Medicamento Teste {dose}', regraDose: { ...regraDoseVazia(), dosePorKg: 1, unidade: 'mg' } })
    const ou = item('2', 'c-a', { opcoesEquivalentes: true, alternativas: [{ id: 'alt', motivo: '', texto: 'Opção Teste 2', regraDose: null }] })
    const c = calcularPrescricao([item('0'), comRegra, ou], {}, null, condicoes, {})
    expect(c.precisaPeso).toBe(false)
    expect(c.itensSemEscolha).toEqual([])
    expect(c.podeCopiar).toBe(true)

    const marcada = calcularPrescricao([item('0'), comRegra, ou], { '2': OPCAO_PRINCIPAL }, null, condicoes, { 'c-a': true })
    expect(marcada.precisaPeso).toBe(true)
    expect(marcada.podeCopiar).toBe(false)
  })

  it('sem condições, comportamento antigo (tudo entra)', () => {
    const c = calcularPrescricao([item('1'), item('2')], {}, null)
    expect(c.linhas.every((l) => l.copiar)).toBe(true)
    expect(montarTextoCopia([{ texto: 'Texto Teste' }])).toBe('1. Texto Teste')
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
