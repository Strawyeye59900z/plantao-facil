import type { ItemPrescricao, Prescricao, UUID } from '@/dominio/tipos'
import { itemEntraNaCopia, ordenarPorCondicao, type CondicoesMarcadas } from './condicoes'

/** Opção escolhida em cada item "OU": itemId → opcaoId (só na memória da tela). */
export type EscolhasOu = Record<UUID, UUID>

type DadosCopia = Pick<Prescricao, 'itens' | 'condicoes'>

export type ResultadoCopia = { ok: true; texto: string } | { ok: false; erro: string }

/** Itens que aparecem na cópia: "Sempre" + condições marcadas, na ordem de exibição. */
export function itensVisiveis(p: DadosCopia, marcadas: CondicoesMarcadas): ItemPrescricao[] {
  return ordenarPorCondicao(p.itens, p.condicoes).filter((item) => itemEntraNaCopia(item, p.condicoes, marcadas))
}

/** Texto da opção a copiar: a única do item simples ou a escolhida no item "OU" (undefined = sem escolha válida). */
function textoEscolhido(item: ItemPrescricao, escolhas: EscolhasOu): string | undefined {
  if (item.opcoes.length <= 1) return item.opcoes[0]?.texto ?? ''
  const escolhida = item.opcoes.find((o) => o.id === escolhas[item.id])
  return escolhida?.texto
}

/** Quebras de linha dentro do texto viram um espaço. */
function emUmaLinha(texto: string): string {
  return texto.replace(/\s*[\r\n]+\s*/g, ' ').trim()
}

/**
 * Monta o texto do Copiar: itens visíveis, renumerados ("1. …"), um por linha.
 * Item "OU" visível sem opção escolhida bloqueia, citando o número que o item tem na tela.
 */
export function montarCopiaPrescricao(
  p: DadosCopia,
  marcadas: CondicoesMarcadas,
  escolhas: EscolhasOu,
): ResultadoCopia {
  const visiveis = itensVisiveis(p, marcadas)
  if (visiveis.length === 0) {
    return { ok: false, erro: p.itens.length > 0 ? 'Marque uma condição para copiar.' : 'Não há itens para copiar.' }
  }
  const linhas: string[] = []
  for (const [i, item] of visiveis.entries()) {
    const texto = textoEscolhido(item, escolhas)
    if (texto === undefined) return { ok: false, erro: `Escolha uma opção no item ${i + 1}.` }
    linhas.push(`${i + 1}. ${emUmaLinha(texto)}`)
  }
  return { ok: true, texto: linhas.join('\n') }
}
