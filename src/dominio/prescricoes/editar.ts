import type { Alerta, Alternativa, DadosNovos, ItemPrescricao, Prescricao, RegraDose, UUID } from '@/dominio/tipos'
import { ordenarPorCondicao } from './condicoes'
import { validarMarcadores } from '@/dominio/dose/marcadores'
import { validarRegraDose } from '@/dominio/dose/validarRegra'

export type DadosPrescricao = DadosNovos<Prescricao>
type GerarId = () => UUID

const idPadrao: GerarId = () => crypto.randomUUID()

export function prescricaoVazia(gerarId: GerarId = idPadrao): DadosPrescricao {
  return {
    titulo: '',
    categoriaId: null,
    tags: [],
    itens: [itemVazio(gerarId)],
    condicoes: [],
    alertas: [],
    receita: '',
    observacoes: '',
    referencia: '',
    favorito: false,
    origem: 'manual',
    revisada: true,
    duvidasImportacao: [],
  }
}

export function itemVazio(gerarId: GerarId = idPadrao, condicaoId: UUID | null = null): ItemPrescricao {
  return { id: gerarId(), texto: '', regraDose: null, alternativas: [], condicaoId }
}

export function alternativaVazia(gerarId: GerarId = idPadrao): Alternativa {
  return { id: gerarId(), motivo: '', texto: '', regraDose: null }
}

/** Regra nova: campos numéricos vazios (NaN) para o usuário preencher; dose sempre inteira. */
export function regraDoseVazia(): RegraDose {
  return {
    dosePorKg: Number.NaN,
    unidade: '',
    baseDoseKg: 'por_tomada',
    tomadasPorDia: null,
    doseMaximaPorTomada: null,
    doseMaximaDiaria: null,
    pesoLimite: null,
    concentracao: null,
    arredondamentoDose: { modo: 'inteiro' },
    arredondamentoVolume: { modo: 'casas_decimais', casas: 1 },
  }
}

export function alertaVazio(gerarId: GerarId = idPadrao): Alerta {
  return { id: gerarId(), tipo: 'atencao', gravidade: 'atencao', texto: '', itemId: null }
}

/** Cópia profunda sem os campos de entidade (para editar sem mexer no original). */
export function paraDados(p: Prescricao): DadosPrescricao {
  const { id: _id, criadoEm: _c, atualizadoEm: _a, excluidoEm: _e, ...dados } = p
  // Cópia via JSON (os dados são JSON puro): structuredClone falha com os proxies reativos do Vue.
  const copia = JSON.parse(JSON.stringify(dados)) as DadosPrescricao
  // O editor mostra os itens agrupados ("Sempre" primeiro, depois cada condição).
  copia.itens = ordenarPorCondicao(copia.itens, copia.condicoes)
  return copia
}

/**
 * Duplica com IDs novos em itens, alternativas, condições e alertas (mantendo os vínculos alerta→item e item→condição).
 * Título recebe "(cópia)", sai sem favorito; origem e status de revisão são mantidos,
 * para uma cópia de importação não revisada continuar não revisada.
 */
export function duplicarPrescricao(p: Prescricao, gerarId: GerarId = idPadrao): DadosPrescricao {
  const dados = paraDados(p)
  const novoIdItem = new Map<UUID, UUID>()
  const novoIdCondicao = new Map<UUID, UUID>()

  dados.condicoes = dados.condicoes.map((c) => {
    const id = gerarId()
    novoIdCondicao.set(c.id, id)
    return { ...c, id }
  })
  dados.itens = dados.itens.map((item) => {
    const id = gerarId()
    novoIdItem.set(item.id, id)
    return {
      ...item,
      id,
      alternativas: item.alternativas.map((alt) => ({ ...alt, id: gerarId() })),
      condicaoId: item.condicaoId ? (novoIdCondicao.get(item.condicaoId) ?? null) : null,
    }
  })
  dados.alertas = dados.alertas.map((alerta) => ({
    ...alerta,
    id: gerarId(),
    itemId: alerta.itemId ? (novoIdItem.get(alerta.itemId) ?? null) : null,
  }))
  dados.titulo = `${p.titulo} (cópia)`
  dados.favorito = false
  return dados
}

