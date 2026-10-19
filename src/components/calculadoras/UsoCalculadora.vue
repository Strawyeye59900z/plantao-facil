<script setup lang="ts">
import type { DadosCalculadora } from '@/dominio/calculadoras/editar'
import UsoDosePeso from './UsoDosePeso.vue'
import UsoFormula from './UsoFormula.vue'
import UsoPontos from './UsoPontos.vue'

/** Tela de uso: escolhe a tela pelo tipo. Aceita a calculadora salva ou os dados em edição (painel "Testar"). */
defineProps<{ calculadora: DadosCalculadora }>()
</script>

<template>
  <UsoDosePeso v-if="calculadora.tipo === 'dose_peso'" :calculadora="calculadora" />
  <UsoFormula v-else-if="calculadora.tipo === 'formula'" :calculadora="calculadora" />
  <UsoPontos v-else :calculadora="calculadora" />
</template>
