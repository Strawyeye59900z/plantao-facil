<script setup lang="ts">
import { ref, watch } from 'vue'
import { cn } from '@/lib/utils'
import { formatarNumero, lerNumero } from '@/dominio/dose/numeros'

/**
 * Campo numérico com teclado decimal; aceita vírgula ou ponto.
 * Modelo: número, null (vazio) ou NaN (texto inválido — a validação acusa).
 */
const props = defineProps<{ class?: string; sufixo?: string }>()
defineOptions({ inheritAttrs: false })

const valor = defineModel<number | null>({ required: true })

function paraTexto(v: number | null): string {
  return v === null || Number.isNaN(v) ? '' : formatarNumero(v)
}

const texto = ref(paraTexto(valor.value))

// Atualiza o texto se o valor mudar por fora (sem atrapalhar a digitação, ex.: "3,").
watch(valor, (v) => {
  const atual = lerNumero(texto.value)
  if (!(v === atual || (Number.isNaN(v) && Number.isNaN(atual)))) texto.value = paraTexto(v)
})

function aoDigitar() {
  valor.value = lerNumero(texto.value)
}
</script>

<template>
  <div :class="cn('relative', props.class)">
    <input
      v-bind="$attrs"
      v-model="texto"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      :aria-invalid="(texto.trim() !== '' && Number.isNaN(valor)) || undefined"
      :class="cn(
        'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-11 w-full rounded-lg border bg-transparent px-3 text-base outline-none focus-visible:ring-3 aria-invalid:ring-3',
        sufixo && 'pr-14',
      )"
      @input="aoDigitar"
    />
    <span
      v-if="sufixo"
      class="text-muted-foreground pointer-events-none absolute top-1/2 right-3 max-w-12 -translate-y-1/2 truncate text-sm"
    >
      {{ sufixo }}
    </span>
  </div>
</template>
