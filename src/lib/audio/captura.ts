/**
 * Captura do microfone em PCM mono 16 kHz, para o Whisper.
 * O áudio é entregue em pedaços pequenos e nunca é gravado em disco.
 */

/** Processador do AudioWorklet, enviado como texto (sem arquivo externo). */
const CODIGO_PROCESSADOR = `
class CapturaPcm extends AudioWorkletProcessor {
  process(entradas) {
    const canal = entradas[0] && entradas[0][0]
    if (canal && canal.length) this.port.postMessage(canal.slice(0))
    return true
  }
}
registerProcessor('captura-pcm', CapturaPcm)
`

export interface Captura {
  parar(): void
}

export async function iniciarCaptura(aoReceberTrecho: (trecho: Float32Array) => void): Promise<Captura> {
  const fluxo = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  })

  const contexto = new AudioContext({ sampleRate: 16000 })
  const url = URL.createObjectURL(new Blob([CODIGO_PROCESSADOR], { type: 'application/javascript' }))
  try {
    await contexto.audioWorklet.addModule(url)
  } finally {
    URL.revokeObjectURL(url)
  }

  const fonte = contexto.createMediaStreamSource(fluxo)
  const processador = new AudioWorkletNode(contexto, 'captura-pcm')
  processador.port.onmessage = (evento: MessageEvent<Float32Array>) => aoReceberTrecho(evento.data)
  fonte.connect(processador)

  return {
    parar() {
      processador.port.onmessage = null
      fonte.disconnect()
      processador.disconnect()
      fluxo.getTracks().forEach((faixa) => faixa.stop())
      void contexto.close()
    },
  }
}
