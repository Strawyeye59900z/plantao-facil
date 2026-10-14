<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import { ICONES_CATEGORIA } from './icones'

/** Mostra o ícone da categoria; sem ícone (ou nome desconhecido) não mostra nada. */
const props = defineProps<{ icone: string | null | undefined; class?: string }>()
const definicao = computed(() => (props.icone ? ICONES_CATEGORIA[props.icone] : undefined))
</script>

<template>
  <component
    :is="definicao.componente"
    v-if="definicao"
    aria-hidden="true"
    :class="cn('size-4 shrink-0', props.class)"
  />
</template>
