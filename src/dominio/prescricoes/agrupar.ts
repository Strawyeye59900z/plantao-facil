import type { Categoria, UUID } from '@/dominio/tipos'

export interface GrupoCategoria<T> {
  /** null = "Sem categoria". */
  categoria: Categoria | null
  itens: T[]
}

const colador = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

/** Título de prescrição ou nome de calculadora. */
export function nomeDoItem(item: { titulo?: string; nome?: string }): string {
  return item.titulo ?? item.nome ?? ''
}

/**
 * Agrupa por categoria na ordem cadastrada (`ordem`), itens em ordem alfabética.
 * Itens sem categoria (ou com categoria excluída) vão para "Sem categoria", no fim.
 * Grupos vazios são omitidos. Serve para prescrições e calculadoras.
 */
export function agruparPorCategoria<T extends { categoriaId: UUID | null; titulo?: string; nome?: string }>(
  itens: T[],
  categorias: Categoria[],
): GrupoCategoria<T>[] {
  const comparar = (a: T, b: T) => colador.compare(nomeDoItem(a), nomeDoItem(b))
  const ativas = categorias
    .filter((c) => c.excluidoEm === null)
    .sort((a, b) => a.ordem - b.ordem || colador.compare(a.nome, b.nome))
  const porId = new Map(ativas.map((c) => [c.id, [] as T[]]))
  const semCategoria: T[] = []

  for (const item of itens) {
    const grupo = item.categoriaId ? porId.get(item.categoriaId) : undefined
    ;(grupo ?? semCategoria).push(item)
  }

  const grupos: GrupoCategoria<T>[] = ativas
    .map((categoria) => ({ categoria, itens: porId.get(categoria.id)!.sort(comparar) }))
    .filter((g) => g.itens.length > 0)

  if (semCategoria.length > 0) grupos.push({ categoria: null, itens: semCategoria.sort(comparar) })
  return grupos
}
