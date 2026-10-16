import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db } from '@/db/banco'
import { repoPrescricoes } from '@/db/repositorios'
import { duplicarPrescricao, type DadosPrescricao } from '@/dominio/prescricoes/editar'
import type { Prescricao, UUID } from '@/dominio/tipos'

/** Cópia simples: o IndexedDB não aceita o proxy reativo do Vue. */
function semProxy<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T
}

export const usePrescricoesStore = defineStore('prescricoes', () => {
  /** Todas, inclusive as da lixeira. */
  const todas = ref<Prescricao[]>([])

  const ativas = computed(() => todas.value.filter((p) => p.excluidoEm === null))
  const lixeira = computed(() =>
    todas.value
      .filter((p) => p.excluidoEm !== null)
      .sort((a, b) => b.excluidoEm!.localeCompare(a.excluidoEm!)),
  )
  const favoritas = computed(() => ativas.value.filter((p) => p.favorito))

  async function carregar() {
    // Prescrições criadas antes da receita pronta/condições não têm os campos.
    todas.value = (await db.prescricoes.toArray()).map((p) => ({ ...p, receita: p.receita ?? '', condicoes: p.condicoes ?? [] }))
  }

  function obter(id: UUID): Prescricao | undefined {
    return todas.value.find((p) => p.id === id)
  }

  function substituir(p: Prescricao) {
    const i = todas.value.findIndex((x) => x.id === p.id)
    if (i === -1) todas.value.push(p)
    else todas.value[i] = p
    return p
  }

  async function criar(dados: DadosPrescricao) {
    return substituir(await repoPrescricoes.criar(semProxy(dados)))
  }

  async function atualizar(id: UUID, dados: Partial<DadosPrescricao>) {
    return substituir(await repoPrescricoes.atualizar(id, semProxy(dados)))
  }

  async function duplicar(id: UUID) {
    const original = obter(id)
    if (!original) throw new Error('Prescrição não encontrada.')
    return criar(duplicarPrescricao(semProxy(original)))
  }

  async function alternarFavorito(id: UUID) {
    const p = obter(id)
    if (p) await atualizar(id, { favorito: !p.favorito })
  }

  async function moverParaLixeira(id: UUID) {
    return substituir(await repoPrescricoes.moverParaLixeira(id))
  }

  async function restaurar(id: UUID) {
    return substituir(await repoPrescricoes.restaurar(id))
  }

  async function excluirPermanentemente(id: UUID) {
    await repoPrescricoes.excluirPermanentemente(id)
    todas.value = todas.value.filter((p) => p.id !== id)
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
