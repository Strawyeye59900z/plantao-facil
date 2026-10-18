<script setup lang="ts">
import ListaBiblioteca from '@/components/comum/ListaBiblioteca.vue'
import { filtrarCalculadoras } from '@/dominio/calculadoras/busca'
import type { Calculadora } from '@/dominio/tipos'
import { useCalculadorasStore } from '@/stores/calculadoras'
import { useCategoriasStore } from '@/stores/categorias'

const calculadoras = useCalculadorasStore()
const categorias = useCategoriasStore()

function filtrar(itens: Calculadora[], termo: string) {
  return filtrarCalculadoras(itens, termo, (id) => categorias.obter(id)?.nome ?? '')
}
</script>

<template>
  <ListaBiblioteca
    titulo="Calculadoras"
    rota-base="/calculadoras"
    rotulo-novo="Nova calculadora"
    texto-vazio="Nenhuma calculadora cadastrada."
    :itens="calculadoras.ativas"
    :categorias="categorias.deCalculadoras"
    :filtrar="filtrar"
  />
</template>
