/**
 * Som da tela de PCR: metrônomo das compressões e bipes de alerta, gerados na hora (sem arquivos).
 * O navegador só libera o som depois de um toque do usuário; `ativarSom` deve ser chamado de um clique.
 * O metrônomo agenda os cliques com 1,5 s de antecedência, para não falhar quando a aba fica em segundo plano.
 */
let ctx: AudioContext | null = null

function contexto(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  return ctx
}

/** Libera o som (chamar de um toque). Devolve false se o navegador não deixou. */
export async function ativarSom(): Promise<boolean> {
  const c = contexto()
  if (!c) return false
  if (c.state !== 'running') await c.resume().catch(() => undefined)
  return c.state === 'running'
}

export const somAtivo = () => ctx?.state === 'running'

const agendados = new Set<OscillatorNode>()

function tom(c: AudioContext, frequencia: number, inicio: number, duracao: number, volume: number, rastrear = false) {
  const osc = c.createOscillator()
  const ganho = c.createGain()
  osc.frequency.value = frequencia
  ganho.gain.setValueAtTime(volume, inicio)
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao)
  osc.connect(ganho).connect(c.destination)
  osc.start(inicio)
  osc.stop(inicio + duracao + 0.02)
  if (rastrear) {
    agendados.add(osc)
    osc.onended = () => agendados.delete(osc)
  }
}

export type TipoBipe = 'ritmo' | 'epinefrina' | 'atraso'

/** Bipes de alerta, bem distintos do clique do metrônomo (mais graves e mais longos). */
export function bipe(tipo: TipoBipe): void {
  const c = contexto()
  if (!c || c.state !== 'running') return
  const t = c.currentTime + 0.02
  if (tipo === 'ritmo') {
    tom(c, 660, t, 0.25, 0.6)
    tom(c, 880, t + 0.3, 0.25, 0.6)
  } else if (tipo === 'epinefrina') {
    tom(c, 520, t, 0.18, 0.6)
    tom(c, 520, t + 0.26, 0.18, 0.6)
  } else {
    for (let i = 0; i < 3; i++) tom(c, 440, t + i * 0.22, 0.16, 0.7)
  }
}

let relogio: ReturnType<typeof setInterval> | undefined
let proximo = 0

export function metronomoLigado(): boolean {
  return relogio !== undefined
}

export function iniciarMetronomo(bpm: number): void {
  const c = contexto()
  if (!c || relogio !== undefined) return
  const passo = 60 / bpm
  proximo = c.currentTime + 0.05
  const agendar = () => {
    while (proximo < c.currentTime + 1.5) {
      tom(c, 1000, proximo, 0.05, 0.5, true)
      proximo += passo
    }
  }
  agendar()
  relogio = setInterval(agendar, 250)
}

export function pararMetronomo(): void {
  if (relogio === undefined) return
  clearInterval(relogio)
  relogio = undefined
  for (const osc of agendados) {
    try {
      osc.stop()
    } catch {
      // Já terminou.
    }
  }
  agendados.clear()
}
