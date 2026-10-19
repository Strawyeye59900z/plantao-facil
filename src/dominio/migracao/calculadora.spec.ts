import { describe, expect, it } from 'vitest'
import { migrarCalculadoraV1 } from './calculadora'
import type { CalculadoraFormulaV1 } from './v1/tipos'

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
})
