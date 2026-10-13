import type { Categoria, Prescricao } from '@/dominio/tipos'

export interface GrupoCategoria {
  /** null = "Sem categoria". */
  categoria: Categoria | null
  prescricoes: Prescricao[]
}

const colador = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

export function compararTitulos(a: Prescricao, b: Prescricao): number {
  return colador.compare(a.titulo, b.titulo)
}

/**
 * Agrupa por categoria na ordem cadastrada (`ordem`), títulos em ordem alfabética.
 * Prescrições sem categoria (ou com categoria excluída) vão para "Sem categoria", no fim.
 * Grupos vazios são omitidos.
 */
export function agruparPorCategoria(
  prescricoes: Prescricao[],
  categorias: Categoria[],
): GrupoCategoria[] {
  const ativas = categorias
    .filter((c) => c.excluidoEm === null)
    .sort((a, b) => a.ordem - b.ordem || colador.compare(a.nome, b.nome))
  const porId = new Map(ativas.map((c) => [c.id, [] as Prescricao[]]))
  const semCategoria: Prescricao[] = []

  for (const p of prescricoes) {
    const grupo = p.categoriaId ? porId.get(p.categoriaId) : undefined
    ;(grupo ?? semCategoria).push(p)
  }

  const grupos: GrupoCategoria[] = ativas
    .map((categoria) => ({
      categoria,
      prescricoes: porId.get(categoria.id)!.sort(compararTitulos),
    }))
    .filter((g) => g.prescricoes.length > 0)

  if (semCategoria.length > 0) {
    grupos.push({ categoria: null, prescricoes: semCategoria.sort(compararTitulos) })
  }
  return grupos
}
