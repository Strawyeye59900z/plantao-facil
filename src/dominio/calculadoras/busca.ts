import type { Calculadora } from '@/dominio/tipos'
import { normalizarTexto } from '@/dominio/texto/normalizar'

/** Busca em nome, categoria e descrição; todas as palavras, sem acentos. */
export function filtrarCalculadoras(
  calculadoras: Calculadora[],
  termo: string,
  nomeCategoria: (categoriaId: string | null) => string,
): Calculadora[] {
  const palavras = normalizarTexto(termo).split(' ').filter(Boolean)
  if (palavras.length === 0) return calculadoras
  return calculadoras.filter((c) => {
    const texto = normalizarTexto([c.nome, nomeCategoria(c.categoriaId), c.descricao].join(' \n '))
    return palavras.every((p) => texto.includes(p))
  })
}
