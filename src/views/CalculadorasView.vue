<script setup lang="ts">
import { computed } from 'vue'
import PainelBiblioteca from '@/components/biblioteca/PainelBiblioteca.vue'
import { filtrarCalculadoras } from '@/dominio/calculadoras/busca'
import type { Calculadora } from '@/dominio/tipos'
import { useCalculadorasStore } from '@/stores/calculadoras'
import { useCategoriasStore } from '@/stores/categorias'

const calculadoras = useCalculadorasStore()
const categorias = useCategoriasStore()

const itens = computed(() => calculadoras.ativas.filter((c) => c.area === 'calculadora'))

function filtrar(lista: Calculadora[], termo: string) {
  return filtrarCalculadoras(lista, termo, (id) => categorias.obter(id)?.nome ?? '')
}

function descrever(c: Calculadora) {
  return { etiquetas: [c.tipo === 'dose_peso' ? 'Doses por peso' : 'Fórmula'], meta: c.descricao.trim() }
}
</script>

<template>
  <PainelBiblioteca
    rota-base="/calculadoras"
    rotulo-novo="Nova calculadora"
    texto-vazio="Nenhuma calculadora cadastrada."
    :nome-itens="{ um: 'calculadora', varios: 'calculadoras' }"
    :itens="itens"
    :grupos="categorias.deCalculadoras"
    :filtrar="filtrar"
    :descrever="descrever"
  />
</template>
