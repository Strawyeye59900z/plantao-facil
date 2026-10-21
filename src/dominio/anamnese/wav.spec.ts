import { describe, expect, it } from 'vitest'
import { codificarWav } from './wav'

describe('codificarWav', () => {
  const ler = (buffer: ArrayBuffer) => new DataView(buffer)
  const texto = (vista: DataView, inicio: number, tamanho: number) =>
    String.fromCharCode(...Array.from({ length: tamanho }, (_, i) => vista.getUint8(inicio + i)))

  it('gera cabeçalho RIFF/WAVE de 16 bits mono na taxa pedida', () => {
    const wav = ler(codificarWav(new Float32Array(4), 16000))
    expect(texto(wav, 0, 4)).toBe('RIFF')
    expect(texto(wav, 8, 4)).toBe('WAVE')
    expect(wav.getUint16(22, true)).toBe(1) // mono
    expect(wav.getUint32(24, true)).toBe(16000)
    expect(wav.getUint16(34, true)).toBe(16)
  })

  it('tamanho do arquivo é 44 bytes de cabeçalho mais 2 por amostra', () => {
    const buffer = codificarWav(new Float32Array(100), 16000)
    expect(buffer.byteLength).toBe(44 + 200)
    expect(ler(buffer).getUint32(40, true)).toBe(200)
  })

  it('converte amostras para inteiros de 16 bits, com limite de -1 a 1', () => {
    const wav = ler(codificarWav(Float32Array.from([0, 1, -1, 2, -2]), 16000))
    expect(wav.getInt16(44, true)).toBe(0)
    expect(wav.getInt16(46, true)).toBe(32767)
    expect(wav.getInt16(48, true)).toBe(-32768)
    expect(wav.getInt16(50, true)).toBe(32767)
    expect(wav.getInt16(52, true)).toBe(-32768)
  })
})
