import { describe, expect, it } from 'vitest'
import { migrarCalculadoraV1 } from './calculadora'
import type { CalculadoraFormulaV1, CalculadoraPontosV1 } from './v1/tipos'

const T = '2026-01-01T00:00:00.000Z'

describe('migrarCalculadoraV1', () => {
  it('fórmula da v1 vira campos numéricos + uma saída "Resultado"', () => {
    const v1: CalculadoraFormulaV1 = {
      id: 'c1', criadoEm: T, atualizadoEm: T, excluidoEm: null, tipo: 'formula', nome: 'Fórmula Teste',
      categoriaId: null, descricao: '', referencia: '', favorito: false,
      faixas: [{ id: 'f1', de: null, ate: 1, texto: 'Faixa Teste', gravidade: 'informativo' }],
      entradas: [{ id: 'e1', variavel: 'a', rotulo: 'A', unidade: 'u', min: 0, max: 10 }],
      expressao: 'a * 2', unidadeResultado: 'u', casasDecimais: 2, teto: 9, piso: null,
    }
    const v2 = migrarCalculadoraV1(v1)
    expect(v2).toMatchObject({ area: 'calculadora', tipo: 'formula' })
    expect(v2).not.toHaveProperty('entradas')
    if (v2.tipo !== 'formula') throw new Error('tipo')
    expect(v2.campos).toEqual([{ id: 'e1', tipo: 'numero', variavel: 'a', rotulo: 'A', unidade: 'u', min: 0, max: 10 }])
    expect(v2.saidas).toEqual([
      { id: 'c1-saida', nome: 'Resultado', expressao: 'a * 2', unidade: 'u', casasDecimais: 2, teto: 9, piso: null, faixas: v1.faixas },
    ])
  })

  it('pontos da v1 só ganha area "escala"', () => {
    const v1: CalculadoraPontosV1 = {
      id: 'p1', criadoEm: T, atualizadoEm: T, excluidoEm: null, tipo: 'pontos', nome: 'Escore Teste',
      categoriaId: 'cat', descricao: 'd', referencia: 'r', favorito: true,
      faixas: [{ id: 'f1', de: 0, ate: 2, texto: 'Faixa Teste', gravidade: 'atencao' }],
      campos: [{ id: 'c1', tipo: 'sim_nao', rotulo: 'Campo Teste', pontosSim: 1, pontosNao: 0 }],
    }
    expect(migrarCalculadoraV1(v1)).toEqual({ ...v1, area: 'escala' })
  })

  it('faixas da saída são cópia das da v1', () => {
    const faixas = [{ id: 'f1', de: null, ate: 1, texto: 'Faixa Teste', gravidade: 'informativo' as const }]
    const v1: CalculadoraFormulaV1 = {
      id: 'c1', criadoEm: T, atualizadoEm: T, excluidoEm: null, tipo: 'formula', nome: 'F',
      categoriaId: null, descricao: '', referencia: '', favorito: false, faixas,
      entradas: [], expressao: 'a', unidadeResultado: '', casasDecimais: 1, teto: null, piso: null,
    }
    const v2 = migrarCalculadoraV1(v1)
    if (v2.tipo !== 'formula') throw new Error('tipo')
    expect(v2.saidas[0]!.faixas).toEqual(faixas)
    expect(v2.saidas[0]!.faixas).not.toBe(faixas)
    expect(v2.saidas[0]!.faixas[0]).not.toBe(faixas[0])
  })
})
