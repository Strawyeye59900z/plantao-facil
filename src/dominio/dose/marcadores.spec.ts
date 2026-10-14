// Valores arbitrários de teste — nenhum conteúdo clínico real.
import { describe, expect, it } from 'vitest'
import type { ItemPrescricao, RegraDose } from '@/dominio/tipos'
import { calcularDose } from './calculo'
import { substituirMarcadores, textoTomadas, validarMarcadores } from './marcadores'
import { formatarNumero } from './numeros'
import { calcularPrescricao, montarTextoCopia, OPCAO_PRINCIPAL } from './prescricaoCalculada'
import { validarRegraDose } from './validarRegra'

const base: RegraDose = {
  dosePorKg: 10,
  unidade: 'mg',
  baseDoseKg: 'por_tomada',
  tomadasPorDia: 3,
  doseMaximaPorTomada: null,
  doseMaximaDiaria: null,
  pesoLimite: null,
  concentracao: { quantidade: 100, volumeMl: 5 },
  arredondamentoDose: { modo: 'inteiro' },
  arredondamentoVolume: { modo: 'casas_decimais', casas: 1 },
}

describe('formatarNumero', () => {
  it('vírgula decimal, sem zeros sobrando, sem separador de milhar', () => {
    expect(formatarNumero(2.5)).toBe('2,5')
    expect(formatarNumero(300)).toBe('300')
    expect(formatarNumero(1000)).toBe('1000')
    expect(formatarNumero(2.5 + 1e-12)).toBe('2,5')
  })
})

describe('marcadores', () => {
  it('substitui com valores e unidades', () => {
    const r = calcularDose(base, 15)
    expect(substituirMarcadores('Teste A {dose} ({volume}) {tomadas}, total {dose_diaria}', base, r)).toBe(
      'Teste A 150 mg (7,5 mL) de 8h em 8h, total 450 mg',
    )
  })

  it('aceita espaços dentro das chaves', () => {
    expect(substituirMarcadores('{ dose }', base, calcularDose(base, 1))).toBe('10 mg')
  })

  it('sem peso, mostra o nome do marcador; {tomadas} sai com o valor', () => {
    expect(substituirMarcadores('Teste A {dose} ({volume}) {tomadas}', base, null)).toBe('Teste A [dose] ([volume]) de 8h em 8h')
  })

  it('valida marcador desconhecido, sem regra, sem concentração e sem tomadas', () => {
    expect(validarMarcadores('{doze}', base)[0]).toMatch(/desconhecido \{doze\}/)
    expect(validarMarcadores('{dose}', null)).toEqual(['usa {dose} mas não tem regra de dose.'])
    expect(validarMarcadores('{volume}', { ...base, concentracao: null })).toEqual([
      'usa {volume} mas a regra não tem concentração.',
    ])
    expect(validarMarcadores('{dose_diaria} {tomadas}', { ...base, tomadasPorDia: null })).toHaveLength(2)
    expect(validarMarcadores('Texto sem marcador', null)).toEqual([])
  })
})

describe('{tomadas} como intervalo de horas', () => {
  it.each([
    [1, '1 vez ao dia'],
    [2, 'de 12h em 12h'],
    [3, 'de 8h em 8h'],
    [4, 'de 6h em 6h'],
    [6, 'de 4h em 4h'],
    [8, 'de 3h em 3h'],
    [12, 'de 2h em 2h'],
    [24, 'de 1h em 1h'],
  ])('%i tomada(s) → %s', (tomadas, texto) => {
    expect(textoTomadas(tomadas)).toBe(texto)
    expect(validarMarcadores('{tomadas}', { ...base, tomadasPorDia: tomadas })).toEqual([])
  })

  it.each([5, 7, 10])('%i tomadas não divide 24h: {tomadas} é bloqueado', (tomadas) => {
    expect(validarMarcadores('{tomadas}', { ...base, tomadasPorDia: tomadas })).toEqual([
      '{tomadas} exige 1, 2, 3, 4, 6, 8, 12, 24 tomadas por dia (intervalo exato em horas).',
    ])
    // A regra em si continua válida; só o marcador é bloqueado.
    expect(validarRegraDose({ ...base, tomadasPorDia: tomadas })).toEqual([])
  })
})

