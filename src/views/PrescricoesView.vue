<script setup lang="ts">
import PainelBiblioteca from '@/components/biblioteca/PainelBiblioteca.vue'
import { ETIQUETA_REVISAR } from '@/components/biblioteca/etiquetas'
import { filtrarPrescricoes } from '@/dominio/prescricoes/busca'
import type { Prescricao } from '@/dominio/tipos'
import { useCategoriasStore } from '@/stores/categorias'
import { usePrescricoesStore } from '@/stores/prescricoes'

const prescricoes = usePrescricoesStore()
const categorias = useCategoriasStore()

function filtrar(itens: Prescricao[], termo: string) {
  return filtrarPrescricoes(itens, termo, (id) => categorias.obter(id)?.nome ?? '')
}

function descrever(p: Prescricao) {
  const etiquetas: string[] = []
  const n = p.condicoes.length
  if (n > 0) etiquetas.push(`${n} ${n === 1 ? 'condição' : 'condições'}`)
  if (p.revisada === false) etiquetas.push(ETIQUETA_REVISAR)
  return { etiquetas, meta: p.receita.trim() ? 'Receita de alta' : '' }
}
</script>

<template>
  <PainelBiblioteca
    rota-base="/prescricoes"
    rotulo-novo="Nova prescrição"
    texto-vazio="Nenhuma prescrição cadastrada."
    :nome-itens="{ um: 'prescrição', varios: 'prescrições' }"
    :itens="prescricoes.ativas"
    :grupos="categorias.dePrescricoes"
    :filtrar="filtrar"
    :descrever="descrever"
  />
</template>
