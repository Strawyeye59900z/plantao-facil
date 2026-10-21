/**
 * Separa o texto recebido em duas partes: o prontuário (SOAP, o que se copia) e o que não vai
 * para o prontuário (DÚVIDAS DA TRANSCRIÇÃO e aviso sobre identificadores).
 */
const MARCADOR_FORA = /^\s*DÚVIDAS DA TRANSCRIÇÃO:?\s*$/im

export function separarProntuario(texto: string): { prontuario: string; fora: string } {
  const m = MARCADOR_FORA.exec(texto)
  if (!m) return { prontuario: texto.trim(), fora: '' }
  return {
    prontuario: texto.slice(0, m.index).trim(),
    fora: texto.slice(m.index).trim(),
  }
}
