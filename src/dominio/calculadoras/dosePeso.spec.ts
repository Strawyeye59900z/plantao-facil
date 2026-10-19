import { describe, expect, it } from 'vitest'
import type { LinhaDosePeso, RegraDosePeso } from '@/dominio/tipos'
import { calcularRegraDosePeso, montarLinhaDosePeso } from './dosePeso'

function regra(p: Partial<RegraDosePeso> = {}): RegraDosePeso {
  return {
    id: 'r1',
    marcador: 'inducao',
    dosePorKg: 1,
    unidade: 'mg',
    concentracao: null,
    doseMaxima: null,
    casasDecimais: 1,
    ...p,
  }
}

describe('calcularRegraDosePeso', () => {
  it('sem peso mostra a regra', () => {
    expect(calcularRegraDosePeso(regra(), null).texto).toBe('1 mg/kg')
  })
  it('sem peso mostra o máximo', () => {
    expect(calcularRegraDosePeso(regra({ doseMaxima: 50 }), null).texto).toBe('1 mg/kg (máx. 50 mg)')
  })
  it('70 kg', () => {
    expect(calcularRegraDosePeso(regra(), 70)).toEqual({ texto: '70 mg', limitada: false })
  })
  it('0,5 mg/kg', () => {
    expect(calcularRegraDosePeso(regra({ dosePorKg: 0.5 }), 70).texto).toBe('35 mg')
  })
  it('70,5 kg', () => {
    expect(calcularRegraDosePeso(regra(), 70.5).texto).toBe('70,5 mg')
  })
  it('aplica o máximo', () => {
    expect(calcularRegraDosePeso(regra({ doseMaxima: 50 }), 70)).toEqual({ texto: '50 mg', limitada: true })
  })
  it('concentração', () => {
    expect(calcularRegraDosePeso(regra({ concentracao: 5 }), 70).texto).toBe('70 mg (14 mL)')
  })
  it('volume com 1 casa', () => {
    expect(calcularRegraDosePeso(regra({ concentracao: 3 }), 10).texto).toBe('10 mg (3,3 mL)')
  })
  it('volume pequeno com 2 casas', () => {
    expect(calcularRegraDosePeso(regra({ dosePorKg: 0.2, concentracao: 5 }), 1).texto).toBe('0,2 mg (0,04 mL)')
  })
  it('volume menor que 0,005', () => {
    expect(
      calcularRegraDosePeso(regra({ dosePorKg: 0.01, casasDecimais: 2, concentracao: 5 }), 1).texto,
    ).toBe('0,01 mg (< 0,01 mL)')
  })
  it('empate de arredondamento', () => {
    expect(calcularRegraDosePeso(regra({ dosePorKg: 1.005, casasDecimais: 2 }), 1).texto).toBe('1,01 mg')
  })
  it('máximo com concentração', () => {
    expect(calcularRegraDosePeso(regra({ doseMaxima: 50, concentracao: 5 }), 70)).toEqual({
      texto: '50 mg (10 mL)',
      limitada: true,
    })
  })
  it('regra incompleta', () => {
    expect(calcularRegraDosePeso(regra({ dosePorKg: Number.NaN }), 70)).toEqual({
      texto: '[regra incompleta]',
      limitada: false,
    })
  })
  it('dose máxima inválida marca regra incompleta', () => {
    const esperado = { texto: '[regra incompleta]', limitada: false }
    expect(calcularRegraDosePeso(regra({ doseMaxima: Number.NaN }), 70)).toEqual(esperado)
    expect(calcularRegraDosePeso(regra({ doseMaxima: Number.POSITIVE_INFINITY }), null)).toEqual(esperado)
  })
  it('peso não finito é tratado como sem peso', () => {
    expect(calcularRegraDosePeso(regra(), Number.NaN).texto).toBe('1 mg/kg')
  })
  it('concentração inválida omite volume', () => {
    expect(calcularRegraDosePeso(regra({ concentracao: Number.NaN }), 70).texto).toBe('70 mg')
  })
})

describe('montarLinhaDosePeso', () => {
  const linha: LinhaDosePeso = {
    id: 'l1',
    texto: 'Medicamento Teste A {inducao} na indução e {manutencao} na manutenção',
    regras: [regra(), regra({ id: 'r2', marcador: 'manutencao', dosePorKg: 0.5 })],
  }
  it('monta partes', () => {
    expect(montarLinhaDosePeso(linha, 70)).toEqual([
      { tipo: 'texto', texto: 'Medicamento Teste A ' },
      { tipo: 'dose', texto: '70 mg', limitada: false },
      { tipo: 'texto', texto: ' na indução e ' },
      { tipo: 'dose', texto: '35 mg', limitada: false },
      { tipo: 'texto', texto: ' na manutenção' },
    ])
  })
  it('marcador sem regra fica literal', () => {
    expect(montarLinhaDosePeso({ id: 'l', texto: 'A {x} B', regras: [] }, 70)).toEqual([
      { tipo: 'texto', texto: 'A {x} B' },
    ])
  })
})
