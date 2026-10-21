import { describe, expect, it } from 'vitest'
import { separarProntuario } from './separarProntuario'

describe('separarProntuario', () => {
  it('separa o SOAP das dúvidas, que ficam fora do prontuário', () => {
    const texto = 'S – SUBJETIVO\nQP: Manchas na face.\n\nP – PLANO:\n * Retorno.\n\nDÚVIDAS DA TRANSCRIÇÃO:\nmotinha (?)\n\nO texto original continha identificadores.'
    const r = separarProntuario(texto)
    expect(r.prontuario).toBe('S – SUBJETIVO\nQP: Manchas na face.\n\nP – PLANO:\n * Retorno.')
    expect(r.fora).toBe('DÚVIDAS DA TRANSCRIÇÃO:\nmotinha (?)\n\nO texto original continha identificadores.')
  })

  it('texto sem seção de dúvidas fica inteiro no prontuário', () => {
    expect(separarProntuario('QP: Dor.')).toEqual({ prontuario: 'QP: Dor.', fora: '' })
  })

  it('não confunde o título com uma frase que cita as dúvidas', () => {
    const r = separarProntuario('HMA: Paciente pergunta sobre DÚVIDAS DA TRANSCRIÇÃO hoje.')
    expect(r.fora).toBe('')
  })
})
