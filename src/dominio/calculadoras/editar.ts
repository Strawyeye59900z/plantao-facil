import type {
  AreaCalculadora,
  Calculadora,
  CalculadoraDosePeso,
  CalculadoraFormula,
  CalculadoraPontos,
  CampoFormula,
  CampoPontos,
  FaixaInterpretacao,
  FaixaPontos,
  LinhaDosePeso,
  OpcaoSelecao,
  RegraDosePeso,
  SaidaFormula,
  UUID,
} from '@/dominio/tipos'
import { analisarExpressao, PADRAO_VARIAVEL } from './formula'
import { analisarFaixas } from './interpretacao'
import { casasDosPontos, intervaloPossivel } from './pontos'

type SemEntidade<T> = Omit<T, 'id' | 'criadoEm' | 'atualizadoEm' | 'excluidoEm'>
export type DadosCalculadora = SemEntidade<CalculadoraDosePeso> | SemEntidade<CalculadoraFormula> | SemEntidade<CalculadoraPontos>
type GerarId = () => UUID
const idPadrao: GerarId = () => crypto.randomUUID()

const base = { nome: '', categoriaId: null, descricao: '', referencia: '', favorito: false }

/** Marcadores `{nome}` do texto de uma linha de dose por peso, sem repetir, na ordem em que aparecem. */
export function marcadoresDoTexto(texto: string): string[] {
  const achados = [...texto.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]!)
  return [...new Set(achados)]
}

/**
 * Calculadora nova. `area` só vale para `formula`; `pontos` é sempre 'escala' e `dose_peso`
 * é sempre 'calculadora' (o argumento é ignorado nesses tipos).
 */
export function calculadoraVazia(area: AreaCalculadora, tipo: Calculadora['tipo'], gerarId: GerarId = idPadrao): DadosCalculadora {
  if (tipo === 'pontos') return { ...base, area: 'escala', tipo, campos: [campoVazio('sim_nao', gerarId)], faixas: [] }
  if (tipo === 'dose_peso') return { ...base, area: 'calculadora', tipo, linhas: [linhaDosePesoVazia(gerarId)] }
  return { ...base, area, tipo, campos: [campoFormulaVazio('numero', gerarId)], saidas: [saidaVazia(gerarId)] }
}

export function linhaDosePesoVazia(gerarId: GerarId = idPadrao): LinhaDosePeso {
  return { id: gerarId(), texto: '', regras: [] }
}

export function regraDosePesoVazia(marcador: string, gerarId: GerarId = idPadrao): RegraDosePeso {
  return { id: gerarId(), marcador, dosePorKg: Number.NaN, unidade: '', concentracao: null, doseMaxima: null, casasDecimais: 1 }
}

/** Marcadores que o motor substitui (`{nome}` só com letras sem acento, números e _), sem repetir, na ordem do texto. */
export function marcadoresCalculaveis(texto: string): string[] {
  return [...new Set([...texto.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]!))]
}

/** Marcadores `{…}` do texto que o motor não substitui (nome com acento, espaço, vazio…). */
export function marcadoresInvalidos(texto: string): string[] {
  return marcadoresDoTexto(texto).filter((m) => !/^[A-Za-z0-9_]+$/.test(m))
}

/** Por que um marcador não é calculado (validação e dica do editor). */
export const MSG_NOME_MARCADOR = 'o nome do marcador só pode ter letras sem acento, números e _.'

/** Regra ainda como nasceu (nada preenchido): pode sumir junto com o marcador sem perder trabalho do usuário. */
function regraIntocada(r: RegraDosePeso): boolean {
  const vazia = regraDosePesoVazia(r.marcador, () => r.id)
  return (Object.keys(vazia) as (keyof RegraDosePeso)[]).every((k) => Object.is(r[k], vazia[k]))
}

export interface Sincronizacao {
  regras: RegraDosePeso[]
  /** Regra preenchida que passou para um marcador renomeado (o editor avisa); null se nenhuma. */
  renomeada: { regraId: UUID; de: string; para: string } | null
}

