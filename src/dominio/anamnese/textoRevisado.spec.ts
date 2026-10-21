import { describe, expect, it } from 'vitest'
import { numerosNaoEncontrados, segmentar, textoLimpo } from './textoRevisado'

const TEXTO = 'HDA: Paciente refere dor ⟦há 3 dias⟧, em uso de ⟦losartana 50 mg⟧ VO.'

describe('segmentar', () => {
  it('separa trechos normais e destacados na ordem', () => {
    expect(segmentar(TEXTO)).toEqual([
      { tipo: 'texto', texto: 'HDA: Paciente refere dor ' },
      { tipo: 'destaque', texto: 'há 3 dias' },
      { tipo: 'texto', texto: ', em uso de ' },
      { tipo: 'destaque', texto: 'losartana 50 mg' },
      { tipo: 'texto', texto: ' VO.' },
    ])
  })

  it('texto sem marcadores vira um único segmento normal', () => {
    expect(segmentar('Nega febre.')).toEqual([{ tipo: 'texto', texto: 'Nega febre.' }])
  })
})

describe('textoLimpo', () => {
  it('tira os marcadores e mantém o conteúdo', () => {
    expect(textoLimpo(TEXTO)).toBe('HDA: Paciente refere dor há 3 dias, em uso de losartana 50 mg VO.')
  })
})

describe('numerosNaoEncontrados', () => {
  it('não aponta números que estão na transcrição', () => {
    expect(numerosNaoEncontrados('losartana 50 mg há 3 dias', 'losartana ⟦50 mg⟧ ⟦3 dias⟧')).toEqual([])
  })
  it('aponta número que só existe no texto revisado', () => {
    expect(numerosNaoEncontrados('losartana 50 mg', 'losartana 500 mg')).toEqual(['500'])
  })
  it('trata vírgula e ponto como o mesmo número', () => {
    expect(numerosNaoEncontrados('2,5 mL', '2.5 mL')).toEqual([])
  })
})
