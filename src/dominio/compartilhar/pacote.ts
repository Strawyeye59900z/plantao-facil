import { montarBackup, type Biblioteca } from '@/dominio/backup/backup'
import type { ArquivoBackup, ISODate, Prescricao, UUID } from '@/dominio/tipos'

/** Origem das prescrições que chegaram por compartilhamento; entram "não revisadas". */
export const ORIGEM_RECEBIDA = 'recebida_colega' as const
export const ETIQUETA_RECEBIDA = 'Recebida de colega'

/**
 * Pacote enviado a um colega: é um backup (mesmo formato e mesma mesclagem) só com as prescrições
 * escolhidas, as calculadoras/escalas ligadas a elas e os grupos usados. Nada da lixeira vai, e os
 * favoritos (pessoais) saem desmarcados.
 */
export function montarPacote(b: Biblioteca, ids: UUID[], criadoEm: ISODate, versaoApp: string): ArquivoBackup {
  const escolhidas = new Set(ids)
  const prescricoes = b.prescricoes
    .filter((p) => p.excluidoEm === null && escolhidas.has(p.id))
    .map((p) => ({ ...p, favorito: false }))
  const ligadas = new Set(prescricoes.flatMap((p) => p.calculadoraIds))
  const calculadoras = b.calculadoras
    .filter((c) => c.excluidoEm === null && ligadas.has(c.id))
    .map((c) => ({ ...c, favorito: false }))
  const usados = new Set<UUID>()
  for (const item of [...prescricoes, ...calculadoras]) if (item.categoriaId) usados.add(item.categoriaId)
  const categorias = b.categorias.filter((c) => c.excluidoEm === null && usados.has(c.id))
  return montarBackup({ prescricoes, calculadoras, categorias }, criadoEm, versaoApp)
}

/** O que veio do colega entra marcado e "não revisado", para ninguém usar a dose de outro sem conferir. */
export function marcarComoRecebidas(prescricoes: Prescricao[]): Prescricao[] {
  return prescricoes.map((p) => ({ ...p, origem: ORIGEM_RECEBIDA, revisada: false }))
}
