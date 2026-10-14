import * as v from 'valibot'
import type { ArquivoBackup, Calculadora, Categoria, Entidade, ISODate, Prescricao, UUID } from '@/dominio/tipos'
import { normalizarTexto } from '@/dominio/texto/normalizar'
import { esquemaArquivoBackup, FORMATO_BACKUP, VERSAO_FORMATO_ATUAL } from './esquema'

export interface Biblioteca {
  prescricoes: Prescricao[]
  calculadoras: Calculadora[]
  categorias: Categoria[]
}

// ===== Exportar =====

export function montarBackup(b: Biblioteca, exportadoEm: ISODate, versaoApp: string): ArquivoBackup {
  return {
    formato: FORMATO_BACKUP,
    versaoFormato: VERSAO_FORMATO_ATUAL,
    exportadoEm,
    versaoApp,
    prescricoes: b.prescricoes,
    calculadoras: b.calculadoras,
    categorias: b.categorias,
  }
}

/** plantao-facil-backup-2026-10-14-1530.json (hora local). */
export function nomeArquivoBackup(data: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `plantao-facil-backup-${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}-${p(data.getHours())}${p(data.getMinutes())}.json`
}

// ===== Ler / validar =====

export type LeituraBackup = { ok: true; backup: ArquivoBackup } | { ok: false; erro: string }

export function lerBackup(texto: string): LeituraBackup {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return { ok: false, erro: 'O arquivo não é um JSON válido.' }
  }
  const cabecalho = bruto as { formato?: unknown; versaoFormato?: unknown } | null
  if (!cabecalho || typeof cabecalho !== 'object' || cabecalho.formato !== FORMATO_BACKUP) {
    return { ok: false, erro: 'Este arquivo não é um backup do Plantão Fácil.' }
  }
  if (typeof cabecalho.versaoFormato === 'number' && cabecalho.versaoFormato > VERSAO_FORMATO_ATUAL) {
    return {
      ok: false,
      erro: 'Este backup foi feito numa versão mais nova do app. Atualize o app antes de importar.',
    }
  }

  const resultado = v.safeParse(esquemaArquivoBackup, bruto)
  if (!resultado.success) {
    const detalhes = resultado.issues
      .slice(0, 3)
      .map((i) => `${v.getDotPath(i) ?? '(raiz)'}: ${i.message}`)
      .join('; ')
    return { ok: false, erro: `O backup tem dados inválidos e não foi importado (${detalhes}).` }
  }

  const backup = resultado.output
  for (const [nome, lista] of [
    ['prescrições', backup.prescricoes],
    ['calculadoras', backup.calculadoras],
    ['categorias', backup.categorias],
  ] as const) {
    if (new Set(lista.map((e) => e.id)).size !== lista.length) {
      return { ok: false, erro: `O backup tem ${nome} com ID repetido e não foi importado.` }
    }
  }
  return { ok: true, backup }
}

// ===== Comparar =====

