// Calculadoras fictícias de teste — nenhum escore ou fórmula clínica real.
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import type { CalculadoraDosePeso, CalculadoraFormula, CalculadoraPontos } from '@/dominio/tipos'
import {
  avisosCalculadora,
  calculadoraVazia,
  duplicarCalculadora,
  marcadoresCalculaveis,
  regraDosePesoVazia,
  sincronizarRegras,
  validarCalculadora,
} from './editar'
import { analisarExpressao, calcularSaidas, type ValoresFormula } from './formula'
import { analisarFaixas, interpretar } from './interpretacao'
import { calcularPontos, intervaloPossivel } from './pontos'

const T = '2026-01-01T00:00:00.000Z'
const ent = { id: 'calc', criadoEm: T, atualizadoEm: T, excluidoEm: null, categoriaId: 'cat', descricao: '', referencia: '', favorito: false }

const escore: CalculadoraPontos = {
  ...ent,
  area: 'escala',
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
  area: 'calculadora',
  tipo: 'formula',
  nome: 'Fórmula Teste',
  campos: [
    { id: 'ea', tipo: 'numero', variavel: 'a', rotulo: 'Entrada A', unidade: 'u', min: 0, max: 100 },
    { id: 'eb', tipo: 'numero', variavel: 'b', rotulo: 'Entrada B', unidade: 'u', min: 1, max: 10 },
  ],
  saidas: [{ id: 's1', nome: 'Resultado', expressao: 'a / b + sqrt(4)', unidade: 'u', casasDecimais: 1, teto: null, piso: null, faixas: [] }],
}

const dosePeso: CalculadoraDosePeso = {
  ...ent,
  area: 'calculadora',
  tipo: 'dose_peso',
  nome: 'Dose Teste',
  linhas: [
    {
      id: 'l1',
      texto: 'Medicamento Teste A {inducao}',
      regras: [{ id: 'r1', marcador: 'inducao', dosePorKg: 2, unidade: 'mg', concentracao: null, doseMaxima: null, casasDecimais: 1 }],
    },
  ],
}

