import type { Alerta, Prescricao } from '@/dominio/tipos'

/**
 * Alertas mostrados no topo da prescrição: os sem item e os ligados a um item que não
 * existe mais (dados importados/migrados) — um alerta nunca pode ficar escondido.
 * Alertas de itens existentes (inclusive sob condição não marcada) ficam com o item.
 */
export function alertasDaPrescricao(p: Pick<Prescricao, 'alertas' | 'itens'>): Alerta[] {
  const idsItens = new Set(p.itens.map((i) => i.id))
  return p.alertas.filter((a) => a.itemId === null || !idsItens.has(a.itemId))
}