/** JSON com chaves em ordem: compara conteúdo sem depender da ordem das propriedades. */
export function jsonEstavel(valor: unknown): string {
  return JSON.stringify(valor, (_chave, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  )
}

/** Campos de primeiro nível diferentes (ignora atualizadoEm). */
export function camposAlterados<T extends Entidade>(a: T, b: T): string[] {
  const chaves = new Set([...Object.keys(a), ...Object.keys(b)])
  chaves.delete('atualizadoEm')
  return [...chaves]
    .filter((k) => jsonEstavel((a as Record<string, unknown>)[k]) !== jsonEstavel((b as Record<string, unknown>)[k]))
    .sort()
}

// ===== Planejar mesclagem =====

export type Situacao = 'novo' | 'igual' | 'conflito'

export interface ItemPlano<T extends Entidade> {
  id: UUID
  situacao: Situacao
  arquivo: T
  local: T | null
  /** Lado com `atualizadoEm` mais recente (empate: aparelho, para não mudar nada). */
  maisRecente: 'local' | 'arquivo'
  campos: string[]
}

export interface PlanoMesclagem {
  prescricoes: ItemPlano<Prescricao>[]
  calculadoras: ItemPlano<Calculadora>[]
  categorias: ItemPlano<Categoria>[]
  /** Categorias do arquivo juntadas a uma do aparelho com o mesmo nome. */
  categoriasUnificadas: { nome: string; idArquivo: UUID; idLocal: UUID }[]
}

function classificar<T extends Entidade>(locais: T[], doArquivo: T[]): ItemPlano<T>[] {
  const porId = new Map(locais.map((e) => [e.id, e]))
  return doArquivo.map((arquivo) => {
    const local = porId.get(arquivo.id) ?? null
    if (!local) return { id: arquivo.id, situacao: 'novo', arquivo, local, maisRecente: 'arquivo', campos: [] }
    const campos = camposAlterados(local, arquivo)
    return {
      id: arquivo.id,
      situacao: campos.length === 0 ? 'igual' : 'conflito',
      arquivo,
      local,
      maisRecente: arquivo.atualizadoEm > local.atualizadoEm ? 'arquivo' : 'local',
      campos,
    }
  })
}

/**
 * Compara a biblioteca do aparelho com a do arquivo.
 * Categorias ativas do arquivo com o mesmo nome (sem diferenciar maiúsculas/acentos) e escopo
 * de uma categoria ativa do aparelho, mas com ID diferente, são juntadas à do aparelho.
 * O que existe só no aparelho não aparece no plano (fica como está).
 */
export function planejarMesclagem(local: Biblioteca, arquivo: Biblioteca): PlanoMesclagem {
  const idsLocais = new Set(local.categorias.map((c) => c.id))
  const ativasLocais = local.categorias.filter((c) => c.excluidoEm === null)
  const trocaId = new Map<UUID, UUID>()
  const categoriasUnificadas: PlanoMesclagem['categoriasUnificadas'] = []

  for (const c of arquivo.categorias) {
    if (idsLocais.has(c.id) || c.excluidoEm !== null) continue
    const igual = ativasLocais.find(
      (l) => l.escopo === c.escopo && normalizarTexto(l.nome) === normalizarTexto(c.nome),
    )
    if (igual) {
      trocaId.set(c.id, igual.id)
      categoriasUnificadas.push({ nome: igual.nome, idArquivo: c.id, idLocal: igual.id })
    }
  }

  const remapear = <T extends { categoriaId: UUID | null }>(e: T): T =>
    e.categoriaId && trocaId.has(e.categoriaId) ? { ...e, categoriaId: trocaId.get(e.categoriaId)! } : e

  return {
    categorias: classificar(
      local.categorias,
      arquivo.categorias.filter((c) => !trocaId.has(c.id)),
    ),
    prescricoes: classificar(local.prescricoes, arquivo.prescricoes.map(remapear)),
    calculadoras: classificar(local.calculadoras, arquivo.calculadoras.map(remapear)),
    categoriasUnificadas,
  }
}

/** Escolha por conflito; sem escolha, vale a mais recente. */
export type Escolhas = Record<UUID, 'local' | 'arquivo'>

/** O que precisa ser gravado no aparelho: novos + conflitos em que o arquivo foi escolhido. */
export function aplicarMesclagem(plano: PlanoMesclagem, escolhas: Escolhas): Biblioteca {
  const gravar = <T extends Entidade>(itens: ItemPlano<T>[]) =>
    itens
      .filter(
        (i) =>
          i.situacao === 'novo' || (i.situacao === 'conflito' && (escolhas[i.id] ?? i.maisRecente) === 'arquivo'),
      )
      .map((i) => i.arquivo)
  return {
    prescricoes: gravar(plano.prescricoes),
    calculadoras: gravar(plano.calculadoras),
    categorias: gravar(plano.categorias),
  }
}

export function contarSituacoes<T extends Entidade>(itens: ItemPlano<T>[]): Record<Situacao, number> {
  const contagem: Record<Situacao, number> = { novo: 0, igual: 0, conflito: 0 }
  for (const i of itens) contagem[i.situacao]++
  return contagem
}