const comSaida = (alt: Partial<CalculadoraFormula['saidas'][number]>): CalculadoraFormula => ({
  ...formula,
  saidas: [{ ...formula.saidas[0]!, ...alt }],
})

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
  const um = (c: CalculadoraFormula, v: ValoresFormula) => calcularSaidas(c, v)[0]!

  it('calcula e arredonda pelas casas decimais', () => {
    expect(um(formula, { ea: 10, eb: 3 })).toMatchObject({ ok: true, valor: 5.3 })
  })

  it('campo vazio pede para preencher', () => {
    expect(um(formula, { ea: 10, eb: null })).toEqual({ saidaId: 's1', ok: false, erro: 'Preencha todos os campos.' })
  })

  it('entrada fora do mínimo/máximo é erro', () => {
    expect(um(formula, { ea: 10, eb: 0 })).toMatchObject({ ok: false })
  })

  it('aplica teto e piso por último, com aviso', () => {
    expect(um(comSaida({ teto: 5 }), { ea: 100, eb: 1 })).toMatchObject({ ok: true, valor: 5, avisos: ['Limitado ao teto.'] })
    expect(um(comSaida({ piso: 4 }), { ea: 0, eb: 1 })).toMatchObject({ ok: true, valor: 4, avisos: ['Elevado ao piso.'] })
  })

  it('resultado não finito é erro', () => {
    expect(um(comSaida({ expressao: 'sqrt(a - 50)' }), { ea: 10, eb: 1 })).toMatchObject({ ok: false })
  })

  it('exemplo de infusão: vazao * conc / peso', () => {
    const f: CalculadoraFormula = {
      ...formula,
      campos: [
        { id: 'c1', tipo: 'numero', variavel: 'vazao', rotulo: 'Vazão', unidade: 'mL/h', min: null, max: null },
        { id: 'c2', tipo: 'numero', variavel: 'conc', rotulo: 'Concentração', unidade: 'u/mL', min: null, max: null },
        { id: 'c3', tipo: 'numero', variavel: 'peso', rotulo: 'Peso', unidade: 'kg', min: null, max: null },
      ],
      saidas: [{ id: 's1', nome: 'Taxa', expressao: 'vazao * conc / peso', unidade: 'un/kg/h', casasDecimais: 2, teto: null, piso: null, faixas: [] }],
    }
    expect(um(f, { c1: 10, c2: 64, c3: 80 })).toMatchObject({ ok: true, valor: 8, texto: '8 un/kg/h' })
  })

  it('campo sim/não usa valorSim/valorNao; vazio é erro', () => {
    const f: CalculadoraFormula = {
      ...formula,
      campos: [{ id: 'sn', tipo: 'sim_nao', variavel: 'x', rotulo: 'Fator', valorSim: 2, valorNao: 0 }],
      saidas: [{ id: 's1', nome: 'R', expressao: 'x + 1', unidade: '', casasDecimais: 0, teto: null, piso: null, faixas: [] }],
    }
    expect(um(f, { sn: true })).toMatchObject({ ok: true, valor: 3 })
    expect(um(f, { sn: false })).toMatchObject({ ok: true, valor: 1 })
    expect(um(f, { sn: null })).toEqual({ saidaId: 's1', ok: false, erro: 'Preencha todos os campos.' })
  })

  it('várias saídas são independentes e trazem a faixa', () => {
    const f: CalculadoraFormula = {
      ...formula,
      saidas: [
        {
          id: 's1', nome: 'Soma', expressao: 'a + b', unidade: 'u', casasDecimais: 0, teto: null, piso: null,
          faixas: [
            { id: 'f1', de: 0, ate: 5, texto: 'Baixa', gravidade: 'informativo' },
            { id: 'f2', de: 6, ate: null, texto: 'Alta', gravidade: 'critico' },
          ],
        },
        { id: 's2', nome: 'Quebra', expressao: 'sqrt(a - 50)', unidade: 'u', casasDecimais: 0, teto: null, piso: null, faixas: [] },
      ],
    }
    const [r1, r2] = calcularSaidas(f, { ea: 10, eb: 1 })
    expect(r1).toMatchObject({ saidaId: 's1', ok: true, valor: 11, texto: '11 u' })
    expect(r1!.ok && r1!.faixa?.id).toBe('f2')
    expect(r2).toMatchObject({ saidaId: 's2', ok: false })
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
    expect(validarCalculadora(dosePeso, existe)).toEqual([])
  })

  it('nova calculadora vazia aponta o que falta', () => {
    expect(validarCalculadora(calculadoraVazia('escala', 'pontos'), existe)).toEqual([
      'Informe o nome.',
      'Escolha o grupo.',
      'Campo 1: informe o texto.',
      'Campo 1: informe os pontos de "sim" e "não".',
    ])
    const erros = validarCalculadora(calculadoraVazia('calculadora', 'formula'), existe)
    expect(erros).toContain('Saída 1: Escreva a expressão.')
    expect(erros).toContain('Saída 1: informe o nome.')
    expect(validarCalculadora(calculadoraVazia('calculadora', 'dose_peso'), existe)).toContain('Linha 1: informe o texto.')
  })

  it('dose por peso: marcador sem regra', () => {
    const d = { ...dosePeso, linhas: [{ ...dosePeso.linhas[0]!, regras: [] }] }
    expect(validarCalculadora(d, existe)).toEqual(['A linha 1 usa {inducao}, que não tem regra.'])
  })

  it('dose por peso: regra sem uso', () => {
    const l = dosePeso.linhas[0]!
    const d = { ...dosePeso, linhas: [{ ...l, regras: [...l.regras, { ...l.regras[0]!, id: 'r2', marcador: 'manutencao' }] }] }
    expect(validarCalculadora(d, existe)).toEqual(['A regra {manutencao} não é usada em nenhuma linha.'])
  })

  it('dose por peso só existe em calculadora e pontos só em escala', () => {
    expect(validarCalculadora({ ...dosePeso, area: 'escala' } as never, existe)).toContain('Dose por peso só existe em calculadoras.')
    expect(validarCalculadora({ ...escore, area: 'calculadora' } as never, existe)).toContain('Pontos só existe em escalas.')
  })

  it('fórmula: variável repetida ou inválida', () => {
    const d = { ...formula, campos: [...formula.campos, { ...formula.campos[0]!, id: 'x', variavel: 'peso' }, { ...formula.campos[0]!, id: 'y', variavel: 'peso' }, { ...formula.campos[0]!, id: 'z', variavel: 'peso_ação' }] }
    const erros = validarCalculadora(d, existe)
    expect(erros).toContain('Variável repetida: peso.')
    expect(erros.some((e) => e.includes('sem acento'))).toBe(true)
  })

  it('avisos: lacuna na interpretação e variável não usada', () => {
    expect(avisosCalculadora({ ...escore, faixas: [{ ...escore.faixas[0]!, ate: 1 }, escore.faixas[1]!] })[0]).toMatch(/Lacuna/)
    expect(avisosCalculadora(comSaida({ expressao: 'a * 2' }))).toEqual(['A variável "b" não é usada em nenhuma saída.'])
  })

  it('duplicar gera IDs novos, "(cópia)" e aceita objeto reativo', () => {
    let n = 0
    const copia = duplicarCalculadora(reactive(structuredClone(escore)) as CalculadoraPontos, () => `novo-${++n}`)
    expect(copia.nome).toBe('Escore Teste (cópia)')
    expect(copia.tipo === 'pontos' && copia.campos.map((c) => c.id)).toEqual(['novo-3', 'novo-4', 'novo-5', 'novo-8'])
    expect(copia).not.toHaveProperty('id')
  })

  it('duplicar dose por peso: IDs novos em linhas e regras, marcadores iguais', () => {
    let n = 0
    const copia = duplicarCalculadora(dosePeso, () => `novo-${++n}`)
    if (copia.tipo !== 'dose_peso') throw new Error('tipo')
    expect(copia.nome).toBe('Dose Teste (cópia)')
    const l = copia.linhas[0]!
    expect(l.id).not.toBe('l1')
    expect(l.regras[0]!.id).not.toBe('r1')
    expect(l.id).not.toBe(l.regras[0]!.id)
    expect(l.texto).toBe('Medicamento Teste A {inducao}')
    expect({ ...l.regras[0]!, id: 'r1' }).toEqual(dosePeso.linhas[0]!.regras[0])
  })

  it('duplicar fórmula: IDs novos em campos, saídas e faixas', () => {
    let n = 0
    const original = comSaida({ faixas: [{ id: 'fx', de: 0, ate: 1, texto: 'Faixa Teste', gravidade: 'informativo' }] })
    const copia = duplicarCalculadora(original, () => `novo-${++n}`)
    if (copia.tipo !== 'formula') throw new Error('tipo')
    const ids = [...copia.campos.map((c) => c.id), copia.saidas[0]!.id, copia.saidas[0]!.faixas[0]!.id]
    expect(new Set(ids).size).toBe(4)
    expect(ids.every((i) => i.startsWith('novo-'))).toBe(true)
    expect(copia.campos.map((c) => c.variavel)).toEqual(['a', 'b'])
    expect(copia.saidas[0]!.expressao).toBe(original.saidas[0]!.expressao)
    expect({ ...copia.saidas[0]!.faixas[0]!, id: 'fx' }).toEqual(original.saidas[0]!.faixas[0])
  })
})

