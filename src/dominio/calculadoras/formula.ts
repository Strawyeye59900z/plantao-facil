import {
  absDependencies,
  addDependencies,
  ceilDependencies,
  create,
  divideDependencies,
  expDependencies,
  floorDependencies,
  log10Dependencies,
  logDependencies,
  maxDependencies,
  minDependencies,
  multiplyDependencies,
  parseDependencies,
  powDependencies,
  roundDependencies,
  sqrtDependencies,
  subtractDependencies,
  unaryMinusDependencies,
  unaryPlusDependencies,
  type MathNode,
} from 'mathjs/number'
import type { CalculadoraFormula, SaidaFormula } from '@/dominio/tipos'
import { formatarNumero, limpar } from '@/dominio/dose/numeros'

/**
 * Avaliador de fórmulas (nunca eval/new Function):
 * instância mínima do mathjs (só números e as funções abaixo) + a árvore da expressão
 * é conferida contra uma lista fechada antes de compilar.
 */
const math = create({
  parseDependencies,
  addDependencies,
  subtractDependencies,
  multiplyDependencies,
  divideDependencies,
  powDependencies,
  unaryMinusDependencies,
  unaryPlusDependencies,
  sqrtDependencies,
  logDependencies,
  log10Dependencies,
  expDependencies,
  absDependencies,
  minDependencies,
  maxDependencies,
  roundDependencies,
  floorDependencies,
  ceilDependencies,
})

export const FUNCOES_PERMITIDAS = ['sqrt', 'log', 'log10', 'exp', 'abs', 'min', 'max', 'round', 'floor', 'ceil'] as const
const OPERADORES_PERMITIDOS = new Set(['add', 'subtract', 'multiply', 'divide', 'pow', 'unaryMinus', 'unaryPlus'])

/** Nome de variável: letra ou _, depois letras, números ou _ (sem acento). */
export const PADRAO_VARIAVEL = /^[A-Za-z_][A-Za-z0-9_]*$/

export type AnaliseExpressao =
  | { ok: true; avaliar: (escopo: Record<string, number>) => unknown; usadas: Set<string> }
  | { ok: false; erro: string }

export function analisarExpressao(expressao: string, variaveis: string[]): AnaliseExpressao {
  if (!expressao.trim()) return { ok: false, erro: 'Escreva a expressão.' }
  let raiz: MathNode
  try {
    raiz = math.parse(expressao)
  } catch (e) {
    return { ok: false, erro: `Expressão inválida: ${e instanceof Error ? e.message : String(e)}` }
  }

  const declaradas = new Set(variaveis)
  const funcoes = new Set<string>(FUNCOES_PERMITIDAS)
  const usadas = new Set<string>()
  let erro: string | null = null

  raiz.traverse((no, _caminho, pai) => {
    if (erro) return
    switch (no.type) {
      case 'ConstantNode': {
        const valor = (no as unknown as { value: unknown }).value
        if (typeof valor !== 'number' || !Number.isFinite(valor)) erro = 'Só números são permitidos como constantes.'
        break
      }
      case 'ParenthesisNode':
        break
      case 'OperatorNode': {
        const fn = (no as unknown as { fn: string; op: string }).fn
        if (!OPERADORES_PERMITIDOS.has(fn)) erro = `Operador não permitido: ${(no as unknown as { op: string }).op}`
        break
      }
      case 'FunctionNode': {
        const fn = (no as unknown as { fn: MathNode }).fn
        const nome = fn.type === 'SymbolNode' ? (fn as unknown as { name: string }).name : ''
        if (!funcoes.has(nome)) erro = `Função não permitida: ${nome || fn.toString()}`
        break
      }
      case 'SymbolNode': {
        const nome = (no as unknown as { name: string }).name
        const ehNomeDeFuncao =
          pai?.type === 'FunctionNode' && (pai as unknown as { fn: MathNode }).fn === no
        if (ehNomeDeFuncao) break
        if (!declaradas.has(nome)) erro = `Variável desconhecida: ${nome}`
        else usadas.add(nome)
        break
      }
      default:
        erro = `Construção não permitida na expressão (${no.type}).`
    }
  })
  if (erro) return { ok: false, erro }

  const compilada = raiz.compile()
  return { ok: true, avaliar: (escopo) => compilada.evaluate({ ...escopo }), usadas }
}

// ===== Cálculo =====

export type ResultadoFormula =
  | { estado: 'incompleto'; faltam: string[] }
  | { estado: 'erro'; erro: string }
  | {
      estado: 'ok'
      valor: number
      /** Valor antes de casas decimais e teto/piso. */
      bruto: number
      aviso: 'teto' | 'piso' | null
    }

/**
 * Calcula uma saída da fórmula com os campos preenchidos (null = vazio; sim/não já convertido em número).
 * Adaptação mínima ao modelo v2; será reescrita na Task 11.
 * Ordem: valida campos → avalia → arredonda (casas decimais) → teto/piso por último.
 */
export function calcularFormula(
  calc: CalculadoraFormula,
  valores: Record<string, number | null>,
  saida: SaidaFormula = calc.saidas[0]!,
): ResultadoFormula {
  const faltam = calc.campos.filter((c) => valores[c.id] === null || valores[c.id] === undefined)
  for (const c of calc.campos) {
    const v = valores[c.id]
    if (v === null || v === undefined) continue
    if (!Number.isFinite(v)) return { estado: 'erro', erro: `${c.rotulo}: valor inválido.` }
    if (c.tipo === 'numero' && ((c.min !== null && v < c.min) || (c.max !== null && v > c.max))) {
      const intervalo =
        c.min !== null && c.max !== null
          ? `entre ${formatarNumero(c.min)} e ${formatarNumero(c.max)}`
          : c.min !== null
            ? `a partir de ${formatarNumero(c.min)}`
            : `até ${formatarNumero(c.max!)}`
      return { estado: 'erro', erro: `${c.rotulo}: use um valor ${intervalo} ${c.unidade}`.trim() + '.' }
    }
  }
  if (faltam.length) return { estado: 'incompleto', faltam: faltam.map((c) => c.rotulo) }

  const analise = analisarExpressao(saida.expressao, calc.campos.map((c) => c.variavel))
  if (!analise.ok) return { estado: 'erro', erro: analise.erro }

  let bruto: unknown
  try {
    bruto = analise.avaliar(Object.fromEntries(calc.campos.map((c) => [c.variavel, valores[c.id]!])))
  } catch (e) {
    return { estado: 'erro', erro: `Não foi possível calcular: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (typeof bruto !== 'number' || !Number.isFinite(bruto)) {
    return { estado: 'erro', erro: 'Resultado inválido (ex.: divisão por zero ou raiz de número negativo).' }
  }

  const fator = 10 ** saida.casasDecimais
  let valor = limpar(Math.round(limpar(bruto * fator)) / fator)
  let aviso: 'teto' | 'piso' | null = null
  if (saida.teto !== null && valor > saida.teto) {
    valor = saida.teto
    aviso = 'teto'
  }
  if (saida.piso !== null && valor < saida.piso) {
    valor = saida.piso
    aviso = 'piso'
  }
  return { estado: 'ok', valor, bruto, aviso }
}
