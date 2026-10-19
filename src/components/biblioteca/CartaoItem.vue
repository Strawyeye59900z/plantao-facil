<script setup lang="ts">
import { Star } from '@lucide/vue'
import { cn } from '@/lib/utils'
import { ETIQUETA_REVISAR } from './etiquetas'

/** Cartão de uma prescrição ou calculadora na grade da biblioteca. */
defineProps<{
  para: string
  titulo: string
  favorito: boolean
  etiquetas: string[]
  meta: string
}>()
</script>

<template>
  <RouterLink
    :to="para"
    class="bg-card hover:bg-accent/60 active:bg-accent flex min-h-24 flex-col gap-1.5 rounded-[1.125rem] p-4 shadow-xs transition-colors"
  >
    <div v-if="etiquetas.length" class="flex flex-wrap gap-1.5">
      <span
        v-for="etiqueta in etiquetas"
        :key="etiqueta"
        :class="cn(
          'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
          etiqueta === ETIQUETA_REVISAR ? 'bg-atencao-suave text-atencao-suave-foreground' : 'bg-accent text-primary',
        )"
      >
        {{ etiqueta }}
      </span>
    </div>
    <div class="flex items-start gap-2">
      <p class="min-w-0 flex-1 text-[15px] leading-snug font-bold break-words">{{ titulo }}</p>
      <Star v-if="favorito" class="fill-atencao text-atencao mt-0.5 size-4 shrink-0" aria-label="Favorito" />
    </div>
    <p v-if="meta" class="text-muted-foreground text-xs">{{ meta }}</p>
  </RouterLink>
</template>
