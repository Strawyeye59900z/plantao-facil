<script setup lang="ts">
import { computed } from 'vue'
import { paragrafosObservacoes } from '@/dominio/prescricoes/observacoes'

/** Observações no fim da prescrição: caixa âmbar, um parágrafo por observação, rótulo em negrito. */
const props = defineProps<{ texto: string }>()

const paragrafos = computed(() => paragrafosObservacoes(props.texto))
</script>

<template>
  <section
    v-if="paragrafos.length"
    aria-labelledby="titulo-observacoes"
    class="bg-observacoes text-observacoes-foreground border-atencao/25 flex flex-col gap-2 rounded-lg border px-4 py-3.5 md:px-5"
  >
    <h2 id="titulo-observacoes" class="text-atencao-suave-foreground text-xs font-semibold">
      Observações
    </h2>
    <p v-for="(paragrafo, i) in paragrafos" :key="i" class="text-[15px] leading-relaxed whitespace-pre-line">
      <template v-if="paragrafo.rotulo"><strong class="font-bold">{{ paragrafo.rotulo }}:</strong>{{ ' ' }}</template>{{ paragrafo.texto }}
    </p>
  </section>
</template>
