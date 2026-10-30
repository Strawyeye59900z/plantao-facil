/** Mantém a tela acesa durante a parada (Wake Lock). Sem suporte, não faz nada. */
let sentinela: WakeLockSentinel | null = null
let querLigada = false

async function pedir() {
  try {
    sentinela = (await navigator.wakeLock?.request('screen')) ?? null
  } catch {
    sentinela = null
  }
}

// O navegador solta o bloqueio quando a aba fica oculta; pede de novo ao voltar.
document.addEventListener('visibilitychange', () => {
  if (querLigada && document.visibilityState === 'visible') void pedir()
})

export function manterTelaLigada(): void {
  querLigada = true
  void pedir()
}

export function liberarTela(): void {
  querLigada = false
  void sentinela?.release().catch(() => undefined)
  sentinela = null
}
