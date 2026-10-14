export type LeituraPeso = { ok: true; kg: number } | { ok: false; erro: string }

/**
 * Peso do paciente: número > 0 com até 1 casa decimal (vírgula ou ponto).
 * Sem limite máximo (decisão do usuário). Nunca é salvo.
 */
export function lerPeso(texto: string): LeituraPeso {
  const t = texto.trim().replace(',', '.')
  if (t === '') return { ok: false, erro: 'Informe o peso.' }
  if (!/^\d+(\.\d+)?$/.test(t)) {
    return { ok: false, erro: t.startsWith('-') ? 'O peso deve ser maior que zero.' : 'Peso inválido.' }
  }
  if (/\.\d{2,}$/.test(t)) return { ok: false, erro: 'Use no máximo 1 casa decimal.' }
  const kg = Number(t)
  if (!(kg > 0)) return { ok: false, erro: 'O peso deve ser maior que zero.' }
  return { ok: true, kg }
}
