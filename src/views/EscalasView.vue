<script setup lang="ts">
import { computed } from 'vue'
import PainelBiblioteca from '@/components/biblioteca/PainelBiblioteca.vue'
import { filtrarCalculadoras } from '@/dominio/calculadoras/busca'
import type { Calculadora } from '@/dominio/tipos'
import { useCalculadorasStore } from '@/stores/calculadoras'
import { useCategoriasStore } from '@/stores/categorias'

const calculadoras = useCalculadorasStore()
const categorias = useCategoriasStore()

const itens = computed(() => calculadoras.ativas.filter((c) => c.area === 'escala'))

function filtrar(lista: Calculadora[], termo: string) {
  return filtrarCalculadoras(lista, termo, (id) => categorias.obter(id)?.nome ?? '')
}

function descrever(c: Calculadora) {
  return { etiquetas: [c.tipo === 'pontos' ? 'Pontos' : 'Fórmula'], meta: c.descricao.trim() }
}
</script>

<template>
  <PainelBiblioteca
    rota-base="/escalas"
    rotulo-novo="Nova escala"
    texto-vazio="Nenhuma escala cadastrada."
    :nome-itens="{ um: 'escala', varios: 'escalas' }"
    :itens="itens"
    :grupos="categorias.deEscalas"
    :filtrar="filtrar"
    :descrever="descrever"
  />
</template>
