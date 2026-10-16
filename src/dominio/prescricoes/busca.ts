import type { Prescricao } from '@/dominio/tipos'
import { normalizarTexto } from '@/dominio/texto/normalizar'

/**
 * Junta todos os campos pesquisáveis: título, categoria, tags, texto dos itens,
 * motivo e texto das alternativas, receita e observações.
 */
export function textoBuscavel(p: Prescricao, nomeCategoria: string): string {
  const partes = [p.titulo, nomeCategoria, ...p.tags, p.receita, p.observacoes]
  for (const item of p.itens) {
    partes.push(item.texto)
    for (const alt of item.alternativas) partes.push(alt.motivo, alt.texto)
  }
  return normalizarTexto(partes.join(' \n '))
}

/**
 * Cada palavra do termo precisa aparecer em algum campo (busca "E"), ignorando acentos.
 * Termo vazio devolve a lista inteira.
 */
export function filtrarPrescricoes(
  prescricoes: Prescricao[],
  termo: string,
  nomeCategoria: (categoriaId: string | null) => string,
): Prescricao[] {
  const palavras = normalizarTexto(termo).split(' ').filter(Boolean)
  if (palavras.length === 0) return prescricoes
  return prescricoes.filter((p) => {
    const texto = textoBuscavel(p, nomeCategoria(p.categoriaId))
    return palavras.every((palavra) => texto.includes(palavra))
  })
}
