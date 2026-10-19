<script setup lang="ts">
import PainelBiblioteca from '@/components/biblioteca/PainelBiblioteca.vue'
import { filtrarCalculadoras } from '@/dominio/calculadoras/busca'
import type { Calculadora } from '@/dominio/tipos'
import { useCalculadorasStore } from '@/stores/calculadoras'
import { useCategoriasStore } from '@/stores/categorias'

const calculadoras = useCalculadorasStore()
const categorias = useCategoriasStore()

function filtrar(itens: Calculadora[], termo: string) {
  return filtrarCalculadoras(itens, termo, (id) => categorias.obter(id)?.nome ?? '')
}

function descrever(c: Calculadora) {
  return { etiquetas: [c.tipo === 'pontos' ? 'Pontos' : c.tipo === 'dose_peso' ? 'Doses por peso' : 'Fórmula'], meta: c.descricao.trim() }
}
</script>

<template>
  <PainelBiblioteca
    rota-base="/calculadoras"
    rotulo-novo="Nova calculadora"
    texto-vazio="Nenhuma calculadora cadastrada."
    :nome-itens="{ um: 'calculadora', varios: 'calculadoras' }"
    :itens="calculadoras.ativas"
    :grupos="categorias.deCalculadoras"
    :filtrar="filtrar"
    :descrever="descrever"
  />
</template>