/**
 * Regras de uma linha depois de o texto mudar de `textoAnterior` para `texto`:
 * - marcador novo ganha regra vazia (no fim da lista);
 * - numa mesma edição em que sai um marcador e entra outro (renomear, ex.: {inducao} → {inducao2}),
 *   a regra acompanha o nome novo (se estiver preenchida, volta em `renomeada`);
 * - marcador que sumiu: a regra preenchida fica (a validação acusa); a intocada é descartada.
 */
export function sincronizarRegras(
  texto: string,
  textoAnterior: string,
  regras: RegraDosePeso[],
  gerarId: GerarId = idPadrao,
): Sincronizacao {
  const atuais = marcadoresCalculaveis(texto)
  const anteriores = marcadoresCalculaveis(textoAnterior)
  const saiu = anteriores.filter((m) => !atuais.includes(m))
  const entrou = atuais.filter((m) => !anteriores.includes(m))
  const temRegra = (m: string, lista: RegraDosePeso[]) => lista.some((r) => r.marcador === m)

  let resultado = regras
  let renomeada: Sincronizacao['renomeada'] = null
  const de = saiu[0]
  const para = entrou[0]
  if (saiu.length === 1 && entrou.length === 1 && de && para && temRegra(de, regras) && !temRegra(para, regras)) {
    resultado = regras.map((r) => {
      if (r.marcador !== de) return r
      if (!regraIntocada(r)) renomeada = { regraId: r.id, de, para }
      return { ...r, marcador: para }
    })
  }
  resultado = resultado.filter((r) => atuais.includes(r.marcador) || !regraIntocada(r))
  for (const m of atuais) if (!temRegra(m, resultado)) resultado = [...resultado, regraDosePesoVazia(m, gerarId)]
  return { regras: resultado, renomeada }
}

export function campoFormulaVazio(tipo: CampoFormula['tipo'], gerarId: GerarId = idPadrao): CampoFormula {
  return tipo === 'numero'
    ? { id: gerarId(), tipo, variavel: '', rotulo: '', unidade: '', min: null, max: null }
    : { id: gerarId(), tipo, variavel: '', rotulo: '', valorSim: 1, valorNao: 0 }
}

export function saidaVazia(gerarId: GerarId = idPadrao): SaidaFormula {
  return { id: gerarId(), nome: '', expressao: '', unidade: '', casasDecimais: 1, teto: null, piso: null, faixas: [] }
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
  const novasFaixas = (faixas: FaixaInterpretacao[]) => faixas.map((f) => ({ ...f, id: gerarId() }))
  if (dados.tipo === 'pontos') {
    dados.faixas = novasFaixas(dados.faixas)
    dados.campos = dados.campos.map((campo): CampoPontos => {
      if (campo.tipo === 'selecao') return { ...campo, id: gerarId(), opcoes: campo.opcoes.map((o) => ({ ...o, id: gerarId() })) }
      if (campo.tipo === 'numero') return { ...campo, id: gerarId(), faixas: campo.faixas.map((f) => ({ ...f, id: gerarId() })) }
      return { ...campo, id: gerarId() }
    })
  } else if (dados.tipo === 'dose_peso') {
    dados.linhas = dados.linhas.map((l) => ({ ...l, id: gerarId(), regras: l.regras.map((r) => ({ ...r, id: gerarId() })) }))
  } else {
    dados.campos = dados.campos.map((campo) => ({ ...campo, id: gerarId() }))
    dados.saidas = dados.saidas.map((saida) => ({ ...saida, id: gerarId(), faixas: novasFaixas(saida.faixas) }))
  }
  return dados
}

const finito = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const opcionalOk = (x: number | null) => x === null || finito(x)

const MSG_VARIAVEL = 'variável deve começar com letra e ter só letras, números ou _ (sem acento).'
const casasOk = (n: number) => Number.isInteger(n) && n >= 0 && n <= 6

