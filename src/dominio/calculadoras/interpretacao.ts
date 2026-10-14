import type { FaixaInterpretacao } from '@/dominio/tipos'
import { formatarNumero, limpar } from '@/dominio/dose/numeros'
import { dentroDaFaixa } from './pontos'

/** Primeira faixa que contém o valor (de ≤ x ≤ até), ou undefined. */
export function interpretar(valor: number, faixas: FaixaInterpretacao[]): FaixaInterpretacao | undefined {
  return faixas.find((f) => dentroDaFaixa(valor, f))
}

type Faixa = { de: number | null; ate: number | null }

/**
 * Avisos sobre faixas (não bloqueiam salvar):
 * - sobreposição entre faixas;
 * - lacuna entre faixas consecutivas, considerando o passo (ex.: casas = 0 → 0–4 e 5–10 é contínuo);
 * - se `intervalo` for informado (escore), valores possíveis sem faixa no começo/fim.
 * Faixa com "de" maior que "até" é reportada como erro.
 */
export function analisarFaixas(
  faixas: Faixa[],
  casasDecimais: number,
  intervalo?: { min: number; max: number },
): { erros: string[]; avisos: string[] } {
  const erros: string[] = []
  const avisos: string[] = []
  const passo = 10 ** -casasDecimais
  const n = (x: number) => formatarNumero(x)
  const rotulo = (f: Faixa) => `${f.de === null ? '−∞' : n(f.de)} a ${f.ate === null ? '∞' : n(f.ate)}`

  faixas.forEach((f, i) => {
    if (f.de !== null && f.ate !== null && f.de > f.ate) erros.push(`Faixa ${i + 1}: "de" maior que "até".`)
  })
  if (erros.length || faixas.length === 0) return { erros, avisos }

  const ordenadas = [...faixas].sort((a, b) => (a.de ?? -Infinity) - (b.de ?? -Infinity))
  for (let i = 0; i < ordenadas.length - 1; i++) {
    const atual = ordenadas[i]!
    const proxima = ordenadas[i + 1]!
    const fimAtual = atual.ate ?? Infinity
    const inicioProxima = proxima.de ?? -Infinity
    if (inicioProxima <= fimAtual) {
      avisos.push(`Faixas sobrepostas: ${rotulo(atual)} e ${rotulo(proxima)}.`)
    } else if (limpar(inicioProxima - fimAtual) > passo + 1e-9) {
      avisos.push(`Lacuna entre ${n(fimAtual)} e ${n(inicioProxima)}: valores aí ficam sem interpretação.`)
    }
  }

  if (intervalo) {
    const primeira = ordenadas[0]!
    const ultima = ordenadas.reduce((a, b) => ((b.ate ?? Infinity) > (a.ate ?? Infinity) ? b : a))
    if (primeira.de !== null && primeira.de > intervalo.min) {
      avisos.push(`Totais de ${n(intervalo.min)} até abaixo de ${n(primeira.de)} ficam sem interpretação.`)
    }
    if (ultima.ate !== null && ultima.ate < intervalo.max) {
      avisos.push(`Totais acima de ${n(ultima.ate)} até ${n(intervalo.max)} ficam sem interpretação.`)
    }
  }
  return { erros, avisos }
}
