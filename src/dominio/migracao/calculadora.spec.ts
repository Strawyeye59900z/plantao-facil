import { describe, expect, it } from 'vitest'
import { migrarBibliotecaV1 } from './biblioteca'
import { migrarCalculadoraV1, migrarGruposV1 } from './calculadora'
import type { CalculadoraFormulaV1, CalculadoraPontosV1, CategoriaV1 } from './v1/tipos'

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

describe('migrarCalculadoraV1 — registros crus', () => {
  it('registro cru sem faixas/campos/entradas não quebra (vira lista vazia)', () => {
    const pontos = { id: 'p1', criadoEm: T, atualizadoEm: T, excluidoEm: null, tipo: 'pontos', nome: 'Escore Teste', categoriaId: null, descricao: '', referencia: '', favorito: false } as unknown as CalculadoraPontosV1
    expect(migrarCalculadoraV1(pontos)).toMatchObject({ area: 'escala', tipo: 'pontos', campos: [], faixas: [] })
    const formula = {
      id: 'c1', criadoEm: T, atualizadoEm: T, excluidoEm: null, tipo: 'formula', nome: 'F', categoriaId: null, descricao: '',
      referencia: '', favorito: false, expressao: 'a', unidadeResultado: '', casasDecimais: 1, teto: null, piso: null,
    } as unknown as CalculadoraFormulaV1
    const v2 = migrarCalculadoraV1(formula)
    if (v2.tipo !== 'formula') throw new Error('tipo')
    expect(v2.campos).toEqual([])
    expect(v2.saidas[0]!.faixas).toEqual([])
  })

  it('registro que já tem "area" (já convertido) passa sem mudança', () => {
    const atual = {
      id: 'c1', criadoEm: T, atualizadoEm: T, excluidoEm: null, area: 'calculadora', tipo: 'formula', nome: 'F', categoriaId: null,
      descricao: '', referencia: '', favorito: false, campos: [],
      saidas: [{ id: 's1', nome: 'Saída Teste', expressao: '1', unidade: '', casasDecimais: 0, teto: null, piso: null, faixas: [] }],
    }
    expect(migrarCalculadoraV1(atual as unknown as CalculadoraFormulaV1)).toEqual(atual)
  })
})

function grupo(id: string, escopo: 'prescricao' | 'calculadora', parcial: Partial<CategoriaV1> = {}): CategoriaV1 {
  return { id, criadoEm: T, atualizadoEm: T, excluidoEm: null, nome: `Grupo Teste ${id}`, escopo, ordem: 3, icone: 'icone-teste', ...parcial }
}

function escala(id: string, categoriaId: string | null, parcial: Partial<CalculadoraPontosV1> = {}): CalculadoraPontosV1 {
  return {
    id, criadoEm: T, atualizadoEm: T, excluidoEm: null, tipo: 'pontos', nome: 'Escore Teste', categoriaId,
    descricao: '', referencia: '', favorito: false, faixas: [], campos: [], ...parcial,
  }
}

function formula(id: string, categoriaId: string | null): CalculadoraFormulaV1 {
  return {
    id, criadoEm: T, atualizadoEm: T, excluidoEm: null, tipo: 'formula', nome: 'Fórmula Teste', categoriaId,
    descricao: '', referencia: '', favorito: false, faixas: [], entradas: [], expressao: 'a', unidadeResultado: '',
    casasDecimais: 0, teto: null, piso: null,
  }
}

describe('migrarGruposV1', () => {
  it('grupo de calculadoras usado só por escalas vira escopo "escala"', () => {
    const { categorias, remapear } = migrarGruposV1([grupo('g1', 'calculadora')], [escala('e1', 'g1'), escala('e2', 'g1')])
    expect(categorias).toEqual([{ ...grupo('g1', 'calculadora'), escopo: 'escala' }])
    expect(remapear.size).toBe(0)
  })

  it('grupo usado pelas duas fica e ganha cópia "escala" (mesmo nome, ícone e ordem); escalas remapeadas', () => {
    const { categorias, remapear } = migrarGruposV1(
      [grupo('g1', 'calculadora')],
      [escala('e1', 'g1'), formula('f1', 'g1'), escala('e2', 'g1', { excluidoEm: T })],
    )
    expect(categorias).toEqual([grupo('g1', 'calculadora'), { ...grupo('g1', 'calculadora'), id: 'g1-escala', escopo: 'escala' }])
    expect([...remapear]).toEqual([
      ['e1', 'g1-escala'],
      ['e2', 'g1-escala'],
    ])
  })

  it('grupo sem uso, grupo de prescrições e grupo na lixeira ficam iguais', () => {
    const entrada = [
      grupo('vazio', 'calculadora'),
      grupo('presc', 'prescricao'),
      grupo('lixo', 'calculadora', { excluidoEm: T }),
    ]
    const { categorias, remapear } = migrarGruposV1(entrada, [escala('e1', 'presc'), escala('e2', 'lixo'), formula('f1', 'lixo')])
    expect(categorias).toEqual(entrada)
    expect(remapear.size).toBe(0)
  })

  it('ícone ausente (registro cru) vira null na cópia', () => {
    const cru = grupo('g1', 'calculadora')
    delete (cru as Partial<CategoriaV1>).icone
    const { categorias } = migrarGruposV1([cru], [escala('e1', 'g1'), formula('f1', 'g1')])
    expect(categorias[1]!.icone).toBeNull()
  })

  it('é determinística e não altera a entrada', () => {
    const cats = [grupo('g1', 'calculadora'), grupo('g2', 'calculadora')]
    const calcs = [escala('e1', 'g1'), formula('f1', 'g1'), escala('e2', 'g2')]
    const copia = JSON.parse(JSON.stringify({ cats, calcs }))
    const a = migrarGruposV1(cats, calcs)
    const b = migrarGruposV1(cats, calcs)
    expect(a.categorias).toEqual(b.categorias)
    expect([...a.remapear]).toEqual([...b.remapear])
    expect({ cats, calcs }).toEqual(copia)
  })
})

describe('migrarBibliotecaV1 — calculadoras e grupos', () => {
  it('converte as calculadoras, os grupos e remapeia as escalas; mesma entrada → mesma saída', () => {
    const b = {
      prescricoes: [],
      categorias: [grupo('g1', 'calculadora'), grupo('g2', 'calculadora')],
      calculadoras: [escala('e1', 'g1'), formula('f1', 'g1'), escala('e2', 'g2')],
    }
    const r = migrarBibliotecaV1(b)
    expect(r.categorias.map((c) => [c.id, c.escopo])).toEqual([
      ['g1', 'calculadora'],
      ['g2', 'escala'],
      ['g1-escala', 'escala'],
    ])
    expect(r.calculadoras.map((c) => [c.id, c.area, c.categoriaId])).toEqual([
      ['e1', 'escala', 'g1-escala'],
      ['f1', 'calculadora', 'g1'],
      ['e2', 'escala', 'g2'],
    ])
    expect(migrarBibliotecaV1(b)).toEqual(r)
  })
})
