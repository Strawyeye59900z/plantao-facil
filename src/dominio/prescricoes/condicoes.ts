import type { Condicao, ItemPrescricao, UUID } from '@/dominio/tipos'

/** Condições marcadas na tela da prescrição (só na memória). */
export type CondicoesMarcadas = Record<UUID, boolean>

export function condicaoVazia(gerarId: () => UUID = () => crypto.randomUUID()): Condicao {
  return { id: gerarId(), nome: '' }
}

/** Condição válida do item; id que não existe mais na prescrição conta como "Sempre" (null). */
export function condicaoDoItem(item: ItemPrescricao, condicoes: Condicao[]): UUID | null {
  const id = item.condicaoId ?? null
  return id && condicoes.some((c) => c.id === id) ? id : null
}

/**
 * Ordem de exibição: itens "Sempre" primeiro, depois os de cada condição na ordem das condições.
 * Estável: dentro de cada grupo mantém a ordem original.
 */
export function ordenarPorCondicao<T extends ItemPrescricao>(itens: T[], condicoes: Condicao[]): T[] {
  const posicao = new Map(condicoes.map((c, i) => [c.id, i + 1]))
  return itens
    .map((item, i) => ({ item, i, grupo: posicao.get(condicaoDoItem(item, condicoes) ?? '') ?? 0 }))
    .sort((a, b) => a.grupo - b.grupo || a.i - b.i)
    .map((x) => x.item)
}

/** O item entra no Copiar? "Sempre" entra; item de condição só se ela estiver marcada. */
export function itemEntraNaCopia(item: ItemPrescricao, condicoes: Condicao[], marcadas: CondicoesMarcadas): boolean {
  const id = condicaoDoItem(item, condicoes)
  return id === null || !!marcadas[id]
}
