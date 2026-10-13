/**
 * Normaliza texto para busca: minúsculas, sem acentos, espaços colapsados.
 * "Pneumonia  Comunitária" → "pneumonia comunitaria"
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
