<script setup lang="ts">
import type { Alerta } from '@/dominio/tipos'
import CartaoAlerta from './CartaoAlerta.vue'

/** Alertas do topo da prescrição (já escolhidos por `alertasDaPrescricao`). */
defineProps<{ alertas: Alerta[] }>()
</script>

<template>
  <div v-if="alertas.length" class="flex flex-col gap-2">
    <CartaoAlerta v-for="alerta in alertas" :key="alerta.id" :alerta="alerta" />
  </div>
</template>
