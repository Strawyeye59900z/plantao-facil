import { describe, expect, it } from 'vitest'
import { extrairJson, montarPromptRevisao, numerosDoTexto, validarRevisao } from './revisao'

const ORIGINAL = 'Paciente toma losartana 50 mg de 12/12h há 3 dias com dor torácica.'

describe('montarPromptRevisao', () => {
  it('inclui as regras e a transcrição', () => {
    const prompt = montarPromptRevisao(ORIGINAL)
    expect(prompt).toContain('NUNCA altere números')
    expect(prompt).toContain(ORIGINAL)
  })
})

describe('extrairJson', () => {
  it('lê JSON puro', () => {
    expect(extrairJson('{"a":1}')).toEqual({ a: 1 })
  })
  it('lê JSON dentro de cerca de código e com texto ao redor', () => {
    expect(extrairJson('Aqui está:\n```json\n{"a":2}\n```\nObrigado')).toEqual({ a: 2 })
  })
  it('devolve null quando não há JSON', () => {
    expect(extrairJson('sem nada')).toBeNull()
    expect(extrairJson('{quebrado')).toBeNull()
  })
})

describe('numerosDoTexto', () => {
  it('extrai inteiros e decimais', () => {
    expect(numerosDoTexto('5 mg, 2,5 mL, 12/12h')).toEqual(['5', '2.5', '12', '12'])
  })
})

describe('validarRevisao', () => {
  it('aceita revisão com os mesmos números', () => {
    const r = validarRevisao(ORIGINAL, {
      segmentos: [
        { tipo: 'texto', texto: 'Paciente toma ' },
        { tipo: 'destaque', texto: 'losartana 50 mg de 12/12h' },
        { tipo: 'texto', texto: ' há ' },
        { tipo: 'destaque', texto: '3 dias' },
        { tipo: 'texto', texto: ' com dor torácica.' },
      ],
      mudancas: [],
    })
    expect(r.ok).toBe(true)
  })

  it('recusa revisão que altera um número', () => {
    const r = validarRevisao(ORIGINAL, {
      segmentos: [{ tipo: 'texto', texto: 'Paciente toma losartana 500 mg de 12/12h há 3 dias com dor torácica.' }],
    })
    expect(r.ok).toBe(false)
  })

  it('recusa segmento com tipo desconhecido', () => {
    expect(validarRevisao(ORIGINAL, { segmentos: [{ tipo: 'html', texto: 'x' }] }).ok).toBe(false)
  })

  it('recusa resposta sem segmentos', () => {
    expect(validarRevisao(ORIGINAL, {}).ok).toBe(false)
    expect(validarRevisao(ORIGINAL, null).ok).toBe(false)
  })

  it('ignora mudanças mal formadas sem recusar a revisão', () => {
    const r = validarRevisao(ORIGINAL, {
      segmentos: [{ tipo: 'texto', texto: ORIGINAL }],
      mudancas: [{ original: 'a' }, { original: 'b', corrigido: 'c' }],
    })
    expect(r.ok && r.revisao.mudancas).toEqual([{ original: 'b', corrigido: 'c' }])
  })
})
