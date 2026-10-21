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

import { destacar } from './textoRevisado'

describe('destacar', () => {
  const marcados = (t: string) => destacar(t).filter((x) => x.tipo !== 'texto').map((x) => [x.tipo, x.texto])

  it('marca incompreensível e (?)', () => {
    expect(marcados('Toma lozartana (?) e [incompreensível].')).toEqual([
      ['incompreensivel', '(?)'],
      ['incompreensivel', '[incompreensível]'],
    ])
  })

  it('marca doses', () => {
    expect(marcados('Losartana 50 mg, dipirona 500mg, insulina 10 UI, 2,5 ml/h')).toEqual([
      ['importante', '50 mg'],
      ['importante', '500mg'],
      ['importante', '10 UI'],
      ['importante', '2,5 ml/h'],
    ])
  })

  it('marca durações e início dos sintomas', () => {
    expect(marcados('Dor há 3 dias, febre desde ontem à noite, tosse por duas semanas.')).toEqual([
      ['importante', 'há 3 dias'],
      ['importante', 'desde ontem à noite'],
      ['importante', 'por duas semanas'],
    ])
  })

  it('marca datas', () => {
    expect(marcados('DUM 12/03/2026, retorno 05/11')).toEqual([
      ['importante', '12/03/2026'],
      ['importante', '05/11'],
    ])
  })

  it('não perde texto: junta tudo de volta igual', () => {
    const t = 'HDA: dor há 3 dias (?), usa 50 mg.\nNega febre.'
    expect(destacar(t).map((x) => x.texto).join('')).toBe(t)
  })
})
