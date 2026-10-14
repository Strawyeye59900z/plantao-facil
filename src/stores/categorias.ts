import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db } from '@/db/banco'
import { repoCategorias } from '@/db/repositorios'
import type { Categoria, EscopoCategoria, UUID } from '@/dominio/tipos'
import { usePrescricoesStore } from './prescricoes'

export const ROTULO_SEM_CATEGORIA = 'Sem categoria'

export const useCategoriasStore = defineStore('categorias', () => {
  const todas = ref<Categoria[]>([])

  function doEscopo(escopo: EscopoCategoria) {
    return todas.value
      .filter((c) => c.escopo === escopo && c.excluidoEm === null)
      .sort((a, b) => a.ordem - b.ordem)
  }

  const dePrescricoes = computed(() => doEscopo('prescricao'))

  async function carregar() {
    // Categorias criadas antes dos ícones não têm o campo.
    todas.value = (await db.categorias.toArray()).map((c) => ({ ...c, icone: c.icone ?? null }))
  }

  function obter(id: UUID | null): Categoria | undefined {
    return id ? todas.value.find((c) => c.id === id && c.excluidoEm === null) : undefined
  }

  function nome(id: UUID | null): string {
    return obter(id)?.nome ?? ROTULO_SEM_CATEGORIA
  }

  function substituir(c: Categoria) {
    const i = todas.value.findIndex((x) => x.id === c.id)
    if (i === -1) todas.value.push(c)
    else todas.value[i] = c
    return c
  }

  async function criar(nomeCategoria: string, escopo: EscopoCategoria, icone: string | null = null) {
    const lista = doEscopo(escopo)
    const ordem = lista.length ? Math.max(...lista.map((c) => c.ordem)) + 1 : 0
    return substituir(await repoCategorias.criar({ nome: nomeCategoria.trim(), escopo, ordem, icone }))
  }

  async function renomear(id: UUID, novoNome: string) {
    return substituir(await repoCategorias.atualizar(id, { nome: novoNome.trim() }))
  }

  async function definirIcone(id: UUID, icone: string | null) {
    return substituir(await repoCategorias.atualizar(id, { icone }))
  }

  /** Troca a posição com a vizinha (-1 = sobe, +1 = desce). */
  async function mover(id: UUID, direcao: -1 | 1) {
    const atual = obter(id)
    if (!atual) return
    const lista = doEscopo(atual.escopo)
    const i = lista.findIndex((c) => c.id === id)
    const vizinha = lista[i + direcao]
    if (!vizinha) return
    // Renumera a lista inteira para evitar ordens repetidas.
    const reordenada = [...lista]
    ;[reordenada[i], reordenada[i + direcao]] = [vizinha, atual]
    for (const [ordem, c] of reordenada.entries()) {
      if (c.ordem !== ordem) substituir(await repoCategorias.atualizar(c.id, { ordem }))
    }
  }

  /** Exclui a categoria; prescrições que a usavam ficam "Sem categoria". */
  async function excluir(id: UUID) {
    await db.transaction('rw', db.categorias, db.prescricoes, async () => {
      await repoCategorias.moverParaLixeira(id)
      const afetadas = await db.prescricoes.where('categoriaId').equals(id).toArray()
      const agora = new Date().toISOString()
      for (const p of afetadas) {
        await db.prescricoes.put({ ...p, categoriaId: null, atualizadoEm: agora })
      }
    })
    await Promise.all([carregar(), usePrescricoesStore().carregar()])
  }

  function emUso(id: UUID): number {
    return usePrescricoesStore().todas.filter((p) => p.categoriaId === id).length
  }

  return { todas, dePrescricoes, carregar, obter, nome, criar, renomear, definirIcone, mover, excluir, emUso }
})
