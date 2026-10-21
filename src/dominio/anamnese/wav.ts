/**
 * Converte PCM float (-1 a 1) em WAV de 16 bits, mono. Usado para enviar cada bloco à API.
 */
export function codificarWav(amostras: Float32Array, taxa: number): ArrayBuffer {
  const bytesDados = amostras.length * 2
  const buffer = new ArrayBuffer(44 + bytesDados)
  const vista = new DataView(buffer)
  const escrever = (posicao: number, texto: string) => {
    for (let i = 0; i < texto.length; i++) vista.setUint8(posicao + i, texto.charCodeAt(i))
  }

  escrever(0, 'RIFF')
  vista.setUint32(4, 36 + bytesDados, true)
  escrever(8, 'WAVE')
  escrever(12, 'fmt ')
  vista.setUint32(16, 16, true) // tamanho do bloco fmt
  vista.setUint16(20, 1, true) // PCM
  vista.setUint16(22, 1, true) // mono
  vista.setUint32(24, taxa, true)
  vista.setUint32(28, taxa * 2, true) // bytes por segundo
  vista.setUint16(32, 2, true) // bytes por amostra
  vista.setUint16(34, 16, true) // bits
  escrever(36, 'data')
  vista.setUint32(40, bytesDados, true)

  for (let i = 0; i < amostras.length; i++) {
    const valor = Math.max(-1, Math.min(1, amostras[i] ?? 0))
    vista.setInt16(44 + i * 2, valor < 0 ? valor * 0x8000 : valor * 0x7fff, true)
  }
  return buffer
}
