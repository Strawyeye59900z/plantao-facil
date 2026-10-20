import { normalizarTexto } from '@/dominio/texto/normalizar'

/** Quantas palavras no máximo podem se repetir na sobreposição entre dois blocos de áudio. */
export const MAX_PALAVRAS_SOBREPOSTAS = 12

const palavras = (texto: string) => texto.trim().split(/\s+/).filter(Boolean)

/**
 * Junta o texto de um bloco novo ao texto já transcrito. Os blocos de áudio se sobrepõem
 * alguns segundos, então o início do bloco novo costuma repetir o fim do anterior.
 * Remove essa repetição comparando palavras sem acento e sem pontuação.
 */
export function juntarTrechos(anterior: string, novo: string): string {
  const atuais = palavras(anterior)
  const entrada = palavras(novo)
  if (atuais.length === 0) return entrada.join(' ')
  if (entrada.length === 0) return atuais.join(' ')

  const chave = (p: string) => normalizarTexto(p).replace(/[^\p{L}\p{N}]/gu, '')
  const limite = Math.min(MAX_PALAVRAS_SOBREPOSTAS, atuais.length, entrada.length)

  // Procura a maior sobreposição: o fim de `atuais` igual ao início de `entrada`.
  for (let k = limite; k > 0; k--) {
    const fim = atuais.slice(-k).map(chave)
    const ini = entrada.slice(0, k).map(chave)
    if (fim.every((p, i) => p === ini[i]) && fim.some((p) => p !== '')) {
      return [...atuais, ...entrada.slice(k)].join(' ')
    }
  }
  return [...atuais, ...entrada].join(' ')
}
