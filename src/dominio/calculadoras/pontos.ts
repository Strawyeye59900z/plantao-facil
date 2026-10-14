import type { CalculadoraPontos, CampoPontos, FaixaPontos, UUID } from '@/dominio/tipos'
import { formatarNumero, limpar } from '@/dominio/dose/numeros'

/** Resposta por campo: sim/não (boolean), seleção (id da opção) ou número. null = sem resposta. */
export type RespostaCampo = boolean | UUID | number | null
export type Respostas = Record<UUID, RespostaCampo>

export interface ResultadoPontos {
  total: number
  respondidos: number
  totalCampos: number
  /** Todos os campos respondidos e sem erro. */
  completo: boolean
  /** Erros por campo (ex.: valor fora das faixas). Campo com erro não soma. */
  erros: Record<UUID, string>
  /** Pontos de cada campo respondido. */
  pontosPorCampo: Record<UUID, number>
}

/** de ≤ x ≤ até; null = sem limite naquele lado. */
export function dentroDaFaixa(x: number, faixa: { de: number | null; ate: number | null }): boolean {
  return (faixa.de === null || x >= faixa.de) && (faixa.ate === null || x <= faixa.ate)
}

function pontosDoCampo(campo: CampoPontos, resposta: RespostaCampo): { pontos: number } | { erro: string } | null {
  if (resposta === null || resposta === undefined) return null
  switch (campo.tipo) {
    case 'sim_nao':
      return typeof resposta === 'boolean' ? { pontos: resposta ? campo.pontosSim : campo.pontosNao } : null
    case 'selecao': {
      const opcao = campo.opcoes.find((o) => o.id === resposta)
      return opcao ? { pontos: opcao.pontos } : null
    }
    case 'numero': {
      if (typeof resposta !== 'number' || !Number.isFinite(resposta)) return { erro: 'Valor inválido.' }
      if ((campo.min !== null && resposta < campo.min) || (campo.max !== null && resposta > campo.max)) {
        const de = campo.min === null ? '−∞' : formatarNumero(campo.min)
        const ate = campo.max === null ? '∞' : formatarNumero(campo.max)
        return { erro: `Use um valor entre ${de} e ${ate} ${campo.unidade}`.trim() + '.' }
      }
      const faixa = campo.faixas.find((f: FaixaPontos) => dentroDaFaixa(resposta, f))
      return faixa ? { pontos: faixa.pontos } : { erro: 'Valor fora das faixas cadastradas.' }
    }
  }
}

/** Soma os pontos; mostra parcial enquanto houver campos sem resposta. */
export function calcularPontos(calc: CalculadoraPontos, respostas: Respostas): ResultadoPontos {
  let total = 0
  let respondidos = 0
  const erros: Record<UUID, string> = {}
  const pontosPorCampo: Record<UUID, number> = {}

  for (const campo of calc.campos) {
    const r = pontosDoCampo(campo, respostas[campo.id] ?? null)
    if (r === null) continue
    if ('erro' in r) {
      erros[campo.id] = r.erro
      continue
    }
    respondidos++
    pontosPorCampo[campo.id] = r.pontos
    total = limpar(total + r.pontos)
  }

  return {
    total,
    respondidos,
    totalCampos: calc.campos.length,
    completo: respondidos === calc.campos.length && Object.keys(erros).length === 0,
    erros,
    pontosPorCampo,
  }
}

/** Menor e maior total possíveis (para conferir se as faixas de interpretação cobrem tudo). */
export function intervaloPossivel(calc: CalculadoraPontos): { min: number; max: number } {
  let min = 0
  let max = 0
  for (const campo of calc.campos) {
    const valores =
      campo.tipo === 'sim_nao'
        ? [campo.pontosSim, campo.pontosNao]
        : campo.tipo === 'selecao'
          ? campo.opcoes.map((o) => o.pontos)
          : campo.faixas.map((f) => f.pontos)
    if (!valores.length) continue
    min = limpar(min + Math.min(...valores))
    max = limpar(max + Math.max(...valores))
  }
  return { min, max }
}

/** Maior número de casas decimais entre os pontos (para o passo da checagem de lacunas). */
export function casasDosPontos(calc: CalculadoraPontos): number {
  const valores = calc.campos.flatMap((c) =>
    c.tipo === 'sim_nao' ? [c.pontosSim, c.pontosNao] : c.tipo === 'selecao' ? c.opcoes.map((o) => o.pontos) : c.faixas.map((f) => f.pontos),
  )
  return Math.max(0, ...valores.map((v) => (String(v).split('.')[1] ?? '').length))
}
