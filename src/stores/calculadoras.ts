import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db } from '@/db/banco'
import { repoCalculadoras } from '@/db/repositorios'
import { duplicarCalculadora, type DadosCalculadora } from '@/dominio/calculadoras/editar'
import type { Calculadora, UUID } from '@/dominio/tipos'

/** Cópia simples: o IndexedDB não aceita o proxy reativo do Vue. */
function semProxy<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T
}

export const useCalculadorasStore = defineStore('calculadoras', () => {
  /** Todas, inclusive as da lixeira. */
  const todas = ref<Calculadora[]>([])

  const ativas = computed(() => todas.value.filter((c) => c.excluidoEm === null))
  const lixeira = computed(() =>
    todas.value.filter((c) => c.excluidoEm !== null).sort((a, b) => b.excluidoEm!.localeCompare(a.excluidoEm!)),
  )
  const favoritas = computed(() => ativas.value.filter((c) => c.favorito))

  async function carregar() {
    todas.value = await db.calculadoras.toArray()
  }

  function obter(id: UUID): Calculadora | undefined {
    return todas.value.find((c) => c.id === id)
  }

  function substituir(c: Calculadora) {
    const i = todas.value.findIndex((x) => x.id === c.id)
    if (i === -1) todas.value.push(c)
    else todas.value[i] = c
    return c
  }

  // Omit<> de um tipo união não é distributivo; o cast só contorna a tipagem do repositório genérico.
  async function criar(dados: DadosCalculadora) {
    return substituir(await repoCalculadoras.criar(semProxy(dados) as never))
  }

  async function atualizar(id: UUID, dados: Partial<DadosCalculadora>) {
    return substituir(await repoCalculadoras.atualizar(id, semProxy(dados) as never))
  }

  async function duplicar(id: UUID) {
    const original = obter(id)
    if (!original) throw new Error('Calculadora não encontrada.')
    return criar(duplicarCalculadora(original))
  }

  async function alternarFavorito(id: UUID) {
    const c = obter(id)
    if (c) await atualizar(id, { favorito: !c.favorito })
  }

  async function moverParaLixeira(id: UUID) {
    return substituir(await repoCalculadoras.moverParaLixeira(id))
  }

  async function restaurar(id: UUID) {
    return substituir(await repoCalculadoras.restaurar(id))
  }

  async function excluirPermanentemente(id: UUID) {
    await repoCalculadoras.excluirPermanentemente(id)
    todas.value = todas.value.filter((c) => c.id !== id)
  }

  return {
    todas,
    ativas,
    lixeira,
    favoritas,
    carregar,
    obter,
    criar,
    atualizar,
    duplicar,
    alternarFavorito,
    moverParaLixeira,
    restaurar,
    excluirPermanentemente,
  }
})
