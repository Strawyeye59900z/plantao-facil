<script setup lang="ts">
import ListaBiblioteca from '@/components/comum/ListaBiblioteca.vue'
import { filtrarPrescricoes } from '@/dominio/prescricoes/busca'
import type { Prescricao } from '@/dominio/tipos'
import { useCategoriasStore } from '@/stores/categorias'
import { usePrescricoesStore } from '@/stores/prescricoes'
import { useRecentesStore } from '@/stores/recentes'

const prescricoes = usePrescricoesStore()
const categorias = useCategoriasStore()
const recentes = useRecentesStore()

function filtrar(itens: Prescricao[], termo: string) {
  return filtrarPrescricoes(itens, termo, (id) => categorias.obter(id)?.nome ?? '')
}
</script>

<template>
  <ListaBiblioteca
    titulo="Prescrições"
    rota-base="/prescricoes"
    rotulo-novo="Nova prescrição"
    texto-vazio="Nenhuma prescrição cadastrada."
    :itens="prescricoes.ativas"
    :categorias="categorias.dePrescricoes"
    :recentes-ids="recentes.ids('prescricao')"
    :filtrar="filtrar"
  />
</template>
