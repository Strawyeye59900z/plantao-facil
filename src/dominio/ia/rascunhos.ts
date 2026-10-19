import type { Categoria, UUID } from '@/dominio/tipos'
import { normalizarTags, type DadosPrescricao } from '@/dominio/prescricoes/editar'
import { ordenarPorCondicao } from '@/dominio/prescricoes/condicoes'
import { normalizarTexto } from '@/dominio/texto/normalizar'
import type { Trecho } from './lotes'
import type { RespostaIA } from './resposta'

export interface RascunhoImportado {
  /** Identificador só da tela de revisão. */
  chave: string
  dados: DadosPrescricao
  /** Categoria escrita pela IA (mostrada na revisão). */
  categoriaSugerida: string
  /** Lote de onde veio (null = PDF enviado inteiro). */
  lote: { rotulo: string; trecho: Trecho } | null
}

/**
 * Converte a resposta da IA em prescrições "importada — não revisada", ainda não salvas.
 * - Categoria: se o nome bater (sem maiúsculas/acentos) com uma categoria de prescrições, já seleciona;
 *   senão fica "Sem categoria" (decisão do usuário).
 * - Doses ficam só no texto. Texto principal + alternativas viram as opções do item (principal sem motivo).
 *   Adaptação temporária: a resposta ainda é a da v1 (até a Fase 4).
 * - Alerta que aponta para um item inexistente vale para a prescrição inteira e vira dúvida.
 * - Item que aponta para uma condição inexistente fica "Sempre" e vira dúvida. Itens ficam na ordem
 *   de exibição ("Sempre" primeiro, depois cada condição); os alertas continuam ligados pelo id.
 */
export function criarRascunhos(
  resposta: RespostaIA,
  categorias: Categoria[],
  gerarId: () => UUID = () => crypto.randomUUID(),
  lote: RascunhoImportado['lote'] = null,
): RascunhoImportado[] {
  const ativas = categorias.filter((c) => c.escopo === 'prescricao' && c.excluidoEm === null)

  return resposta.prescricoes.map((p) => {
    const sugerida = p.categoria.trim()
    const categoria = sugerida ? ativas.find((c) => normalizarTexto(c.nome) === normalizarTexto(sugerida)) : undefined
    const duvidas = [...p.duvidas]

    const condicoes = p.condicoes.map((nome) => ({ id: gerarId(), nome }))

    const itens = p.itens.map((item, i) => {
      let condicaoId: UUID | null = null
      if (item.condicao > 0) {
        condicaoId = condicoes[item.condicao - 1]?.id ?? null
        if (!condicaoId) duvidas.push(`O item ${i + 1} citava a condição ${item.condicao}, que não existe; ficou valendo "Sempre".`)
      }
      return {
        id: gerarId(),
        condicaoId,
        opcoes: [
          { id: gerarId(), texto: item.texto, motivo: '' },
          ...item.alternativas.map((a) => ({ id: gerarId(), texto: a.texto, motivo: a.motivo })),
        ],
      }
    })

    const alertas = p.alertas.map((a, i) => {
      let itemId: UUID | null = null
      if (a.item > 0) {
        itemId = itens[a.item - 1]?.id ?? null
        if (!itemId) duvidas.push(`O alerta ${i + 1} citava o item ${a.item}, que não existe; ficou valendo para a prescrição inteira.`)
      }
      return { id: gerarId(), tipo: a.tipo, gravidade: a.gravidade, texto: a.texto, itemId }
    })

    return {
      chave: gerarId(),
      categoriaSugerida: sugerida,
      lote,
      dados: {
        titulo: p.titulo,
        categoriaId: categoria?.id ?? null,
        tags: normalizarTags(p.tags),
        itens: ordenarPorCondicao(itens, condicoes),
        condicoes,
        alertas,
        calculadoraIds: [],
        receita: p.receita,
        observacoes: p.observacoes,
        referencia: p.referencia,
        favorito: false,
        origem: 'importada_ia',
        revisada: false,
        duvidasImportacao: duvidas,
      },
    }
  })
}