describe('validarRegraDose', () => {
  it('regra completa é válida', () => {
    expect(validarRegraDose(base)).toEqual([])
  })

  it('aponta campos inválidos', () => {
    const erros = validarRegraDose({
      ...base,
      dosePorKg: Number.NaN,
      unidade: ' ',
      baseDoseKg: 'por_dia',
      tomadasPorDia: null,
      doseMaximaDiaria: 100,
      pesoLimite: { acimaDeKg: 40, doseFixa: 2.5 },
      concentracao: { quantidade: 0, volumeMl: 5 },
      arredondamentoDose: { modo: 'multiplo', passo: 0.5, direcao: 'proximo' },
    })
    expect(erros).toEqual([
      'dose por kg deve ser maior que zero.',
      'informe a unidade.',
      'dose "por dia" exige tomadas por dia.',
      'dose máxima diária exige tomadas por dia.',
      'dose fixa deve ser um número inteiro maior que zero.',
      'concentração: os dois valores devem ser maiores que zero.',
      'arredondamento da dose: o passo deve ser inteiro maior que zero.',
    ])
  })
})

describe('calcularPrescricao e cópia', () => {
  const itens: ItemPrescricao[] = [
    {
      id: 'i1',
      texto: 'Medicamento Teste A {dose}\nlinha 2',
      regraDose: base,
      alternativas: [{ id: 'a1', motivo: 'Motivo Teste', texto: 'Medicamento Teste B', regraDose: null }],
    },
    { id: 'i2', texto: 'Medicamento Teste C', regraDose: null, alternativas: [] },
  ]

  it('sem peso: precisa de peso e bloqueia copiar', () => {
    const c = calcularPrescricao(itens, {}, null)
    expect(c.precisaPeso).toBe(true)
    expect(c.podeCopiar).toBe(false)
    expect(c.linhas[0]!.texto).toBe('Medicamento Teste A [dose]\nlinha 2')
  })

  it('com peso: libera e monta o texto numerado, sem quebras internas', () => {
    const c = calcularPrescricao(itens, {}, 10)
    expect(c.podeCopiar).toBe(true)
    expect(montarTextoCopia(c.linhas)).toBe('1. Medicamento Teste A 100 mg linha 2\n2. Medicamento Teste C')
  })

  it('alternativa sem regra substitui o item e dispensa o peso', () => {
    const c = calcularPrescricao(itens, { i1: 'a1' }, null)
    expect(c.precisaPeso).toBe(false)
    expect(c.podeCopiar).toBe(true)
    expect(montarTextoCopia(c.linhas)).toBe('1. Medicamento Teste B\n2. Medicamento Teste C')
  })

  describe('opções equivalentes (OU)', () => {
    const itemOu: ItemPrescricao = {
      id: 'ou',
      texto: 'Medicamento Teste E {dose}',
      regraDose: base,
      opcoesEquivalentes: true,
      alternativas: [
        { id: 'o2', motivo: '', texto: 'Medicamento Teste F', regraDose: null },
        { id: 'o3', motivo: 'Rótulo Teste', texto: 'Medicamento Teste G', regraDose: null },
      ],
    }
    const lista = [itemOu, itens[1]!]

    it('nenhuma vem escolhida: copiar bloqueado e item listado como pendente', () => {
      const c = calcularPrescricao(lista, {}, 10)
      expect(c.itensSemEscolha).toEqual([1])
      expect(c.podeCopiar).toBe(false)
      expect(c.linhas[0]!.escolhaPendente).toBe(true)
      // todas as opções calculadas para mostrar por extenso
      expect(c.linhas[0]!.opcoes.map((o) => o.texto)).toEqual(['Medicamento Teste E 100 mg', 'Medicamento Teste F', 'Medicamento Teste G'])
    })

    it('escolher a opção 1 (principal) usa o texto do item e sua regra', () => {
      const c = calcularPrescricao(lista, { ou: OPCAO_PRINCIPAL }, 10)
      expect(c.podeCopiar).toBe(true)
      expect(montarTextoCopia(c.linhas)).toBe('1. Medicamento Teste E 100 mg\n2. Medicamento Teste C')
    })

    it('escolher outra opção copia só ela; sem regra, dispensa o peso', () => {
      const c = calcularPrescricao(lista, { ou: 'o3' }, null)
      expect(c.precisaPeso).toBe(false)
      expect(c.podeCopiar).toBe(true)
      expect(montarTextoCopia(c.linhas)).toBe('1. Medicamento Teste G\n2. Medicamento Teste C')
    })

    it('opção 1 com regra e sem peso: escolhida mas ainda precisa do peso', () => {
      const c = calcularPrescricao(lista, { ou: OPCAO_PRINCIPAL }, null)
      expect(c.itensSemEscolha).toEqual([])
      expect(c.precisaPeso).toBe(true)
      expect(c.podeCopiar).toBe(false)
    })
  })

  it('erro de cálculo bloqueia copiar', () => {
    const c = calcularPrescricao([{ ...itens[0]!, regraDose: { ...base, dosePorKg: 0.01 } }], {}, 10)
    expect(c.podeCopiar).toBe(false)
  })
})
