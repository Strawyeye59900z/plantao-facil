import { describe, expect, it } from 'vitest'
import { montarMensagemProntuario, PROMPT_PRONTUARIO } from './promptProntuario'

describe('mensagem para a IA', () => {
  it('leva o prompt SOAP e a transcrição inteira no fim', () => {
    const msg = montarMensagemProntuario('  Paciente refere dor há 3 dias.  ')
    expect(msg.startsWith(PROMPT_PRONTUARIO)).toBe(true)
    expect(msg).toContain('SOAP')
    expect(msg.endsWith('<<<\nPaciente refere dor há 3 dias.\n>>>')).toBe(true)
  })

  it('pede os formatos que o app lê na resposta', () => {
    expect(PROMPT_PRONTUARIO).toContain('DÚVIDAS DA TRANSCRIÇÃO:')
    expect(PROMPT_PRONTUARIO).toContain('⟦')
    expect(PROMPT_PRONTUARIO).toContain('[incompreensível]')
  })
})
