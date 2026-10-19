import type { Calculadora } from '@/dominio/tipos'
import type { CalculadoraV1 } from './v1/tipos'

/**
 * Conversão mínima de uma calculadora da v1 para o modelo atual (função pura).
 * Pontos: ganha `area: 'escala'`. Fórmula: `entradas` viram campos numéricos e a expressão
 * única vira a saída "Resultado" (com as faixas de interpretação e o teto/piso).
 */
export function migrarCalculadoraV1(c: CalculadoraV1): Calculadora {
  if (c.tipo === 'pontos') return { ...c, area: 'escala' }
  const { entradas, expressao, unidadeResultado, casasDecimais, teto, piso, faixas, ...resto } = c
  return {
    ...resto,
    area: 'calculadora',
    tipo: 'formula',
    campos: entradas.map((e) => ({ id: e.id, tipo: 'numero', variavel: e.variavel, rotulo: e.rotulo, unidade: e.unidade, min: e.min, max: e.max })),
    saidas: [{ id: `${c.id}-saida`, nome: 'Resultado', expressao, unidade: unidadeResultado, casasDecimais, teto, piso, faixas }],
  }
}
