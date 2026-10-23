import { describe, expect, it } from 'vitest'
import { aplicarMesclagem, planejarMesclagem } from '@/dominio/backup/backup'
import { categoriaTeste, prescricaoTeste } from '@/dominio/prescricoes/fixtures.spec-helper'
import type { Calculadora } from '@/dominio/tipos'
import { marcarComoRecebidas, montarPacote, ORIGEM_RECEBIDA } from './pacote'

const calculadoraTeste = (parcial: Partial<Calculadora> = {}) =>
  ({
    id: 'calc-1',
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    excluidoEm: null,
    nome: 'Calculadora Teste A',
    categoriaId: null,
    descricao: '',
    referencia: '',
    favorito: true,
    area: 'calculadora',
    tipo: 'formula',
    campos: [],
    saidas: [],
    ...parcial,
  }) as unknown as Calculadora

const AGORA = '2026-05-05T10:00:00.000Z'

describe('montarPacote', () => {
  it('leva só as prescrições escolhidas e ativas, sem favorito', () => {
    const b = {
      prescricoes: [
        prescricaoTeste({ id: 'a', favorito: true }),
        prescricaoTeste({ id: 'b' }),
        prescricaoTeste({ id: 'c', excluidoEm: AGORA }),
      ],
      calculadoras: [],
      categorias: [categoriaTeste()],
    }
    const pacote = montarPacote(b, ['a', 'c', 'nao-existe'], AGORA, '9.9')
    expect(pacote.prescricoes.map((p) => p.id)).toEqual(['a'])
    expect(pacote.prescricoes[0]!.favorito).toBe(false)
    expect(pacote.exportadoEm).toBe(AGORA)
    expect(pacote.versaoApp).toBe('9.9')
  })

  it('leva só os grupos usados e as calculadoras ligadas (com o grupo delas)', () => {
    const b = {
      prescricoes: [prescricaoTeste({ id: 'a', categoriaId: 'g1', calculadoraIds: ['calc-1', 'calc-na-lixeira'] }), prescricaoTeste({ id: 'b', categoriaId: 'g3' })],
      calculadoras: [
        calculadoraTeste({ id: 'calc-1', categoriaId: 'g2' }),
        calculadoraTeste({ id: 'calc-na-lixeira', excluidoEm: AGORA }),
        calculadoraTeste({ id: 'calc-solta' }),
      ],
      categorias: [
        categoriaTeste({ id: 'g1' }),
        categoriaTeste({ id: 'g2', escopo: 'calculadora' }),
        categoriaTeste({ id: 'g3' }),
        categoriaTeste({ id: 'g4' }),
        categoriaTeste({ id: 'g5', excluidoEm: AGORA }),
      ],
    }
    const pacote = montarPacote(b, ['a'], AGORA, '1')
    expect(pacote.calculadoras.map((c) => c.id)).toEqual(['calc-1'])
    expect(pacote.calculadoras[0]!.favorito).toBe(false)
    expect(pacote.categorias.map((c) => c.id).sort()).toEqual(['g1', 'g2'])
  })

  it('prescrição sem grupo nem calculadora gera pacote só com ela', () => {
    const b = { prescricoes: [prescricaoTeste({ id: 'a', categoriaId: null })], calculadoras: [], categorias: [categoriaTeste()] }
    const pacote = montarPacote(b, ['a'], AGORA, '1')
    expect(pacote.categorias).toEqual([])
    expect(pacote.calculadoras).toEqual([])
  })
})

describe('receber', () => {
  it('marca como recebida e não revisada', () => {
    const [p] = marcarComoRecebidas([prescricaoTeste({ origem: 'manual', revisada: true })])
    expect(p!.origem).toBe(ORIGEM_RECEBIDA)
    expect(p!.revisada).toBe(false)
  })

  it('só o que entra pela mesclagem é marcado; o que já era igual no aparelho fica como está', () => {
    const local = {
      prescricoes: [prescricaoTeste({ id: 'igual', revisada: true })],
      calculadoras: [],
      categorias: [categoriaTeste()],
    }
    const arquivo = {
      prescricoes: [prescricaoTeste({ id: 'igual', revisada: true }), prescricaoTeste({ id: 'nova' })],
      calculadoras: [],
      categorias: [categoriaTeste()],
    }
    const aGravar = aplicarMesclagem(planejarMesclagem(local, arquivo), {})
    const marcadas = marcarComoRecebidas(aGravar.prescricoes)
    expect(marcadas.map((p) => [p.id, p.origem, p.revisada])).toEqual([['nova', ORIGEM_RECEBIDA, false]])
  })
})