/** Move um item uma posição para cima (-1) ou para baixo (+1). */
export function moverItem<T>(lista: T[], indice: number, direcao: -1 | 1): T[] {
  const destino = indice + direcao
  if (destino < 0 || destino >= lista.length) return lista
  const copia = [...lista]
  ;[copia[indice], copia[destino]] = [copia[destino]!, copia[indice]!]
  return copia
}

/** Remove um item; alertas ligados a ele passam a valer para a prescrição inteira. */
export function removerItem(dados: DadosPrescricao, itemId: UUID): DadosPrescricao {
  return {
    ...dados,
    itens: dados.itens.filter((i) => i.id !== itemId),
    alertas: dados.alertas.map((a) => (a.itemId === itemId ? { ...a, itemId: null } : a)),
  }
}

/** Remove uma condição; os itens dela passam a valer "Sempre" (e vão para o grupo "Sempre"). */
export function removerCondicao(dados: DadosPrescricao, condicaoId: UUID): DadosPrescricao {
  const condicoes = dados.condicoes.filter((c) => c.id !== condicaoId)
  return {
    ...dados,
    condicoes,
    itens: ordenarPorCondicao(
      dados.itens.map((i) => (i.condicaoId === condicaoId ? { ...i, condicaoId: null } : i)),
      condicoes,
    ),
  }
}

/** Separa tags digitadas por vírgula, sem vazias nem repetidas (ignorando maiúsculas). */
export function normalizarTags(tags: string[]): string[] {
  const vistas = new Set<string>()
  const resultado: string[] = []
  for (const bruta of tags.flatMap((t) => t.split(','))) {
    const tag = bruta.trim()
    const chave = tag.toLocaleLowerCase('pt-BR')
    if (tag && !vistas.has(chave)) {
      vistas.add(chave)
      resultado.push(tag)
    }
  }
  return resultado
}

/** Erros que impedem salvar. Lista vazia = válido. */
/**
 * `aceitarSemCategoria`: na revisão de importação por IA, sem categoria correspondente
 * a prescrição pode ser salva como "Sem categoria" (decisão do usuário).
 */
export function validarPrescricao(
  dados: DadosPrescricao,
  categoriaExiste: (id: UUID) => boolean,
  opcoes: { aceitarSemCategoria?: boolean } = {},
): string[] {
  const erros: string[] = []
  if (!dados.titulo.trim()) erros.push('Informe o título.')
  const semCategoriaOk = opcoes.aceitarSemCategoria && dados.categoriaId === null
  if (!semCategoriaOk && (!dados.categoriaId || !categoriaExiste(dados.categoriaId))) erros.push('Escolha o grupo.')
  if (dados.itens.length === 0) erros.push('Inclua pelo menos 1 item.')

  const validarDose = (prefixo: string, texto: string, regra: RegraDose | null) => {
    if (regra) for (const e of validarRegraDose(regra)) erros.push(`${prefixo}, regra de dose: ${e}`)
    for (const e of validarMarcadores(texto, regra)) erros.push(`${prefixo}: ${e}`)
  }

  dados.itens.forEach((item, i) => {
    if (!item.texto.trim()) erros.push(`Item ${i + 1}: texto vazio.`)
    if (item.opcoesEquivalentes && item.alternativas.length === 0) {
      erros.push(`Item ${i + 1}: opções equivalentes precisam de pelo menos 2 opções.`)
    }
    validarDose(`Item ${i + 1}`, item.texto, item.regraDose)
    item.alternativas.forEach((alt, j) => {
      const prefixo = `Item ${i + 1}, alternativa ${j + 1}`
      if (!alt.texto.trim()) erros.push(`${prefixo}: texto vazio.`)
      // Em opções equivalentes (OU) o motivo é opcional.
      if (!item.opcoesEquivalentes && !alt.motivo.trim()) erros.push(`${prefixo}: informe o motivo.`)
      validarDose(prefixo, alt.texto, alt.regraDose)
    })
  })
  dados.alertas.forEach((alerta, i) => {
    if (!alerta.texto.trim()) erros.push(`Alerta ${i + 1}: texto vazio.`)
  })
  dados.condicoes.forEach((c, i) => {
    if (!c.nome.trim()) erros.push(`Condição ${i + 1}: informe o nome.`)
  })
  return erros
}
