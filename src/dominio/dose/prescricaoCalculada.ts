import type { ItemPrescricao, RegraDose, ResultadoDose, UUID } from '@/dominio/tipos'
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
  /** Opções equivalentes sem nenhuma escolhida ainda (bloqueia copiar). */
  escolhaPendente: boolean
}

export interface PrescricaoCalculada {
  linhas: LinhaCalculada[]
  /** Algum item que será copiado depende do peso. */
  precisaPeso: boolean
  /** Números (1, 2, …) dos itens com opções equivalentes ainda sem escolha. */
  itensSemEscolha: number[]
  /** Copiar liberado: tudo escolhido e (não precisa de peso, ou peso válido e nenhum erro de cálculo). */
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
 */
export function calcularPrescricao(
  itens: ItemPrescricao[],
  escolhidas: Record<UUID, string | null>,
  pesoKg: number | null,
): PrescricaoCalculada {
  const linhas = itens.map((item): LinhaCalculada => {
    const escolha = escolhidas[item.id] ?? null
    const ou = !!item.opcoesEquivalentes

    const opcoes = ou
      ? [
          calcularOpcao(OPCAO_PRINCIPAL, '', item.texto, item.regraDose, pesoKg),
          ...item.alternativas.map((a) => calcularOpcao(a.id, a.motivo, a.texto, a.regraDose, pesoKg)),
        ]
      : []

    const alt = escolha && escolha !== OPCAO_PRINCIPAL ? item.alternativas.find((a) => a.id === escolha) : undefined
    const escolhaPendente = ou && !alt && escolha !== OPCAO_PRINCIPAL
    if (escolhaPendente) {
      return { itemId: item.id, alternativaId: null, motivoAlternativa: null, texto: '', regra: null, resultado: null, opcoesEquivalentes: true, opcoes, escolhaPendente }
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
    }
  })

  const itensSemEscolha = linhas.flatMap((l, i) => (l.escolhaPendente ? [i + 1] : []))
  const precisaPeso = linhas.some((l) => l.regra !== null)
  const pesoOk = !precisaPeso || (pesoKg !== null && linhas.every((l) => !l.regra || l.resultado?.ok))
  return { linhas, precisaPeso, itensSemEscolha, podeCopiar: itensSemEscolha.length === 0 && pesoOk }
}

/** "1. texto" por linha, sem linha em branco; quebras dentro do item viram espaço. */
export function montarTextoCopia(linhas: Pick<LinhaCalculada, 'texto'>[]): string {
  return linhas.map((l, i) => `${i + 1}. ${l.texto.replace(/\s+/g, ' ').trim()}`).join('\n')
}
