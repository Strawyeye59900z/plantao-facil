import { describe, expect, it } from 'vitest'
import { montarMensagemGemini } from './mensagemGemini'

describe('mensagem para o Gemini', () => {
  it('começa com @nova-consulta, pede SOAP e leva a transcrição inteira', () => {
    const msg = montarMensagemGemini('Paciente refere dor há 3 dias.')
    expect(msg.startsWith('@nova-consulta\n')).toBe(true)
    expect(msg).toContain('SOAP')
    expect(msg.endsWith('Paciente refere dor há 3 dias.')).toBe(true)
  })
})
