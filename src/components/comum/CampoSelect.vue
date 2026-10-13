<script setup lang="ts" generic="T extends string | null">
import { cn } from '@/lib/utils'
import { ChevronDown } from '@lucide/vue'

defineOptions({ inheritAttrs: false })

/** Select nativo: no celular abre o seletor do sistema, mais rápido no toque. */
defineProps<{
  opcoes: { valor: T; rotulo: string }[]
  id?: string
  class?: string
  placeholder?: string
}>()

const modelo = defineModel<T>({ required: true })
</script>

<template>
  <div :class="cn('relative h-fit', $props.class)">
    <select
      :id="id"
      v-model="modelo"
      v-bind="$attrs"
      class="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive h-11 w-full appearance-none rounded-lg border bg-transparent pr-9 pl-3 text-base outline-none focus-visible:ring-3"
    >
      <option v-if="placeholder" :value="null" disabled>{{ placeholder }}</option>
      <option v-for="o in opcoes" :key="String(o.valor)" :value="o.valor" class="bg-popover text-popover-foreground">
        {{ o.rotulo }}
      </option>
    </select>
    <ChevronDown class="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
  </div>
</template>
