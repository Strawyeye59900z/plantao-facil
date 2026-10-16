import type { Categoria, UUID } from '@/dominio/tipos'
import { normalizarTags, type DadosPrescricao } from '@/dominio/prescricoes/editar'
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
 * - Doses ficam só no texto; nenhuma regra de dose é criada.
 * - Alerta que aponta para um item inexistente vale para a prescrição inteira e vira dúvida.
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

    const itens = p.itens.map((item) => ({
      id: gerarId(),
      texto: item.texto,
      regraDose: null,
      alternativas: item.alternativas.map((a) => ({ id: gerarId(), motivo: a.motivo, texto: a.texto, regraDose: null })),
      // Opções "OU" só fazem sentido com pelo menos 2 opções.
      opcoesEquivalentes: item.opcoesEquivalentes && item.alternativas.length > 0,
    }))

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
        itens,
        alertas,
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
