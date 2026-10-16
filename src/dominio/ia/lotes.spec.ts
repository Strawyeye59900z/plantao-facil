// Testes com dados fictícios — nenhum conteúdo clínico real.
import { describe, expect, it } from 'vitest'
import { encontrarDuplicatas } from './duplicatas'
import { descreverTrecho, dividirEmLotes, dividirTrecho, nomeArquivoLote } from './lotes'
import { montarPedido, montarPromptChat } from './prompt'

describe('lotes de páginas', () => {
  it('10 páginas novas por lote, repetindo a última do anterior', () => {
    expect(dividirEmLotes(1, 100)).toEqual([
      { de: 1, ate: 10 },
      { de: 10, ate: 20 },
      { de: 20, ate: 30 },
      { de: 30, ate: 40 },
      { de: 40, ate: 50 },
      { de: 50, ate: 60 },
      { de: 60, ate: 70 },
      { de: 70, ate: 80 },
      { de: 80, ate: 90 },
      { de: 90, ate: 100 },
    ])
  })

  it('poucas páginas = 1 lote; sobra pequena vira lote menor; respeita o intervalo', () => {
    expect(dividirEmLotes(1, 7)).toEqual([{ de: 1, ate: 7 }])
    expect(dividirEmLotes(1, 10)).toEqual([{ de: 1, ate: 10 }])
    expect(dividirEmLotes(1, 11)).toEqual([{ de: 1, ate: 10 }, { de: 10, ate: 11 }])
    expect(dividirEmLotes(5, 25)).toEqual([{ de: 5, ate: 14 }, { de: 14, ate: 24 }, { de: 24, ate: 25 }])
    expect(dividirEmLotes(3, 3)).toEqual([{ de: 3, ate: 3 }])
  })

  it('intervalo inválido dá erro', () => {
    expect(() => dividirEmLotes(0, 5)).toThrow()
    expect(() => dividirEmLotes(6, 5)).toThrow()
    expect(() => dividirEmLotes(1.5, 5)).toThrow()
  })

  it('divide lote cortado em dois, repetindo a página do meio', () => {
    expect(dividirTrecho({ de: 10, ate: 20 })).toEqual([{ de: 10, ate: 15 }, { de: 15, ate: 20 }])
    expect(dividirTrecho({ de: 1, ate: 3 })).toEqual([{ de: 1, ate: 2 }, { de: 2, ate: 3 }])
    expect(dividirTrecho({ de: 4, ate: 5 })).toEqual([{ de: 4, ate: 4 }, { de: 5, ate: 5 }])
    expect(dividirTrecho({ de: 4, ate: 4 })).toBeNull()
  })

  it('cada metade é menor que o lote (a divisão sempre termina)', () => {
    for (let n = 2; n <= 11; n++) {
      const [a, b] = dividirTrecho({ de: 1, ate: n })!
      expect(a.ate - a.de).toBeLessThan(n - 1)
      expect(b.ate - b.de).toBeLessThan(n - 1)
    }
  })

  it('textos e nome do arquivo do lote', () => {
    expect(descreverTrecho({ de: 10, ate: 20 })).toBe('páginas 10–20')
    expect(descreverTrecho({ de: 5, ate: 5 })).toBe('página 5')
    expect(nomeArquivoLote('Protocolo Teste.PDF', { de: 10, ate: 20 })).toBe('Protocolo Teste - paginas 10-20.pdf')
    expect(nomeArquivoLote('.pdf', { de: 3, ate: 3 })).toBe('documento - pagina 3.pdf')
  })
})

describe('prompt por lote', () => {
  it('pedido da API cita o trecho, o total e avisa que pode cortar prescrição', () => {
    const p = montarPedido({ de: 10, ate: 20 }, 100)
    expect(p).toContain('páginas 10 a 20 do documento original, que tem 100 páginas')
    expect(p).toMatch(/continuar em outra página/)
  })

  it('prompt do chat com e sem lote', () => {
    const comLote = montarPromptChat({ de: 10, ate: 20 }, 100)
    expect(comLote).toContain('O PDF anexado contém só as páginas 10 a 20')
    expect(comLote).toMatch(/continuar em outra página/)
    expect(montarPromptChat()).not.toMatch(/continuar em outra página/)
  })
})

describe('possíveis duplicatas', () => {
  const imp = (chave: string, titulo: string, origem = `lote ${chave}`) => ({ chave, titulo, origem })

  it('mesmo título (sem maiúsculas/acentos/espaços extras) entre importadas', () => {
    const r = encontrarDuplicatas([imp('1', 'Situação Teste A'), imp('2', '  situacao   teste a'), imp('3', 'Situação Teste B')], [])
    expect(r).toEqual({
      '1': ['“situacao   teste a” (lote 2)'],
      '2': ['“Situação Teste A” (lote 1)'],
    })
  })

  it('compara também com as já salvas na biblioteca', () => {
    const r = encontrarDuplicatas([imp('1', 'Situação Teste B')], ['Situação Teste A', 'SITUAÇÃO TESTE B'])
    expect(r).toEqual({ '1': ['“SITUAÇÃO TESTE B” (já salva na biblioteca)'] })
  })

  it('título vazio não é comparado', () => {
    expect(encontrarDuplicatas([imp('1', ''), imp('2', '  ')], [''])).toEqual({})
  })
})
