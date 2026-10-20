/** Taxa do Whisper: 16 kHz, mono. */
export const TAXA_AMOSTRAGEM = 16000
/** Cada bloco de áudio tem 30 s. */
export const TAMANHO_BLOCO = TAXA_AMOSTRAGEM * 30
/** Os blocos se sobrepõem 2 s, para não cortar palavras na junção. */
export const SOBREPOSICAO = TAXA_AMOSTRAGEM * 2

/**
 * Acumula o áudio captado (PCM mono 16 kHz) e devolve blocos prontos para transcrever.
 * Mantém só o que ainda não foi enviado; cada bloco começa com os últimos 2 s do anterior.
 */
export class AcumuladorBlocos {
  private buffer = new Float32Array(0)
  private readonly tamanho: number
  private readonly sobreposicao: number

  constructor(tamanho = TAMANHO_BLOCO, sobreposicao = SOBREPOSICAO) {
    if (sobreposicao >= tamanho) throw new Error('A sobreposição precisa ser menor que o bloco.')
    this.tamanho = tamanho
    this.sobreposicao = sobreposicao
  }

  /** Acrescenta um trecho captado e devolve os blocos completos que ficaram prontos. */
  adicionar(trecho: Float32Array): Float32Array[] {
    const novo = new Float32Array(this.buffer.length + trecho.length)
    novo.set(this.buffer)
    novo.set(trecho, this.buffer.length)
    this.buffer = novo

    const prontos: Float32Array[] = []
    while (this.buffer.length >= this.tamanho) {
      prontos.push(this.buffer.slice(0, this.tamanho))
      this.buffer = this.buffer.slice(this.tamanho - this.sobreposicao)
    }
    return prontos
  }

  /**
   * Ao encerrar, devolve o último bloco com o áudio que sobrou (pode ser menor que 30 s).
   * Devolve null se não há áudio novo além da sobreposição.
   */
  encerrar(): Float32Array | null {
    if (this.buffer.length <= this.sobreposicao) {
      this.buffer = new Float32Array(0)
      return null
    }
    const restante = this.buffer
    this.buffer = new Float32Array(0)
    return restante
  }

  /** Descarta todo o áudio ainda não enviado. */
  descartar(): void {
    this.buffer = new Float32Array(0)
  }
}
