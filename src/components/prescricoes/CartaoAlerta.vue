<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import { ROTULO_GRAVIDADE, ROTULO_TIPO_ALERTA, type Alerta } from '@/dominio/tipos'
import { ESTILO_GRAVIDADE } from './gravidade'
import { TINTA_GRAVIDADE } from './tintaGravidade'

/** Alerta da prescrição inteira: caixa tingida pela gravidade, tipo em destaque e texto completo. */
const props = defineProps<{ alerta: Alerta }>()

const icone = computed(() => ESTILO_GRAVIDADE[props.alerta.gravidade].componente)
</script>

<template>
  <div role="note" :class="cn('flex items-start gap-3 rounded-2xl border px-4 py-3', TINTA_GRAVIDADE[alerta.gravidade])">
    <component :is="icone" class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
    <div class="min-w-0 flex-1">
      <p class="text-[11px] font-bold tracking-wider uppercase">
        {{ ROTULO_TIPO_ALERTA[alerta.tipo] }}
        <span class="sr-only">· {{ ROTULO_GRAVIDADE[alerta.gravidade] }}</span>
      </p>
      <p class="mt-0.5 text-[15px] leading-relaxed whitespace-pre-line">{{ alerta.texto }}</p>
    </div>
  </div>
</template>
