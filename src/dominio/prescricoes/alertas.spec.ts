import { describe, expect, it } from 'vitest'
import type { Alerta, ItemPrescricao } from '@/dominio/tipos'
import { alertasDaPrescricao } from './alertas'
import { prescricaoTeste } from './fixtures.spec-helper'

function item(id: string, condicaoId: string | null = null): ItemPrescricao {
  return { id, condicaoId, opcoes: [{ id: `${id}-o`, texto: `Medicamento Teste ${id}`, motivo: '' }] }
}

function alerta(id: string, itemId: string | null): Alerta {
  return { id, tipo: 'outro', gravidade: 'critico', texto: `Alerta teste ${id}`, itemId }
}

describe('alertasDaPrescricao', () => {
  const p = prescricaoTeste({
    condicoes: [{ id: 'x', nome: 'Condição Teste X' }],
    itens: [item('a'), item('x1', 'x')],
    alertas: [
      alerta('geral', null),
      alerta('do-item', 'a'),
      alerta('de-item-condicional', 'x1'),
      alerta('orfao', 'item-que-nao-existe'),
    ],
  })

  it('alerta sem item vai para o topo', () => {
    expect(alertasDaPrescricao(p).map((a) => a.id)).toContain('geral')
  })

  it('alerta de item existente fica com o item, mesmo sob condição não marcada', () => {
    const ids = alertasDaPrescricao(p).map((a) => a.id)
    expect(ids).not.toContain('do-item')
    expect(ids).not.toContain('de-item-condicional')
  })

  it('alerta ligado a item inexistente vai para o topo (nunca fica escondido)', () => {
    expect(alertasDaPrescricao(p).map((a) => a.id)).toEqual(['geral', 'orfao'])
  })
})
