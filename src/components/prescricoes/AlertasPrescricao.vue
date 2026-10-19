<script setup lang="ts">
import { computed } from 'vue'
import type { Alerta } from '@/dominio/tipos'
import CartaoAlerta from './CartaoAlerta.vue'

/** Alertas da prescrição inteira (os ligados a um item aparecem junto do item). */
const props = defineProps<{ alertas: Alerta[] }>()

const daPrescricao = computed(() => props.alertas.filter((a) => a.itemId === null))
</script>

<template>
  <div v-if="daPrescricao.length" class="flex flex-col gap-2">
    <CartaoAlerta v-for="alerta in daPrescricao" :key="alerta.id" :alerta="alerta" />
  </div>
</template>