function errosPontos(d: SemEntidade<CalculadoraPontos>): string[] {
  const erros: string[] = []
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
  erros.push(...errosInterpretacao(d.faixas, 'Interpretação'))
  return erros
}

function errosInterpretacao(faixas: FaixaInterpretacao[], prefixo: string): string[] {
  const erros: string[] = []
  faixas.forEach((f, i) => {
    if (!opcionalOk(f.de) || !opcionalOk(f.ate)) erros.push(`${prefixo} ${i + 1}: valor inválido.`)
    if (!f.texto.trim()) erros.push(`${prefixo} ${i + 1}: informe o texto.`)
  })
  erros.push(...analisarFaixas(faixas, 0).erros.map((e) => `${prefixo}: ${e}`))
  return erros
}

function errosDosePeso(d: SemEntidade<CalculadoraDosePeso>): string[] {
  const erros: string[] = []
  if (d.linhas.length === 0) erros.push('Inclua pelo menos 1 linha.')
  d.linhas.forEach((l, i) => {
    const n = i + 1
    if (!l.texto.trim()) erros.push(`Linha ${n}: informe o texto.`)
    const usados = marcadoresDoTexto(l.texto)
    const definidos = new Set<string>()
    const invalidos = marcadoresInvalidos(l.texto)
    for (const m of usados) {
      if (invalidos.includes(m)) erros.push(`A linha ${n} usa {${m}}: ${MSG_NOME_MARCADOR}`)
      else if (!l.regras.some((r) => r.marcador === m)) erros.push(`A linha ${n} usa {${m}}, que não tem regra.`)
    }
    for (const r of l.regras) {
      if (definidos.has(r.marcador)) erros.push(`Linha ${n}: regra {${r.marcador}} repetida.`)
      definidos.add(r.marcador)
      if (!usados.includes(r.marcador)) erros.push(`A regra {${r.marcador}} não é usada em nenhuma linha.`)
      const p = `Linha ${n}, regra {${r.marcador}}`
      if (!PADRAO_VARIAVEL.test(r.marcador)) erros.push(`${p}: marcador deve começar com letra e ter só letras, números ou _ (sem acento).`)
      if (!finito(r.dosePorKg) || r.dosePorKg <= 0) erros.push(`${p}: informe a dose por kg (maior que zero).`)
      if (!r.unidade.trim()) erros.push(`${p}: informe a unidade.`)
      if (r.concentracao !== null && !(finito(r.concentracao) && r.concentracao > 0)) erros.push(`${p}: a concentração deve ser maior que zero.`)
      if (r.doseMaxima !== null && !(finito(r.doseMaxima) && r.doseMaxima > 0)) erros.push(`${p}: a dose máxima deve ser maior que zero.`)
      if (!casasOk(r.casasDecimais)) erros.push(`${p}: casas decimais de 0 a 6.`)
    }
  })
  return erros
}

function errosFormula(d: SemEntidade<CalculadoraFormula>): string[] {
  const erros: string[] = []
  if (d.campos.length === 0) erros.push('Inclua pelo menos 1 campo.')
  if (d.saidas.length === 0) erros.push('Inclua pelo menos 1 saída.')
  const nomes = new Set<string>()
  d.campos.forEach((c, i) => {
    const p = `Campo ${i + 1}`
    if (!PADRAO_VARIAVEL.test(c.variavel)) erros.push(`${p}: ${MSG_VARIAVEL}`)
    else if (nomes.has(c.variavel)) erros.push(`Variável repetida: ${c.variavel}.`)
    nomes.add(c.variavel)
    if (!c.rotulo.trim()) erros.push(`${p}: informe o texto.`)
    if (c.tipo === 'numero') {
      if (!opcionalOk(c.min) || !opcionalOk(c.max)) erros.push(`${p}: mínimo/máximo inválido.`)
      else if (c.min !== null && c.max !== null && c.min >= c.max) erros.push(`${p}: o mínimo deve ser menor que o máximo.`)
    } else if (!finito(c.valorSim) || !finito(c.valorNao)) {
      erros.push(`${p}: informe os valores de "sim" e "não".`)
    }
  })
  const variaveis = d.campos.map((c) => c.variavel)
  d.saidas.forEach((saida, i) => {
    const p = `Saída ${i + 1}`
    if (!saida.nome.trim()) erros.push(`${p}: informe o nome.`)
    const analise = analisarExpressao(saida.expressao, variaveis)
    if (!analise.ok) erros.push(`${p}: ${analise.erro}`)
    if (!casasOk(saida.casasDecimais)) erros.push(`${p}: casas decimais de 0 a 6.`)
    if (!opcionalOk(saida.teto) || !opcionalOk(saida.piso)) erros.push(`${p}: teto/piso inválido.`)
    if (finito(saida.teto) && finito(saida.piso) && saida.piso > saida.teto) erros.push(`${p}: o piso deve ser menor que o teto.`)
    erros.push(...errosInterpretacao(saida.faixas, `${p}, interpretação`))
  })
  return erros
}

