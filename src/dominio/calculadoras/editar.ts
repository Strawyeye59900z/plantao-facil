import type {
  Calculadora,
  CalculadoraFormula,
  CalculadoraPontos,
  CampoPontos,
  DadosNovos,
  EntradaFormula,
  FaixaInterpretacao,
  FaixaPontos,
  OpcaoSelecao,
  UUID,
} from '@/dominio/tipos'
import { analisarExpressao, PADRAO_VARIAVEL } from './formula'
import { analisarFaixas } from './interpretacao'
import { casasDosPontos, intervaloPossivel } from './pontos'

export type DadosCalculadora = DadosNovos<CalculadoraPontos> | DadosNovos<CalculadoraFormula>
type GerarId = () => UUID
const idPadrao: GerarId = () => crypto.randomUUID()

const base = { nome: '', categoriaId: null, descricao: '', referencia: '', faixas: [], favorito: false }

export function calculadoraVazia(tipo: Calculadora['tipo'], gerarId: GerarId = idPadrao): DadosCalculadora {
  return tipo === 'pontos'
    ? { ...base, tipo, campos: [campoVazio('sim_nao', gerarId)] }
    : {
        ...base,
        tipo,
        entradas: [entradaVazia(gerarId)],
        expressao: '',
        unidadeResultado: '',
        casasDecimais: 1,
        teto: null,
        piso: null,
      }
}

export function campoVazio(tipo: CampoPontos['tipo'], gerarId: GerarId = idPadrao): CampoPontos {
  switch (tipo) {
    case 'sim_nao':
      return { id: gerarId(), tipo, rotulo: '', pontosSim: Number.NaN, pontosNao: Number.NaN }
    case 'selecao':
      return { id: gerarId(), tipo, rotulo: '', opcoes: [opcaoVazia(gerarId), opcaoVazia(gerarId)] }
    case 'numero':
      return { id: gerarId(), tipo, rotulo: '', unidade: '', min: null, max: null, faixas: [faixaPontosVazia(gerarId)] }
  }
}

export function opcaoVazia(gerarId: GerarId = idPadrao): OpcaoSelecao {
  return { id: gerarId(), rotulo: '', pontos: Number.NaN }
}

export function faixaPontosVazia(gerarId: GerarId = idPadrao): FaixaPontos {
  return { id: gerarId(), de: null, ate: null, pontos: Number.NaN }
}

export function entradaVazia(gerarId: GerarId = idPadrao): EntradaFormula {
  return { id: gerarId(), variavel: '', rotulo: '', unidade: '', min: Number.NaN, max: Number.NaN }
}

export function faixaInterpretacaoVazia(gerarId: GerarId = idPadrao): FaixaInterpretacao {
  return { id: gerarId(), de: null, ate: null, texto: '', gravidade: 'informativo' }
}

export function paraDadosCalculadora(c: Calculadora): DadosCalculadora {
  const { id: _i, criadoEm: _c, atualizadoEm: _a, excluidoEm: _e, ...dados } = c
  // Cópia via JSON: structuredClone falha com os proxies reativos do Vue.
  return JSON.parse(JSON.stringify(dados)) as DadosCalculadora
}

/** Cópia com "(cópia)", sem favorito e IDs novos em todas as partes. */
export function duplicarCalculadora(c: Calculadora, gerarId: GerarId = idPadrao): DadosCalculadora {
  const dados = paraDadosCalculadora(c)
  dados.nome = `${c.nome} (cópia)`
  dados.favorito = false
  dados.faixas = dados.faixas.map((f) => ({ ...f, id: gerarId() }))
  if (dados.tipo === 'pontos') {
    dados.campos = dados.campos.map((campo): CampoPontos => {
      if (campo.tipo === 'selecao') return { ...campo, id: gerarId(), opcoes: campo.opcoes.map((o) => ({ ...o, id: gerarId() })) }
      if (campo.tipo === 'numero') return { ...campo, id: gerarId(), faixas: campo.faixas.map((f) => ({ ...f, id: gerarId() })) }
      return { ...campo, id: gerarId() }
    })
  } else {
    dados.entradas = dados.entradas.map((e) => ({ ...e, id: gerarId() }))
  }
  return dados
}

const finito = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const opcionalOk = (x: number | null) => x === null || finito(x)

