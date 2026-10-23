/**
 * O ditado (Wispr Flow) para sozinho após 5 minutos de gravação. A tela da consulta conta o tempo desde
 * o início (ou desde o último "reiniciar") e avisa nos últimos 30 segundos de cada ciclo de 5 minutos.
 */
export const LIMITE_GRAVACAO_S = 5 * 60
export const AVISO_GRAVACAO_S = 30

export interface FaseGravacao {
  /** Verdadeiro nos últimos 30 s do ciclo (4:30 a 5:00). */
  alerta: boolean
  /** Segundos que faltam para o fim do ciclo de 5 minutos. */
  restante: number
}

export function faseGravacao(decorridoS: number): FaseGravacao {
  const noCiclo = Math.max(0, Math.floor(decorridoS)) % LIMITE_GRAVACAO_S
  return { alerta: noCiclo >= LIMITE_GRAVACAO_S - AVISO_GRAVACAO_S, restante: LIMITE_GRAVACAO_S - noCiclo }
}
