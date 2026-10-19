import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import type { Prescricao } from '@/dominio/tipos'
import {
  duplicarPrescricao,
  moverItem,
  normalizarTags,
  itemVazio,
  opcaoVazia,
  prescricaoVazia,
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
        condicaoId: null,
        opcoes: [
          { id: 'o-1', texto: 'Medicamento Teste A', motivo: '' },
          { id: 'o-2', texto: 'Medicamento Teste B', motivo: 'Motivo Teste' },
        ],
      },
    ],
    alertas: [
      { id: 'al-1', tipo: 'outro', gravidade: 'informativo', texto: 'Alerta Teste', itemId: 'i-1' },
      { id: 'al-2', tipo: 'outro', gravidade: 'critico', texto: 'Alerta Geral Teste', itemId: null },
    ],
  })

  it('gera IDs novos (também nas opções) e mantém o vínculo alerta→item', () => {
    const copia = duplicarPrescricao(original, geradorIds())
    expect(copia.itens[0]!.id).toBe('novo-1')
    expect(copia.itens[0]!.opcoes).toEqual([
      { id: 'novo-2', texto: 'Medicamento Teste A', motivo: '' },
      { id: 'novo-3', texto: 'Medicamento Teste B', motivo: 'Motivo Teste' },
    ])
    expect(copia.alertas.map((a) => a.id)).toEqual(['novo-4', 'novo-5'])
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
    expect(original.itens[0]!.opcoes[0]!.id).toBe('o-1')
    expect(original.titulo).toBe('Situação Teste A')
  })
})

describe('itens vazios', () => {
  it('item novo vem com uma opção vazia', () => {
    expect(itemVazio(geradorIds(), 'c-a')).toEqual({ id: 'novo-1', condicaoId: 'c-a', opcoes: [{ id: 'novo-2', texto: '', motivo: '' }] })
    expect(opcaoVazia(geradorIds())).toEqual({ id: 'novo-1', texto: '', motivo: '' })
  })

  it('prescrição nova sem calculadoras ligadas', () => {
    expect(prescricaoVazia().calculadoraIds).toEqual([])
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
      'Escolha o grupo.',
      'Item 1: texto vazio.',
    ])
  })

  it('exige pelo menos 1 item', () => {
    const dados = { ...prescricaoVazia(), titulo: 'T', categoriaId: 'c-1', itens: [] }
    expect(validarPrescricao(dados, existe)).toEqual(['Inclua pelo menos 1 item.'])
  })

  it('rejeita categoria excluída/inexistente', () => {
    const dados = { ...prescricaoTeste(), categoriaId: 'c-9' }
    expect(validarPrescricao(dados, existe)).toEqual(['Escolha o grupo.'])
  })

  it('exige texto em todas as opções (motivo é opcional) e texto nos alertas', () => {
    const dados = prescricaoTeste({
      itens: [
        {
          id: 'i-1',
          condicaoId: null,
          opcoes: [
            { id: 'o-1', texto: 'Medicamento Teste A', motivo: '' },
            { id: 'o-2', texto: ' ', motivo: 'Motivo Teste' },
          ],
        },
        { id: 'i-2', condicaoId: null, opcoes: [{ id: 'o-3', texto: '', motivo: '' }] },
      ],
      alertas: [{ id: 'al', tipo: 'outro', gravidade: 'atencao', texto: '', itemId: null }],
    })
    expect(validarPrescricao(dados, existe)).toEqual([
      'Item 1, opção 2: texto vazio.',
      'Item 2: texto vazio.',
      'Alerta 1: texto vazio.',
    ])
  })

  it('item "OU" com opções preenchidas e sem motivo é válido', () => {
    const dados = prescricaoTeste({
      itens: [
        {
          id: 'i-1',
          condicaoId: null,
          opcoes: [
            { id: 'o-1', texto: 'Opção Teste 1', motivo: '' },
            { id: 'o-2', texto: 'Opção Teste 2', motivo: '' },
          ],
        },
      ],
    })
    expect(validarPrescricao(dados, existe)).toEqual([])
  })

  it('prescrição completa é válida', () => {
    expect(validarPrescricao(prescricaoTeste(), existe)).toEqual([])
  })
})
