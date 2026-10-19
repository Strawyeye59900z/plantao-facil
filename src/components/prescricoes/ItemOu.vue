<script setup lang="ts">
import type { ItemPrescricao, UUID } from '@/dominio/tipos'
import { cn } from '@/lib/utils'

/**
 * Item "OU": opções empilhadas para tocar em uma, com o motivo à direita.
 * Nenhuma vem escolhida; `destacado` marca o item que falta escolher para copiar.
 */
const props = defineProps<{
  item: ItemPrescricao
  numero: number
  escolhida: UUID | undefined
  destacado?: boolean
}>()
const emit = defineEmits<{ escolher: [opcaoId: UUID] }>()

const nome = `ou-${props.item.id}`
</script>

<template>
  <div
    role="radiogroup"
    :aria-labelledby="`${nome}-rotulo`"
    :class="cn(
      'flex min-w-0 flex-col gap-1.5 rounded-2xl transition-shadow',
      destacado && !escolhida && 'ring-atencao ring-offset-card ring-2 ring-offset-4',
    )"
  >
    <div class="flex flex-wrap items-center gap-1.5">
      <span
        :id="`${nome}-rotulo`"
        :class="cn(
          'text-[11px] font-bold tracking-wider uppercase',
          destacado && !escolhida ? 'text-atencao-suave-foreground' : 'text-muted-foreground',
        )"
      >
        Escolha uma<span class="sr-only"> opção no item {{ numero }}</span>
      </span>
      <slot name="etiquetas" />
    </div>
    <label
      v-for="opcao in item.opcoes"
      :key="opcao.id"
      :class="cn(
        'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-[1.5px] px-3 py-2 transition-colors',
        escolhida === opcao.id ? 'border-primary bg-accent' : 'hover:bg-accent/50 border-border',
        'has-[:focus-visible]:ring-ring/40 has-[:focus-visible]:ring-3',
      )"
    >
      <input
        type="radio"
        class="peer sr-only"
        :name="nome"
        :value="opcao.id"
        :checked="escolhida === opcao.id"
        @change="emit('escolher', opcao.id)"
      />
      <span
        aria-hidden="true"
        :class="cn(
          'flex size-4 shrink-0 items-center justify-center rounded-full border-2',
          escolhida === opcao.id ? 'border-primary' : 'border-muted-foreground',
        )"
      >
        <span v-if="escolhida === opcao.id" class="bg-primary size-2 rounded-full" />
      </span>
      <span class="min-w-0 flex-1 text-[15px] leading-snug whitespace-pre-line">{{ opcao.texto }}</span>
      <span v-if="opcao.motivo" class="text-muted-foreground max-w-[40%] shrink-0 text-right text-xs leading-snug">
        {{ opcao.motivo }}
      </span>
    </label>
  </div>
</template>
