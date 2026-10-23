import { describe, expect, it } from 'vitest'
import { faseGravacao } from './limiteGravacao'

describe('faseGravacao', () => {
  it('não alerta até 4:29', () => {
    expect(faseGravacao(0)).toEqual({ alerta: false, restante: 300 })
    expect(faseGravacao(269)).toEqual({ alerta: false, restante: 31 })
  })

  it('alerta nos últimos 30 segundos (4:30 a 4:59)', () => {
    expect(faseGravacao(270)).toEqual({ alerta: true, restante: 30 })
    expect(faseGravacao(299)).toEqual({ alerta: true, restante: 1 })
  })

  it('o ciclo recomeça aos 5 minutos', () => {
    expect(faseGravacao(300)).toEqual({ alerta: false, restante: 300 })
    expect(faseGravacao(570)).toEqual({ alerta: true, restante: 30 })
  })

  it('ignora valores negativos', () => {
    expect(faseGravacao(-5).alerta).toBe(false)
  })
})
