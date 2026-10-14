import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import type { Prescricao } from '@/dominio/tipos'
import {
  duplicarPrescricao,
  moverItem,
  normalizarTags,
  prescricaoVazia,
  regraDoseVazia,
  removerItem,
  validarPrescricao,
} from './editar'
import { prescricaoTeste } from './fixtures.spec-helper'

function geradorIds() {
  let n = 0
  return () => `novo-${++n}`
}

describe('duplicarPrescricao', () => {
  const original = prescricaoTeste({
    titulo: 'Situação Teste A',
    favorito: true,
    origem: 'importada_ia',
    revisada: false,
    itens: [
      {
        id: 'i-1',
        texto: 'Medicamento Teste A',
        regraDose: null,
        alternativas: [{ id: 'a-1', motivo: 'Motivo Teste', texto: 'Medicamento Teste B', regraDose: null }],
      },
    ],
    alertas: [
      { id: 'al-1', tipo: 'outro', gravidade: 'informativo', texto: 'Alerta Teste', itemId: 'i-1' },
      { id: 'al-2', tipo: 'outro', gravidade: 'critico', texto: 'Alerta Geral Teste', itemId: null },
    ],
  })

  it('gera IDs novos e mantém o vínculo alerta→item', () => {
    const copia = duplicarPrescricao(original, geradorIds())
    expect(copia.itens[0]!.id).toBe('novo-1')
    expect(copia.itens[0]!.alternativas[0]!.id).toBe('novo-2')
    expect(copia.alertas.map((a) => a.id)).toEqual(['novo-3', 'novo-4'])
    expect(copia.alertas[0]!.itemId).toBe('novo-1')
    expect(copia.alertas[1]!.itemId).toBeNull()
  })

  it('acrescenta "(cópia)", tira o favorito e mantém o status de revisão', () => {
    const copia = duplicarPrescricao(original, geradorIds())
    expect(copia.titulo).toBe('Situação Teste A (cópia)')
    expect(copia.favorito).toBe(false)
    expect(copia.revisada).toBe(false)
    expect(copia.origem).toBe('importada_ia')
    expect(copia).not.toHaveProperty('id')
  })

  it('aceita objetos reativos do Vue (store)', () => {
    const copia = duplicarPrescricao(reactive(structuredClone(original)) as Prescricao, geradorIds())
    expect(copia.titulo).toBe('Situação Teste A (cópia)')
  })

  it('não altera o original', () => {
    duplicarPrescricao(original, geradorIds())
    expect(original.itens[0]!.id).toBe('i-1')
    expect(original.titulo).toBe('Situação Teste A')
  })
})

describe('moverItem', () => {
  it('troca com o vizinho e ignora movimentos para fora da lista', () => {
    expect(moverItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(moverItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
    expect(moverItem(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(moverItem(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })
})

describe('removerItem', () => {
  it('remove o item e passa os alertas ligados a ele para a prescrição inteira', () => {
    const dados = prescricaoVazia(geradorIds())
    const itemId = dados.itens[0]!.id
    dados.alertas = [{ id: 'al', tipo: 'outro', gravidade: 'atencao', texto: 'Alerta Teste', itemId }]
    const resultado = removerItem(dados, itemId)
    expect(resultado.itens).toHaveLength(0)
    expect(resultado.alertas[0]!.itemId).toBeNull()
  })
})

describe('normalizarTags', () => {
  it('separa por vírgula, tira espaços, vazias e repetidas', () => {
    expect(normalizarTags(['  tag a, Tag A ,', 'tag b', ''])).toEqual(['tag a', 'tag b'])
  })
})

describe('validarPrescricao', () => {
  const existe = (id: string) => id === 'c-1'

  it('prescrição vazia: exige título, categoria e texto do item', () => {
    expect(validarPrescricao(prescricaoVazia(), existe)).toEqual([
      'Informe o título.',
      'Escolha a categoria.',
      'Item 1: texto vazio.',
    ])
  })

  it('exige pelo menos 1 item', () => {
    const dados = { ...prescricaoVazia(), titulo: 'T', categoriaId: 'c-1', itens: [] }
    expect(validarPrescricao(dados, existe)).toEqual(['Inclua pelo menos 1 item.'])
  })

  it('rejeita categoria excluída/inexistente', () => {
    const dados = { ...prescricaoTeste(), categoriaId: 'c-9' }
    expect(validarPrescricao(dados, existe)).toEqual(['Escolha a categoria.'])
  })

  it('exige texto e motivo nas alternativas e texto nos alertas', () => {
    const dados = prescricaoTeste({
      itens: [
        {
          id: 'i-1',
          texto: 'Medicamento Teste A',
          regraDose: null,
          alternativas: [{ id: 'a-1', motivo: ' ', texto: '', regraDose: null }],
        },
      ],
      alertas: [{ id: 'al', tipo: 'outro', gravidade: 'atencao', texto: '', itemId: null }],
    })
    expect(validarPrescricao(dados, existe)).toEqual([
      'Item 1, alternativa 1: texto vazio.',
      'Item 1, alternativa 1: informe o motivo.',
      'Alerta 1: texto vazio.',
    ])
  })

  it('valida regra de dose e marcadores de itens e alternativas', () => {
    const dados = prescricaoTeste({
      itens: [
        {
          id: 'i-1',
          texto: 'Medicamento Teste A {dose}',
          regraDose: regraDoseVazia(),
          alternativas: [{ id: 'a-1', motivo: 'Motivo Teste', texto: 'Medicamento Teste B {dose}', regraDose: null }],
        },
      ],
    })
    expect(validarPrescricao(dados, existe)).toEqual([
      'Item 1, regra de dose: dose por kg deve ser maior que zero.',
      'Item 1, regra de dose: informe a unidade.',
      'Item 1, alternativa 1: usa {dose} mas não tem regra de dose.',
    ])
  })

  it('opções equivalentes: motivo opcional, mas exige pelo menos 2 opções', () => {
    const item = { id: 'i-1', texto: 'Medicamento Teste A', regraDose: null, opcoesEquivalentes: true }
    expect(
      validarPrescricao(prescricaoTeste({ itens: [{ ...item, alternativas: [{ id: 'a', motivo: '', texto: 'Medicamento Teste B', regraDose: null }] }] }), existe),
    ).toEqual([])
    expect(validarPrescricao(prescricaoTeste({ itens: [{ ...item, alternativas: [] }] }), existe)).toEqual([
      'Item 1: opções equivalentes precisam de pelo menos 2 opções.',
    ])
  })

  it('prescrição completa é válida', () => {
    expect(validarPrescricao(prescricaoTeste(), existe)).toEqual([])
  })
})