/** Erros que impedem salvar. */
export function validarCalculadora(d: DadosCalculadora, categoriaExiste: (id: UUID) => boolean): string[] {
  const erros: string[] = []
  if (!d.nome.trim()) erros.push('Informe o nome.')
  if (!d.categoriaId || !categoriaExiste(d.categoriaId)) erros.push('Escolha o grupo.')
  if (d.tipo === 'dose_peso' && d.area !== 'calculadora') erros.push('Dose por peso só existe em calculadoras.')
  if (d.tipo === 'pontos' && d.area !== 'escala') erros.push('Pontos só existe em escalas.')

  if (d.tipo === 'pontos') erros.push(...errosPontos(d))
  else if (d.tipo === 'dose_peso') erros.push(...errosDosePeso(d))
  else erros.push(...errosFormula(d))
  return erros
}

/** Avisos que não impedem salvar: faixas sobrepostas ou com lacunas, variáveis não usadas. */
export function avisosCalculadora(d: DadosCalculadora): string[] {
  const avisos: string[] = []
  const validas = (faixas: FaixaInterpretacao[]) => faixas.filter((f) => opcionalOk(f.de) && opcionalOk(f.ate))
  if (d.tipo === 'pontos') {
    const calc = d as CalculadoraPontos
    avisos.push(...analisarFaixas(validas(d.faixas), casasDosPontos(calc), intervaloPossivel(calc)).avisos.map((a) => `Interpretação: ${a}`))
    d.campos.forEach((c, i) => {
      if (c.tipo === 'numero') {
        const faixasOk = c.faixas.filter((f) => opcionalOk(f.de) && opcionalOk(f.ate))
        avisos.push(...analisarFaixas(faixasOk, casasEntrada(c.faixas)).avisos.map((a) => `Campo ${i + 1}: ${a}`))
      }
    })
  } else if (d.tipo === 'formula') {
    const variaveis = d.campos.map((c) => c.variavel)
    const usadas = new Set<string>()
    d.saidas.forEach((saida, i) => {
      const avisosSaida = analisarFaixas(validas(saida.faixas), saida.casasDecimais).avisos
      avisos.push(...avisosSaida.map((a) => `Saída ${i + 1}, interpretação: ${a}`))
      const analise = analisarExpressao(saida.expressao, variaveis)
      if (analise.ok) analise.usadas.forEach((u) => usadas.add(u))
    })
    for (const v of variaveis) if (v && !usadas.has(v)) avisos.push(`A variável "${v}" não é usada em nenhuma saída.`)
  }
  return avisos
}

/** Casas decimais usadas nos limites das faixas de um campo numérico (para o passo das lacunas). */
function casasEntrada(faixas: FaixaPontos[]): number {
  const valores = faixas.flatMap((f) => [f.de, f.ate]).filter(finito)
  return Math.max(0, ...valores.map((v) => (String(v).split('.')[1] ?? '').length))
}
