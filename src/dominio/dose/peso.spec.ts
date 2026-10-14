import { describe, expect, it } from 'vitest'
import { lerPeso } from './peso'

describe('lerPeso', () => {
  it.each([
    ['20', 20],
    ['3,4', 3.4],
    ['3.4', 3.4],
    [' 70 ', 70],
    ['250', 250],
  ])('aceita %s', (texto, kg) => {
    expect(lerPeso(texto)).toEqual({ ok: true, kg })
  })

  it.each([
    ['', 'Informe o peso.'],
    ['0', 'O peso deve ser maior que zero.'],
    ['0,0', 'O peso deve ser maior que zero.'],
    ['-5', 'O peso deve ser maior que zero.'],
    ['3,45', 'Use no máximo 1 casa decimal.'],
    ['abc', 'Peso inválido.'],
    ['3,4,5', 'Peso inválido.'],
    ['1e3', 'Peso inválido.'],
  ])('rejeita "%s"', (texto, erro) => {
    expect(lerPeso(texto)).toEqual({ ok: false, erro })
  })
})