describe('regras de dose por peso acompanham os marcadores do texto', () => {
  let n = 0
  const gerar = () => `r${++n}`
  const preenchida = (marcador: string, id = `p-${marcador}`) => ({
    ...regraDosePesoVazia(marcador, () => id),
    dosePorKg: 1,
    unidade: 'mg',
  })

  it('só conta marcadores que o motor substitui, sem repetir', () => {
    expect(marcadoresCalculaveis('A {a} e {b_2} e {a} e {com espaço} e {}')).toEqual(['a', 'b_2'])
  })

  it('marcador novo ganha regra vazia', () => {
    const regras = sincronizarRegras('Medicamento Teste A {inducao}', 'Medicamento Teste A {inducao', [], gerar)
    expect(regras.map((r) => r.marcador)).toEqual(['inducao'])
    expect(Number.isNaN(regras[0]!.dosePorKg)).toBe(true)
  })

  it('renomear o marcador leva a regra preenchida junto', () => {
    const r = preenchida('inducao')
    const regras = sincronizarRegras('X {induca}', 'X {inducao}', [r], gerar)
    expect(regras).toEqual([{ ...r, marcador: 'induca' }])
  })

  it('marcador apagado: regra preenchida fica; regra intocada sai', () => {
    const cheia = preenchida('inducao')
    const vazia = regraDosePesoVazia('manutencao', () => 'v')
    const regras = sincronizarRegras('X', 'X {inducao} {manutencao}', [cheia, vazia], gerar)
    expect(regras).toEqual([cheia])
  })

  it('apagar e depois digitar outro marcador não reaproveita a regra órfã', () => {
    const cheia = preenchida('inducao')
    const depoisDeApagar = sincronizarRegras('X {', 'X {inducao}', [cheia], gerar)
    expect(depoisDeApagar).toEqual([cheia])
    const regras = sincronizarRegras('X {outra}', 'X {outra', depoisDeApagar, gerar)
    expect(regras.map((r) => r.marcador)).toEqual(['inducao', 'outra'])
    expect(regras[0]).toBe(cheia)
  })

  it('não renomeia por cima de uma regra que já existe', () => {
    const a = preenchida('a')
    const b = preenchida('b')
    const regras = sincronizarRegras('X {b}', 'X {a}', [a, b], gerar)
    expect(regras).toEqual([a, b])
  })

  it('texto sem mudança de marcadores mantém as regras', () => {
    const a = preenchida('a')
    expect(sincronizarRegras('Y {a} mais texto', 'Y {a}', [a], gerar)).toEqual([a])
  })
})
