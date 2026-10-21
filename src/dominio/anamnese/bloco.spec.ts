import { describe, expect, it } from 'vitest'
import {
  adicionarAnotacao,
  adicionarLeito,
  adicionarProblema,
  adicionarSuspeita,
  blocoVazio,
  lerBloco,
  removerProblema,
} from './bloco'

const ids = () => {
  let n = 0
  return () => `id${++n}`
}

describe('bloco de notas', () => {
  it('cria leito com a identificação, sem nome de paciente', () => {
    const b = adicionarLeito(blocoVazio(), '  Leito 12 ', ids())
    expect(b.leitos[0]?.identificacao).toBe('Leito 12')
    expect(b.leitos[0]?.problemas).toEqual([])
  })

  it('ignora leito sem identificação', () => {
    expect(adicionarLeito(blocoVazio(), '   ', ids()).leitos).toHaveLength(0)
  })

  it('problema tem suspeitas diagnósticas como subitens', () => {
    const gerar = ids()
    let b = adicionarLeito(blocoVazio(), 'Leito 3', gerar)
    const leito = b.leitos[0]!
    b = adicionarProblema(b, leito.id, 'Dispneia', gerar)
    const problema = b.leitos[0]!.problemas[0]!
    b = adicionarSuspeita(b, leito.id, problema.id, 'Insuficiência cardíaca?', gerar)
    expect(b.leitos[0]!.problemas[0]!.suspeitas.map((s) => s.texto)).toEqual(['Insuficiência cardíaca?'])
  })

  it('anotações guardam a hora e ficam na ordem em que foram feitas', () => {
    const gerar = ids()
    let b = adicionarLeito(blocoVazio(), 'Leito 3', gerar)
    const leito = b.leitos[0]!.id
    b = adicionarAnotacao(b, leito, 'Refere melhora', '09:10', gerar)
    b = adicionarAnotacao(b, leito, 'PA 130x80', '09:25', gerar)
    expect(b.leitos[0]!.anotacoes.map((a) => a.hora)).toEqual(['09:10', '09:25'])
  })

  it('remover problema não mexe nos outros leitos', () => {
    const gerar = ids()
    let b = adicionarLeito(blocoVazio(), 'Leito 1', gerar)
    b = adicionarLeito(b, 'Leito 2', gerar)
    const [l1, l2] = b.leitos
    b = adicionarProblema(b, l1!.id, 'Dor torácica', gerar)
    b = adicionarProblema(b, l2!.id, 'Febre', gerar)
    b = removerProblema(b, l1!.id, b.leitos[0]!.problemas[0]!.id)
    expect(b.leitos[0]!.problemas).toHaveLength(0)
    expect(b.leitos[1]!.problemas.map((p) => p.titulo)).toEqual(['Febre'])
  })

  it('lerBloco aceita um bloco válido e recusa forma errada', () => {
    const gerar = ids()
    const b = adicionarAnotacao(adicionarLeito(blocoVazio(), 'Leito 1', gerar), 'id1', 'nota', '08:00', gerar)
    expect(lerBloco(JSON.parse(JSON.stringify(b)))).not.toBeNull()
    expect(lerBloco({ versao: 2, leitos: [], consultas: [] })).toBeNull()
    expect(lerBloco({ versao: 1, leitos: [{ id: 'x' }], consultas: [] })).toBeNull()
    expect(lerBloco(null)).toBeNull()
  })
})
