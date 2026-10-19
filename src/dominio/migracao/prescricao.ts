import type { ItemPrescricao, OpcaoItem, Prescricao, UUID } from '@/dominio/tipos'
import { converterTextoComRegraV1 } from './v1/regra'
import type { ItemPrescricaoV1, PrescricaoV1, RegraDoseV1 } from './v1/tipos'

export { descreverRegraV1 } from './v1/regra'

type GerarId = () => UUID

/** Motivo da opção principal de um item que tinha alternativas (sem "OU") na v1. */
const MOTIVO_PADRAO = 'Padrão'

function textoMigrado(texto: string, regra: RegraDoseV1 | null | undefined): string {
  return regra != null ? converterTextoComRegraV1(texto, regra) : texto
}

/**
 * IDs das opções são determinísticos (principal = `${item.id}-principal`; alternativas mantêm o id da v1):
 * migrar o mesmo dado duas vezes (banco e backup v1) dá o mesmo resultado, sem falso conflito na mesclagem.
 */
function migrarItem(item: ItemPrescricaoV1): ItemPrescricao {
  const alternativas = item.alternativas ?? []
  const equivalentes = item.opcoesEquivalentes === true
  const principal: OpcaoItem = {
    id: `${item.id}-principal`,
    texto: textoMigrado(item.texto, item.regraDose),
    motivo: alternativas.length > 0 && !equivalentes ? MOTIVO_PADRAO : '',
  }
  return {
    // O id do item é mantido: alertas apontam para ele.
    id: item.id,
    condicaoId: item.condicaoId ?? null,
    opcoes: [
      principal,
      ...alternativas.map((alt) => ({ id: alt.id, texto: textoMigrado(alt.texto, alt.regraDose), motivo: alt.motivo })),
    ],
  }
}

function tinhaCalculoDeDose(item: ItemPrescricaoV1): boolean {
  // `!= null`: registros antigos sem o campo (undefined) contam como sem regra.
  return item.regraDose != null || (item.alternativas ?? []).some((alt) => alt.regraDose != null)
}

/**
 * Converte uma prescrição da v1 para o modelo v2, sem perder dados:
 * - texto principal + alternativas viram as opções do item (mesmo `item.id`); sem "OU" na v1,
 *   a opção principal recebe o motivo "Padrão";
 * - regra de dose vira texto (ver `converterTextoComRegraV1`) e a prescrição fica "não revisada",
 *   com uma dúvida por item convertido;
 * - campos ausentes em registros antigos: receita '', condições [], condição do item "Sempre";
 * - `calculadoraIds` começa vazio;
 * - IDs das opções determinísticos (ver `migrarItem`): o mesmo dado migrado duas vezes dá o mesmo resultado.
 * Função pura: não altera o registro recebido.
 * `_gerarId` não é usado nas opções; fica na assinatura para as próximas migrações de outras entidades.
 */
export function migrarPrescricaoV1(p: PrescricaoV1, _gerarId: GerarId = () => crypto.randomUUID()): Prescricao {
  const avisos: string[] = []
  p.itens.forEach((item, i) => {
    if (tinhaCalculoDeDose(item)) {
      avisos.push(
        `Migrada da versão anterior: o item ${i + 1} tinha cálculo de dose automático, transformado em texto. Confira.`,
      )
    }
  })

  return {
    id: p.id,
    criadoEm: p.criadoEm,
    atualizadoEm: p.atualizadoEm,
    excluidoEm: p.excluidoEm,
    titulo: p.titulo,
    categoriaId: p.categoriaId,
    tags: [...p.tags],
    itens: p.itens.map(migrarItem),
    condicoes: (p.condicoes ?? []).map((c) => ({ ...c })),
    alertas: p.alertas.map((a) => ({ ...a })),
    calculadoraIds: [],
    receita: p.receita ?? '',
    observacoes: p.observacoes,
    referencia: p.referencia,
    favorito: p.favorito,
    origem: p.origem,
    revisada: avisos.length > 0 ? false : p.revisada,
    duvidasImportacao: [...p.duvidasImportacao, ...avisos],
  }
}