/** Erros que impedem salvar. */
export function validarCalculadora(d: DadosCalculadora, categoriaExiste: (id: UUID) => boolean): string[] {
  const erros: string[] = []
  if (!d.nome.trim()) erros.push('Informe o nome.')
  if (!d.categoriaId || !categoriaExiste(d.categoriaId)) erros.push('Escolha a categoria.')

  if (d.tipo === 'pontos') {
    if (d.campos.length === 0) erros.push('Inclua pelo menos 1 campo.')
    d.campos.forEach((c, i) => {
      const p = `Campo ${i + 1}`
      if (!c.rotulo.trim()) erros.push(`${p}: informe o texto.`)
      if (c.tipo === 'sim_nao' && (!finito(c.pontosSim) || !finito(c.pontosNao))) erros.push(`${p}: informe os pontos de "sim" e "não".`)
      if (c.tipo === 'selecao') {
        if (c.opcoes.length < 2) erros.push(`${p}: inclua pelo menos 2 opções.`)
        c.opcoes.forEach((o, j) => {
          if (!o.rotulo.trim()) erros.push(`${p}, opção ${j + 1}: informe o texto.`)
          if (!finito(o.pontos)) erros.push(`${p}, opção ${j + 1}: informe os pontos.`)
        })
      }
      if (c.tipo === 'numero') {
        if (!opcionalOk(c.min) || !opcionalOk(c.max)) erros.push(`${p}: mínimo/máximo inválido.`)
        if (finito(c.min) && finito(c.max) && c.min >= c.max) erros.push(`${p}: o mínimo deve ser menor que o máximo.`)
        if (c.faixas.length === 0) erros.push(`${p}: inclua pelo menos 1 faixa de pontos.`)
        c.faixas.forEach((f, j) => {
          if (!opcionalOk(f.de) || !opcionalOk(f.ate)) erros.push(`${p}, faixa ${j + 1}: valor inválido.`)
          if (!finito(f.pontos)) erros.push(`${p}, faixa ${j + 1}: informe os pontos.`)
        })
        erros.push(...analisarFaixas(c.faixas, 0).erros.map((e) => `${p}: ${e}`))
      }
    })
  } else {
    if (d.entradas.length === 0) erros.push('Inclua pelo menos 1 entrada.')
    const nomes = new Set<string>()
    d.entradas.forEach((e, i) => {
      const p = `Entrada ${i + 1}`
      if (!PADRAO_VARIAVEL.test(e.variavel)) erros.push(`${p}: variável deve começar com letra e ter só letras, números ou _ (sem acento).`)
      else if (nomes.has(e.variavel)) erros.push(`${p}: variável "${e.variavel}" repetida.`)
      nomes.add(e.variavel)
      if (!e.rotulo.trim()) erros.push(`${p}: informe o rótulo.`)
      if (!finito(e.min) || !finito(e.max)) erros.push(`${p}: informe mínimo e máximo.`)
      else if (e.min >= e.max) erros.push(`${p}: o mínimo deve ser menor que o máximo.`)
    })
    const analise = analisarExpressao(d.expressao, d.entradas.map((e) => e.variavel))
    if (!analise.ok) erros.push(analise.erro)
    if (!(Number.isInteger(d.casasDecimais) && d.casasDecimais >= 0 && d.casasDecimais <= 6)) erros.push('Casas decimais: de 0 a 6.')
    if (!opcionalOk(d.teto) || !opcionalOk(d.piso)) erros.push('Teto/piso inválido.')
    if (finito(d.teto) && finito(d.piso) && d.piso > d.teto) erros.push('O piso deve ser menor que o teto.')
  }

  d.faixas.forEach((f, i) => {
    if (!opcionalOk(f.de) || !opcionalOk(f.ate)) erros.push(`Interpretação ${i + 1}: valor inválido.`)
    if (!f.texto.trim()) erros.push(`Interpretação ${i + 1}: informe o texto.`)
  })
  erros.push(...analisarFaixas(d.faixas, 0).erros.map((e) => `Interpretação: ${e}`))
  return erros
}

/** Avisos que não impedem salvar: faixas sobrepostas ou com lacunas, variáveis não usadas. */
export function avisosCalculadora(d: DadosCalculadora): string[] {
  const avisos: string[] = []
  const faixasValidas = d.faixas.filter((f) => opcionalOk(f.de) && opcionalOk(f.ate))
  if (d.tipo === 'pontos') {
    const calc = d as CalculadoraPontos
    avisos.push(...analisarFaixas(faixasValidas, casasDosPontos(calc), intervaloPossivel(calc)).avisos.map((a) => `Interpretação: ${a}`))
    d.campos.forEach((c, i) => {
      if (c.tipo === 'numero') {
        const validas = c.faixas.filter((f) => opcionalOk(f.de) && opcionalOk(f.ate))
        avisos.push(...analisarFaixas(validas, casasEntrada(c.faixas)).avisos.map((a) => `Campo ${i + 1}: ${a}`))
      }
    })
  } else {
    avisos.push(...analisarFaixas(faixasValidas, d.casasDecimais).avisos.map((a) => `Interpretação: ${a}`))
    const analise = analisarExpressao(d.expressao, d.entradas.map((e) => e.variavel))
    if (analise.ok) {
      for (const e of d.entradas) if (e.variavel && !analise.usadas.has(e.variavel)) avisos.push(`A variável "${e.variavel}" não é usada na expressão.`)
    }
  }
  return avisos
}

/** Casas decimais usadas nos limites das faixas de um campo numérico (para o passo das lacunas). */
function casasEntrada(faixas: FaixaPontos[]): number {
  const valores = faixas.flatMap((f) => [f.de, f.ate]).filter(finito)
  return Math.max(0, ...valores.map((v) => (String(v).split('.')[1] ?? '').length))
}
