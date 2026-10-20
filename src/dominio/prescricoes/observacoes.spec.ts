import { describe, expect, it } from 'vitest'
import { paragrafosObservacoes } from './observacoes'

describe('paragrafosObservacoes', () => {
  it('separa por linha em branco e extrai o rótulo', () => {
    expect(paragrafosObservacoes('Obs: um\nlinha dois\n\n#Bizu: dois')).toEqual([
      { rotulo: 'Obs', texto: 'um\nlinha dois' },
      { rotulo: '#Bizu', texto: 'dois' },
    ])
  })

  it('linha que começa com rótulo abre parágrafo novo', () => {
    expect(paragrafosObservacoes('Obs: a\nCuidados: b')).toEqual([
      { rotulo: 'Obs', texto: 'a' },
      { rotulo: 'Cuidados', texto: 'b' },
    ])
  })

  it('texto sem rótulo', () => {
    expect(paragrafosObservacoes('texto sem rótulo')).toEqual([{ rotulo: null, texto: 'texto sem rótulo' }])
  })

  it('vazio ou só espaços e quebras: nenhum parágrafo', () => {
    expect(paragrafosObservacoes('')).toEqual([])
    expect(paragrafosObservacoes(' \n\n  \n')).toEqual([])
  })

  it('aceita "# Cuidados:" (com espaço) e rótulo com acento', () => {
    expect(paragrafosObservacoes('# Cuidados: x\nObservação: y')).toEqual([
      { rotulo: '# Cuidados', texto: 'x' },
      { rotulo: 'Observação', texto: 'y' },
    ])
  })

  it('CRLF e várias linhas em branco', () => {
    expect(paragrafosObservacoes('Obs: a\r\n\r\n\r\nsem rótulo\r\nsegunda')).toEqual([
      { rotulo: 'Obs', texto: 'a' },
      { rotulo: null, texto: 'sem rótulo\nsegunda' },
    ])
  })

  it('dois-pontos em texto com números não é rótulo', () => {
    expect(paragrafosObservacoes('Obs: a\nrevisar às 10:30 hoje')).toEqual([
      { rotulo: 'Obs', texto: 'a\nrevisar às 10:30 hoje' },
    ])
  })

  it('rótulo sem texto na mesma linha: o texto vem nas linhas seguintes', () => {
    expect(paragrafosObservacoes('Obs:\nlinha seguinte')).toEqual([{ rotulo: 'Obs', texto: 'linha seguinte' }])
  })

  it('linha com link não vira rótulo', () => {
    expect(paragrafosObservacoes('Obs: ver link\nhttps://exemplo.com/a')).toEqual([
      { rotulo: 'Obs', texto: 'ver link\nhttps://exemplo.com/a' },
    ])
    expect(paragrafosObservacoes('http://exemplo.com')).toEqual([{ rotulo: null, texto: 'http://exemplo.com' }])
  })

  it('primeiro parágrafo sem rótulo seguido de rotulado', () => {
    expect(paragrafosObservacoes('introdução\nObs: a')).toEqual([
      { rotulo: null, texto: 'introdução' },
      { rotulo: 'Obs', texto: 'a' },
    ])
  })
})
