// Calculadoras fictícias de teste — nenhum escore ou fórmula clínica real.
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import type { CalculadoraFormula, CalculadoraPontos } from '@/dominio/tipos'
import { avisosCalculadora, calculadoraVazia, duplicarCalculadora, validarCalculadora } from './editar'
import { analisarExpressao, calcularFormula } from './formula'
import { analisarFaixas, interpretar } from './interpretacao'
import { calcularPontos, intervaloPossivel } from './pontos'

const T = '2026-01-01T00:00:00.000Z'
const ent = { id: 'calc', criadoEm: T, atualizadoEm: T, excluidoEm: null, categoriaId: 'cat', descricao: '', referencia: '', favorito: false }

const escore: CalculadoraPontos = {
  ...ent,
  tipo: 'pontos',
  nome: 'Escore Teste',
  campos: [
    { id: 'sn1', tipo: 'sim_nao', rotulo: 'Critério Teste 1', pontosSim: 1, pontosNao: 0 },
    { id: 'sn2', tipo: 'sim_nao', rotulo: 'Critério Teste 2', pontosSim: 2, pontosNao: 0 },
    {
      id: 'sel',
      tipo: 'selecao',
      rotulo: 'Seleção Teste',
      opcoes: [
        { id: 'o1', rotulo: 'Opção A', pontos: 0 },
        { id: 'o2', rotulo: 'Opção B', pontos: 3 },
      ],
    },
    {
      id: 'num',
      tipo: 'numero',
      rotulo: 'Número Teste',
      unidade: 'un',
      min: 0,
      max: 200,
      faixas: [
        { id: 'f1', de: null, ate: 49, pontos: 0 },
        { id: 'f2', de: 50, ate: 99, pontos: 1 },
      ],
    },
  ],
  faixas: [
    { id: 'i1', de: 0, ate: 2, texto: 'Faixa Teste Baixa', gravidade: 'informativo' },
    { id: 'i2', de: 3, ate: null, texto: 'Faixa Teste Alta', gravidade: 'critico' },
  ],
}

const formula: CalculadoraFormula = {
  ...ent,
  tipo: 'formula',
  nome: 'Fórmula Teste',
  entradas: [
    { id: 'ea', variavel: 'a', rotulo: 'Entrada A', unidade: 'u', min: 0, max: 100 },
    { id: 'eb', variavel: 'b', rotulo: 'Entrada B', unidade: 'u', min: 1, max: 10 },
  ],
  expressao: 'a / b + sqrt(4)',
  unidadeResultado: 'u',
  casasDecimais: 1,
  teto: null,
  piso: null,
  faixas: [],
}

describe('motor de pontos', () => {
  it('soma sim/não, seleção e número', () => {
    const r = calcularPontos(escore, { sn1: true, sn2: false, sel: 'o2', num: 60 })
    expect(r.total).toBe(5)
    expect(r.completo).toBe(true)
    expect(r.pontosPorCampo).toEqual({ sn1: 1, sn2: 0, sel: 3, num: 1 })
  })

  it('resultado parcial com campos sem resposta', () => {
    const r = calcularPontos(escore, { sn2: true })
    expect(r).toMatchObject({ total: 2, respondidos: 1, totalCampos: 4, completo: false })
  })

  it('número fora das faixas é erro e não soma', () => {
    const r = calcularPontos(escore, { num: 150 })
    expect(r.erros.num).toBe('Valor fora das faixas cadastradas.')
    expect(r.total).toBe(0)
    expect(r.completo).toBe(false)
  })

  it('número fora do mínimo/máximo é erro', () => {
    expect(calcularPontos(escore, { num: 500 }).erros.num).toMatch(/entre 0 e 200/)
  })

  it('limites da faixa são inclusivos', () => {
    expect(calcularPontos(escore, { num: 49 }).pontosPorCampo.num).toBe(0)
    expect(calcularPontos(escore, { num: 50 }).pontosPorCampo.num).toBe(1)
  })

  it('intervalo possível de totais', () => {
    expect(intervaloPossivel(escore)).toEqual({ min: 0, max: 7 })
  })
})

describe('avaliador de fórmulas', () => {
  it('calcula e arredonda pelas casas decimais', () => {
    const r = calcularFormula(formula, { ea: 10, eb: 3 })
    expect(r).toMatchObject({ estado: 'ok', valor: 5.3 })
  })

  it('incompleto lista as entradas faltando', () => {
    expect(calcularFormula(formula, { ea: 10, eb: null })).toEqual({ estado: 'incompleto', faltam: ['Entrada B'] })
  })

  it('entrada fora do mínimo/máximo é erro', () => {
    expect(calcularFormula(formula, { ea: 10, eb: 0 })).toMatchObject({ estado: 'erro' })
  })

  it('aplica teto e piso por último, com aviso', () => {
    expect(calcularFormula({ ...formula, teto: 5 }, { ea: 100, eb: 1 })).toMatchObject({ valor: 5, aviso: 'teto' })
    expect(calcularFormula({ ...formula, piso: 4 }, { ea: 0, eb: 1 })).toMatchObject({ valor: 4, aviso: 'piso' })
  })

  it('resultado não finito é erro', () => {
    const f = { ...formula, expressao: 'sqrt(a - 50)' }
    expect(calcularFormula(f, { ea: 10, eb: 1 })).toMatchObject({ estado: 'erro' })
  })

  it.each([
    ['a + b * 2 ^ 2 - (a / b)', true],
    ['round(a, 1) + floor(b) + ceil(a) + abs(-a)', true],
    ['log(a) + log10(b) + exp(1) + min(a, b) + max(a, b)', true],
    ['a +', false],
    ['c + 1', false],
    ['evaluate("1+1")', false],
    ['import({})', false],
    ['a = 5', false],
    ['[1, 2]', false],
    ['a > b ? 1 : 0', false],
    ['"texto"', false],
    ['f(x) = x', false],
    ['a.constructor', false],
    ['pi * a', false],
  ])('expressão %s → válida: %s', (expr, valida) => {
    expect(analisarExpressao(expr, ['a', 'b']).ok).toBe(valida)
  })
})

