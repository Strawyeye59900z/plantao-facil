// Valores arbitrários de teste — nenhum conteúdo clínico real.
import { describe, expect, it } from 'vitest'
import type { RegraDose, ResultadoDose } from '@/dominio/tipos'
import { calcularDose } from './calculo'

function regra(parcial: Partial<RegraDose> = {}): RegraDose {
  return {
    dosePorKg: 10,
    unidade: 'mg',
    baseDoseKg: 'por_tomada',
    tomadasPorDia: null,
    doseMaximaPorTomada: null,
    doseMaximaDiaria: null,
    pesoLimite: null,
    concentracao: null,
    arredondamentoDose: { modo: 'inteiro' },
    arredondamentoVolume: { modo: 'casas_decimais', casas: 1 },
    ...parcial,
  }
}

function ok(r: ResultadoDose) {
  if (!r.ok) throw new Error(`esperava sucesso: ${r.erro}`)
  return r
}

describe('cálculo simples', () => {
  it('dose/kg × peso por tomada', () => {
    const r = ok(calcularDose(regra(), 20))
    expect(r.dosePorTomada).toBe(200)
    expect(r.avisos).toEqual([])
    expect(r.memoria[0]).toBe('10 mg/kg × 20 kg = 200 mg')
  })

  it('peso com 1 casa decimal', () => {
    expect(ok(calcularDose(regra(), 3.4)).dosePorTomada).toBe(34)
  })

  it('por dia: divide pelas tomadas e calcula dose diária', () => {
    const r = ok(calcularDose(regra({ baseDoseKg: 'por_dia', dosePorKg: 30, tomadasPorDia: 3 }), 10))
    expect(r.dosePorTomada).toBe(100)
    expect(r.doseDiaria).toBe(300)
    expect(r.memoria).toContain('300 mg ÷ 3 tomadas = 100 mg por tomada')
  })

  it('por tomada com tomadas por dia informa dose diária', () => {
    expect(ok(calcularDose(regra({ tomadasPorDia: 4 }), 5)).doseDiaria).toBe(200)
  })
})

describe('teto por tomada', () => {
  it('aplica o teto e avisa', () => {
    const r = ok(calcularDose(regra({ doseMaximaPorTomada: 150 }), 20))
    expect(r.dosePorTomada).toBe(150)
    expect(r.avisos).toEqual(['teto_tomada'])
    expect(r.memoria).toContain('teto por tomada 150 mg: aplicado → 150 mg')
  })

  it('não aplica abaixo do teto', () => {
    const r = ok(calcularDose(regra({ doseMaximaPorTomada: 500 }), 20))
    expect(r.dosePorTomada).toBe(200)
    expect(r.avisos).toEqual([])
  })

  it('dose exatamente igual ao teto não gera aviso', () => {
    const r = ok(calcularDose(regra({ doseMaximaPorTomada: 200 }), 20))
    expect(r.dosePorTomada).toBe(200)
    expect(r.avisos).toEqual([])
  })
})

describe('teto diário', () => {
  it('limita a dose por tomada a máxima diária ÷ tomadas', () => {
    const r = ok(calcularDose(regra({ tomadasPorDia: 4, doseMaximaDiaria: 600 }), 20))
    expect(r.dosePorTomada).toBe(150)
    expect(r.doseDiaria).toBe(600)
    expect(r.avisos).toEqual(['teto_diario'])
  })

  it('teto diário que não divide exato é ajustado para baixo (nunca ultrapassa)', () => {
    const r = ok(calcularDose(regra({ tomadasPorDia: 3, doseMaximaDiaria: 500 }), 20))
    // 500 ÷ 3 = 166,67 → dose inteira para baixo
    expect(r.dosePorTomada).toBe(166)
    expect(r.doseDiaria).toBe(498)
    expect(r.doseDiaria!).toBeLessThanOrEqual(500)
  })

  it('aplica o menor entre teto por tomada e teto diário', () => {
    const r = ok(
      calcularDose(regra({ tomadasPorDia: 2, doseMaximaPorTomada: 180, doseMaximaDiaria: 300 }), 20),
    )
    expect(r.dosePorTomada).toBe(150)
    expect(r.avisos).toEqual(['teto_tomada', 'teto_diario'])
  })

  it('sem tomadas por dia é erro', () => {
    expect(calcularDose(regra({ doseMaximaDiaria: 600 }), 20).ok).toBe(false)
  })
})

