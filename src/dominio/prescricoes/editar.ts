import type { Alerta, DadosNovos, ItemPrescricao, OpcaoItem, Prescricao, UUID } from '@/dominio/tipos'
import { condicaoDoItem, ordenarPorCondicao } from './condicoes'

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
    calculadoraIds: [],
    receita: '',
    observacoes: '',
    referencia: '',
    favorito: false,
    origem: 'manual',
    revisada: true,
    duvidasImportacao: [],
  }
}

/** Item novo com uma opção vazia (item simples). */
export function itemVazio(gerarId: GerarId = idPadrao, condicaoId: UUID | null = null): ItemPrescricao {
  return { id: gerarId(), condicaoId, opcoes: [opcaoVazia(gerarId)] }
}

export function opcaoVazia(gerarId: GerarId = idPadrao): OpcaoItem {
  return { id: gerarId(), texto: '', motivo: '' }
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
 * Duplica com IDs novos em itens, opções, condições e alertas (mantendo os vínculos alerta→item e item→condição).
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
      opcoes: item.opcoes.map((opcao) => ({ ...opcao, id: gerarId() })),
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

/** Troca a condição de um item e reagrupa os itens ("Sempre" primeiro, depois cada condição na ordem). */
export function definirCondicaoDoItem(dados: DadosPrescricao, itemId: UUID, condicaoId: UUID | null): DadosPrescricao {
  return {
    ...dados,
    itens: ordenarPorCondicao(
      dados.itens.map((i) => (i.id === itemId ? { ...i, condicaoId } : i)),
      dados.condicoes,
    ),
  }
}

/** Move uma condição uma posição; os grupos de itens acompanham a nova ordem. */
export function moverCondicao(dados: DadosPrescricao, indice: number, direcao: -1 | 1): DadosPrescricao {
  const condicoes = moverItem(dados.condicoes, indice, direcao)
  return { ...dados, condicoes, itens: ordenarPorCondicao(dados.itens, condicoes) }
}

/** ↑/↓ de item só dentro do grupo da condição (para mudar de grupo, troca-se a condição do item). */
export function podeMoverItemNoGrupo(dados: DadosPrescricao, indice: number, direcao: -1 | 1): boolean {
  const atual = dados.itens[indice]
  const vizinho = dados.itens[indice + direcao]
  if (!atual || !vizinho) return false
  return condicaoDoItem(atual, dados.condicoes) === condicaoDoItem(vizinho, dados.condicoes)
}

export function moverItemNoGrupo(dados: DadosPrescricao, indice: number, direcao: -1 | 1): DadosPrescricao {
  if (!podeMoverItemNoGrupo(dados, indice, direcao)) return dados
  return { ...dados, itens: moverItem(dados.itens, indice, direcao) }
}

/** Remove uma opção do item; o item fica sempre com pelo menos 1 (com 1, volta a ser item simples). */
export function removerOpcao(item: ItemPrescricao, opcaoId: UUID): ItemPrescricao {
  if (item.opcoes.length <= 1) return item
  return { ...item, opcoes: item.opcoes.filter((o) => o.id !== opcaoId) }
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

/** Tira de `calculadoraIds` os ids de calculadoras que não existem mais (a lixeira conta como existente). */
export function semCalculadorasInexistentes(dados: DadosPrescricao, existe: (id: UUID) => boolean): DadosPrescricao {
  return { ...dados, calculadoraIds: dados.calculadoraIds.filter(existe) }
}

/** Erros que impedem salvar. Lista vazia = válido. */
/**
 * Ids em `calculadoraIds` de calculadoras que não existem mais são ignorados (não bloqueiam; ver `semCalculadorasInexistentes`).
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

  dados.itens.forEach((item, i) => {
    if (item.opcoes.length === 0) erros.push(`Item ${i + 1}: inclua pelo menos 1 opção.`)
    item.opcoes.forEach((opcao, j) => {
      if (opcao.texto.trim()) return
      erros.push(item.opcoes.length === 1 ? `Item ${i + 1}: texto vazio.` : `Item ${i + 1}, opção ${j + 1}: texto vazio.`)
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
