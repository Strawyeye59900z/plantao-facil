import { describe, expect, it } from 'vitest'
import { AcumuladorBlocos, SOBREPOSICAO, TAMANHO_BLOCO } from './blocos'

const trecho = (tamanho: number, valor = 0.1) => new Float32Array(tamanho).fill(valor)

describe('AcumuladorBlocos', () => {
  it('não devolve bloco antes de juntar 30 s de áudio', () => {
    const acumulador = new AcumuladorBlocos()
    expect(acumulador.adicionar(trecho(TAMANHO_BLOCO - 1))).toHaveLength(0)
  })

  it('devolve um bloco de 30 s quando completa o tamanho', () => {
    const acumulador = new AcumuladorBlocos()
    const prontos = acumulador.adicionar(trecho(TAMANHO_BLOCO))
    expect(prontos).toHaveLength(1)
    expect(prontos[0]!.length).toBe(TAMANHO_BLOCO)
  })

  it('o bloco seguinte começa com a sobreposição do anterior', () => {
    const acumulador = new AcumuladorBlocos(10, 4)
    const primeiro = acumulador.adicionar(Float32Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
    expect(primeiro).toHaveLength(1)
    const segundo = acumulador.adicionar(Float32Array.from([11, 12, 13, 14, 15, 16]))
    expect(segundo).toHaveLength(1)
    expect(Array.from(segundo[0]!)).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
  })

  it('aceita trechos de tamanhos variados e não perde áudio', () => {
    const acumulador = new AcumuladorBlocos(10, 2)
    let blocos = 0
    for (const tamanho of [3, 7, 5, 9, 1]) blocos += acumulador.adicionar(trecho(tamanho)).length
    // 25 amostras novas: 1º bloco com 10; depois 2 de sobreposição + 15 novas formam o 2º bloco com 10.
    expect(blocos).toBe(2)
  })

  it('encerrar devolve o áudio restante, mesmo menor que 30 s', () => {
    const acumulador = new AcumuladorBlocos(10, 2)
    acumulador.adicionar(trecho(10))
    acumulador.adicionar(trecho(5))
    const final = acumulador.encerrar()
    expect(final).not.toBeNull()
    expect(final!.length).toBe(2 + 5)
  })

  it('encerrar sem áudio novo devolve null', () => {
    const acumulador = new AcumuladorBlocos(10, 2)
    acumulador.adicionar(trecho(10))
    expect(acumulador.encerrar()).toBeNull()
  })

  it('descartar esvazia o que ainda não foi enviado', () => {
    const acumulador = new AcumuladorBlocos(10, 2)
    acumulador.adicionar(trecho(7))
    acumulador.descartar()
    expect(acumulador.encerrar()).toBeNull()
  })

  it('recusa sobreposição maior ou igual ao bloco', () => {
    expect(() => new AcumuladorBlocos(10, 10)).toThrow()
  })

  it('usa 2 s de sobreposição por padrão', () => {
    expect(SOBREPOSICAO).toBe(32000)
  })
})
