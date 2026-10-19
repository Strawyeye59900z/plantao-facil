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
