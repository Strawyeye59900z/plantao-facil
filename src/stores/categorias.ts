import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db } from '@/db/banco'
import { excluirGrupoComPrescricoes } from '@/db/exclusao'
import { repoCategorias } from '@/db/repositorios'
import { ROTULO_SEM_GRUPO } from '@/dominio/biblioteca/lateral'
import type { Categoria, EscopoCategoria, UUID } from '@/dominio/tipos'
import { useCalculadorasStore } from './calculadoras'
import { usePrescricoesStore } from './prescricoes'

export const ROTULO_SEM_CATEGORIA = ROTULO_SEM_GRUPO

export const useCategoriasStore = defineStore('categorias', () => {
  const todas = ref<Categoria[]>([])

  function doEscopo(escopo: EscopoCategoria) {
    return todas.value
      .filter((c) => c.escopo === escopo && c.excluidoEm === null)
      .sort((a, b) => a.ordem - b.ordem)
  }

  const dePrescricoes = computed(() => doEscopo('prescricao'))
  const deCalculadoras = computed(() => doEscopo('calculadora'))
  const deEscalas = computed(() => doEscopo('escala'))

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

  /** Exclui a categoria; prescrições, calculadoras e escalas que a usavam ficam "Sem categoria". */
  async function excluir(id: UUID) {
    await db.transaction('rw', db.categorias, db.prescricoes, db.calculadoras, async () => {
      await repoCategorias.moverParaLixeira(id)
      const agora = new Date().toISOString()
      for (const p of await db.prescricoes.where('categoriaId').equals(id).toArray()) {
        await db.prescricoes.put({ ...p, categoriaId: null, atualizadoEm: agora })
      }
      // Calculadoras e escalas ficam na mesma tabela: zera o grupo de todas, qualquer que seja a área.
      for (const c of await db.calculadoras.where('categoriaId').equals(id).toArray()) {
        await db.calculadoras.put({ ...c, categoriaId: null, atualizadoEm: agora })
      }
    })
    await Promise.all([carregar(), usePrescricoesStore().carregar(), useCalculadorasStore().carregar()])
  }

  function emUso(id: UUID): number {
    return (
      usePrescricoesStore().todas.filter((p) => p.categoriaId === id).length +
      useCalculadorasStore().todas.filter((c) => c.categoriaId === id).length
    )
  }

  /** Exclui o grupo e manda as prescrições dele para a lixeira. Devolve quantas foram movidas. */
  async function excluirComPrescricoes(id: UUID) {
    const movidas = await excluirGrupoComPrescricoes(id)
    await Promise.all([carregar(), usePrescricoesStore().carregar()])
    return movidas
  }

  return { todas, dePrescricoes, deCalculadoras, deEscalas, doEscopo, carregar, obter, nome, criar, renomear, definirIcone, mover, excluir, excluirComPrescricoes, emUso }
})
