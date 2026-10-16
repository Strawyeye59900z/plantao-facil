import type { Condicao, ItemPrescricao, RegraDose, ResultadoDose, UUID } from '@/dominio/tipos'
import { itemEntraNaCopia, type CondicoesMarcadas } from '@/dominio/prescricoes/condicoes'
import { calcularDose } from './calculo'
import { substituirMarcadores } from './marcadores'

/** Em item de opções equivalentes (OU): valor da escolha que representa o texto principal (opção 1). */
export const OPCAO_PRINCIPAL = '__principal__'

export interface OpcaoCalculada {
  /** OPCAO_PRINCIPAL ou id da alternativa. */
  id: string
  /** Motivo/rótulo cadastrado (pode ser vazio em opções equivalentes). */
  rotulo: string
  texto: string
  regra: RegraDose | null
  resultado: ResultadoDose | null
}

export interface LinhaCalculada {
  itemId: UUID
  /** Alternativa escolhida no lugar do item (ou null = padrão / opção 1). */
  alternativaId: UUID | null
  motivoAlternativa: string | null
  /** Texto com marcadores substituídos (ou "[dose]" sem peso). Vazio se a escolha está pendente. */
  texto: string
  regra: RegraDose | null
  resultado: ResultadoDose | null
  /** Item com opções equivalentes (OU): todas as opções calculadas, para mostrar por extenso. */
  opcoesEquivalentes: boolean
  opcoes: OpcaoCalculada[]
  /** Opções equivalentes sem nenhuma escolhida ainda (bloqueia copiar, se o item for copiado). */
  escolhaPendente: boolean
  /** Entra no Copiar: item "Sempre" ou de condição marcada. */
  copiar: boolean
}

export interface PrescricaoCalculada {
  linhas: LinhaCalculada[]
  /** Algum item que será copiado depende do peso. */
  precisaPeso: boolean
  /** Números (1, 2, …, na ordem das linhas) dos itens copiados com opções equivalentes ainda sem escolha. */
  itensSemEscolha: number[]
  /** Nenhum item entra no Copiar (só há itens de condições e nenhuma está marcada). */
  nadaParaCopiar: boolean
  /** Copiar liberado: algo a copiar, tudo escolhido e (não precisa de peso, ou peso válido e nenhum erro de cálculo). */
  podeCopiar: boolean
}

function calcularOpcao(id: string, rotulo: string, texto: string, regra: RegraDose | null, pesoKg: number | null): OpcaoCalculada {
  const resultado = regra && pesoKg !== null ? calcularDose(regra, pesoKg) : null
  return { id, rotulo, texto: substituirMarcadores(texto, regra, resultado), regra, resultado }
}

/**
 * Monta os itens efetivos (com a alternativa/opção escolhida) e calcula as doses.
 * `escolhidas[itemId]`: id da alternativa, OPCAO_PRINCIPAL (opção 1 de item OU) ou null/ausente.
 * Item comum sem escolha = texto padrão. Item de opções equivalentes sem escolha = pendente.
 * `pesoKg` null = peso ainda não informado ou inválido.
 * Condições: itens "Sempre" sempre entram no Copiar; os de uma condição só se ela estiver em `marcadas`.
 * Itens fora do Copiar continuam calculados (aparecem na tela), mas não bloqueiam nem exigem peso.
 */
export function calcularPrescricao(
  itens: ItemPrescricao[],
  escolhidas: Record<UUID, string | null>,
  pesoKg: number | null,
  condicoes: Condicao[] = [],
  marcadas: CondicoesMarcadas = {},
): PrescricaoCalculada {
  const linhas = itens.map((item): LinhaCalculada => {
    const escolha = escolhidas[item.id] ?? null
    const ou = !!item.opcoesEquivalentes
    const copiar = itemEntraNaCopia(item, condicoes, marcadas)

    const opcoes = ou
      ? [
          calcularOpcao(OPCAO_PRINCIPAL, '', item.texto, item.regraDose, pesoKg),
          ...item.alternativas.map((a) => calcularOpcao(a.id, a.motivo, a.texto, a.regraDose, pesoKg)),
        ]
      : []

    const alt = escolha && escolha !== OPCAO_PRINCIPAL ? item.alternativas.find((a) => a.id === escolha) : undefined
    const escolhaPendente = ou && !alt && escolha !== OPCAO_PRINCIPAL
    if (escolhaPendente) {
      return { itemId: item.id, alternativaId: null, motivoAlternativa: null, texto: '', regra: null, resultado: null, opcoesEquivalentes: true, opcoes, escolhaPendente, copiar }
    }

    const efetiva = calcularOpcao(alt?.id ?? OPCAO_PRINCIPAL, alt?.motivo ?? '', alt?.texto ?? item.texto, alt ? alt.regraDose : item.regraDose, pesoKg)
    return {
      itemId: item.id,
      alternativaId: alt?.id ?? null,
      motivoAlternativa: alt ? alt.motivo || null : null,
      texto: efetiva.texto,
      regra: efetiva.regra,
      resultado: efetiva.resultado,
      opcoesEquivalentes: ou,
      opcoes,
      escolhaPendente: false,
      copiar,
    }
  })

  const copiadas = linhas.filter((l) => l.copiar)
  const itensSemEscolha = linhas.flatMap((l, i) => (l.copiar && l.escolhaPendente ? [i + 1] : []))
  const precisaPeso = copiadas.some((l) => l.regra !== null)
  const pesoOk = !precisaPeso || (pesoKg !== null && copiadas.every((l) => !l.regra || l.resultado?.ok))
  const nadaParaCopiar = copiadas.length === 0
  return { linhas, precisaPeso, itensSemEscolha, nadaParaCopiar, podeCopiar: !nadaParaCopiar && itensSemEscolha.length === 0 && pesoOk }
}

/**
 * "1. texto" por linha, sem linha em branco; quebras dentro do item viram espaço.
 * Só as linhas que entram no Copiar (sem `copiar` = entra), renumeradas a partir de 1.
 */
export function montarTextoCopia(linhas: (Pick<LinhaCalculada, 'texto'> & { copiar?: boolean })[]): string {
  return linhas
    .filter((l) => l.copiar !== false)
    .map((l, i) => `${i + 1}. ${l.texto.replace(/\s+/g, ' ').trim()}`)
    .join('\n')
}