describe('peso limite', () => {
  const comLimite = regra({ pesoLimite: { acimaDeKg: 40, doseFixa: 300 } })

  it('acima do limite usa dose fixa e avisa', () => {
    const r = ok(calcularDose(comLimite, 50))
    expect(r.dosePorTomada).toBe(300)
    expect(r.avisos).toEqual(['peso_limite'])
  })

  it('exatamente no limite ainda calcula por kg', () => {
    const r = ok(calcularDose(comLimite, 40))
    expect(r.dosePorTomada).toBe(400)
    expect(r.avisos).toEqual([])
  })

  it('dose fixa também respeita o teto', () => {
    const r = ok(calcularDose(regra({ pesoLimite: { acimaDeKg: 40, doseFixa: 300 }, doseMaximaPorTomada: 250 }), 50))
    expect(r.dosePorTomada).toBe(250)
    expect(r.avisos).toEqual(['peso_limite', 'teto_tomada'])
  })
})

describe('conversão para volume', () => {
  const conc = { quantidade: 100, volumeMl: 5 }

  it('converte dose em mL e arredonda o volume', () => {
    const r = ok(calcularDose(regra({ concentracao: conc }), 15))
    // 150 mg × 5/100 = 7,5 mL
    expect(r.volumeMl).toBe(7.5)
  })

  it('volume arredondado para cima que ultrapassaria o teto é arredondado para baixo', () => {
    const r = ok(
      calcularDose(
        regra({
          dosePorKg: 1,
          doseMaximaPorTomada: 33,
          concentracao: { quantidade: 10, volumeMl: 1 },
          arredondamentoVolume: { modo: 'multiplo', passo: 0.5, direcao: 'cima' },
        }),
        40,
      ),
    )
    // dose 33 mg (teto) → 3,3 mL → para cima 3,5 mL = 35 mg > 33 → para baixo 3 mL
    expect(r.dosePorTomada).toBe(33)
    expect(r.volumeMl).toBe(3)
    expect(r.avisos).toContain('volume_reduzido')
  })

  it('sem teto, o volume segue o arredondamento cadastrado', () => {
    const r = ok(
      calcularDose(
        regra({
          dosePorKg: 1,
          concentracao: { quantidade: 10, volumeMl: 1 },
          arredondamentoVolume: { modo: 'multiplo', passo: 0.5, direcao: 'cima' },
        }),
        33,
      ),
    )
    expect(r.volumeMl).toBe(3.5)
    expect(r.avisos).toEqual([])
  })
})

describe('arredondamento', () => {
  it('dose sempre inteira (mais próximo)', () => {
    expect(ok(calcularDose(regra({ dosePorKg: 1.5 }), 3.3)).dosePorTomada).toBe(5) // 4,95
    expect(ok(calcularDose(regra({ dosePorKg: 1.5 }), 3.7)).dosePorTomada).toBe(6) // 5,55
  })

  it('múltiplo para baixo, mais próximo e para cima', () => {
    const passo = (direcao: 'baixo' | 'proximo' | 'cima') =>
      ok(calcularDose(regra({ arredondamentoDose: { modo: 'multiplo', passo: 50, direcao } }), 13)).dosePorTomada
    // 130 mg
    expect(passo('baixo')).toBe(100)
    expect(passo('proximo')).toBe(150)
    expect(passo('cima')).toBe(150)
  })

  it('arredondar para cima nunca passa do teto', () => {
    const r = ok(
      calcularDose(
        regra({ doseMaximaPorTomada: 140, arredondamentoDose: { modo: 'multiplo', passo: 50, direcao: 'cima' } }),
        13,
      ),
    )
    // 130 → 150 (cima) → teto 140 → ajuste ao múltiplo para baixo: 100
    expect(r.dosePorTomada).toBe(100)
    expect(r.dosePorTomada).toBeLessThanOrEqual(140)
  })

  it('evita ruído de ponto flutuante', () => {
    // 0,1 × 30 = 3,0000000000000004
    expect(ok(calcularDose(regra({ dosePorKg: 0.1, arredondamentoDose: { modo: 'multiplo', passo: 3, direcao: 'cima' } }), 30)).dosePorTomada).toBe(3)
  })

  it('volume com casas decimais', () => {
    const r = ok(
      calcularDose(
        regra({ concentracao: { quantidade: 3, volumeMl: 1 }, arredondamentoVolume: { modo: 'casas_decimais', casas: 2 } }),
        1,
      ),
    )
    // 10 mg ÷ 3 = 3,333… mL
    expect(r.volumeMl).toBe(3.33)
  })
})

describe('dose zero', () => {
  it('é erro (bloqueia copiar)', () => {
    const r = calcularDose(regra({ dosePorKg: 0.01 }), 10)
    expect(r.ok).toBe(false)
  })
})
