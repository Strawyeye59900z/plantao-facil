import type { Categoria, UUID } from '@/dominio/tipos'

/** Entrada selecionável da lateral: atalhos fixos ou o id de um grupo. */
export type ChaveLateral = 'favoritos' | 'todas' | 'sem-grupo' | UUID

export interface EntradaLateral {
  chave: ChaveLateral
  rotulo: string
  /** Chave da galeria de ícones; null = sem ícone próprio. */
  icone: string | null
  quantidade: number
}

type ItemDaBiblioteca = { categoriaId: UUID | null; favorito: boolean }

export const ROTULO_SEM_GRUPO = 'Sem grupo'
const colador = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

/**
 * Entradas da lateral: Favoritos, Todas, os grupos na ordem cadastrada e, por fim, Sem grupo.
 * `itens` já deve vir só com os ativos. Favoritos aparece sempre; Sem grupo só se houver item sem grupo.
 */
export function montarLateral<T extends ItemDaBiblioteca>(itens: T[], grupos: Categoria[]): EntradaLateral[] {
  const ativos = grupos
    .filter((g) => g.excluidoEm === null)
    .sort((a, b) => a.ordem - b.ordem || colador.compare(a.nome, b.nome))
  const semGrupo = filtrarPorChave(itens, 'sem-grupo', grupos).length

  return [
    { chave: 'favoritos', rotulo: 'Favoritos', icone: 'estrela', quantidade: filtrarPorChave(itens, 'favoritos').length },
    { chave: 'todas', rotulo: 'Todas', icone: null, quantidade: itens.length },
    ...ativos.map((g) => ({
      chave: g.id,
      rotulo: g.nome,
      icone: g.icone,
      quantidade: filtrarPorChave(itens, g.id).length,
    })),
    ...(semGrupo > 0 ? [{ chave: 'sem-grupo', rotulo: ROTULO_SEM_GRUPO, icone: null, quantidade: semGrupo }] : []),
  ]
}

/**
 * Com `grupos`, "Sem grupo" também inclui itens cujo grupo não está entre os ativos
 * (excluído ou desconhecido), como na v1 ("Sem categoria").
 */
export function filtrarPorChave<T extends ItemDaBiblioteca>(itens: T[], chave: ChaveLateral, grupos?: Categoria[]): T[] {
  if (chave === 'todas') return itens
  if (chave === 'favoritos') return itens.filter((i) => i.favorito)
  if (chave === 'sem-grupo') {
    if (!grupos) return itens.filter((i) => i.categoriaId === null)
    const ativos = new Set(grupos.filter((g) => g.excluidoEm === null).map((g) => g.id))
    return itens.filter((i) => i.categoriaId === null || !ativos.has(i.categoriaId))
  }
  return itens.filter((i) => i.categoriaId === chave)
}