describe('interpretação e faixas', () => {
  it('interpreta pela faixa (inclusiva, sem limite = aberto)', () => {
    expect(interpretar(2, escore.faixas)?.texto).toBe('Faixa Teste Baixa')
    expect(interpretar(3, escore.faixas)?.texto).toBe('Faixa Teste Alta')
    expect(interpretar(-1, escore.faixas)).toBeUndefined()
  })

  it('inteiros: 0–4 e 5–10 é contínuo; 0–4 e 6–10 tem lacuna', () => {
    expect(analisarFaixas([{ de: 0, ate: 4 }, { de: 5, ate: 10 }], 0).avisos).toEqual([])
    expect(analisarFaixas([{ de: 0, ate: 4 }, { de: 6, ate: 10 }], 0).avisos[0]).toMatch(/Lacuna entre 4 e 6/)
  })

  it('com 1 casa decimal, 0–4 e 5–10 tem lacuna; 0–4,9 e 5–10 não', () => {
    expect(analisarFaixas([{ de: 0, ate: 4 }, { de: 5, ate: 10 }], 1).avisos).toHaveLength(1)
    expect(analisarFaixas([{ de: 0, ate: 4.9 }, { de: 5, ate: 10 }], 1).avisos).toEqual([])
  })

  it('detecta sobreposição', () => {
    expect(analisarFaixas([{ de: 0, ate: 5 }, { de: 5, ate: 10 }], 0).avisos[0]).toMatch(/sobrepostas/)
  })

  it('detecta totais possíveis sem faixa no começo e no fim', () => {
    const avisos = analisarFaixas([{ de: 1, ate: 3 }], 0, { min: 0, max: 7 }).avisos
    expect(avisos).toHaveLength(2)
  })

  it('"de" maior que "até" é erro', () => {
    expect(analisarFaixas([{ de: 5, ate: 1 }], 0).erros).toHaveLength(1)
  })
})

describe('editor de calculadoras', () => {
  const existe = (id: string) => id === 'cat'

  it('calculadoras completas são válidas', () => {
    expect(validarCalculadora(escore, existe)).toEqual([])
    expect(validarCalculadora(formula, existe)).toEqual([])
  })

  it('nova calculadora vazia aponta o que falta', () => {
    expect(validarCalculadora(calculadoraVazia('pontos'), existe)).toEqual([
      'Informe o nome.',
      'Escolha o grupo.',
      'Campo 1: informe o texto.',
      'Campo 1: informe os pontos de "sim" e "não".',
    ])
    const erros = validarCalculadora(calculadoraVazia('formula'), existe)
    expect(erros).toContain('Entrada 1: informe mínimo e máximo.')
    expect(erros).toContain('Escreva a expressão.')
  })

  it('variável inválida ou repetida', () => {
    const d = { ...formula, entradas: [...formula.entradas, { ...formula.entradas[0]!, id: 'x' }, { ...formula.entradas[0]!, id: 'y', variavel: 'peso_ação' }] }
    const erros = validarCalculadora(d, existe)
    expect(erros.some((e) => e.includes('repetida'))).toBe(true)
    expect(erros.some((e) => e.includes('sem acento'))).toBe(true)
  })

  it('avisos: lacuna na interpretação e variável não usada', () => {
    expect(avisosCalculadora({ ...escore, faixas: [{ ...escore.faixas[0]!, ate: 1 }, escore.faixas[1]!] })[0]).toMatch(/Lacuna/)
    expect(avisosCalculadora({ ...formula, expressao: 'a * 2' })).toEqual(['A variável "b" não é usada na expressão.'])
  })

  it('duplicar gera IDs novos, "(cópia)" e aceita objeto reativo', () => {
    let n = 0
    const copia = duplicarCalculadora(reactive(structuredClone(escore)) as CalculadoraPontos, () => `novo-${++n}`)
    expect(copia.nome).toBe('Escore Teste (cópia)')
    expect(copia.tipo === 'pontos' && copia.campos.map((c) => c.id)).toEqual(['novo-3', 'novo-4', 'novo-5', 'novo-8'])
    expect(copia).not.toHaveProperty('id')
  })
})
