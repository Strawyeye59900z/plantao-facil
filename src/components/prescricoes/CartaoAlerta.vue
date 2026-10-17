<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import { ROTULO_GRAVIDADE, ROTULO_TIPO_ALERTA, type Alerta } from '@/dominio/tipos'
import { ESTILO_GRAVIDADE } from './gravidade'

const props = defineProps<{
  alerta: Alerta
  /** Ex.: "Item 2" quando o alerta é ligado a um item e aparece no topo. */
  referenciaItem?: string
  compacto?: boolean
}>()

const estilo = computed(() => ESTILO_GRAVIDADE[props.alerta.gravidade])
</script>

<template>
  <div
    role="note"
    :class="cn('flex gap-3 rounded-2xl border p-3', estilo.caixa, compacto && 'rounded-xl p-2.5 text-sm')"
  >
    <component :is="estilo.componente" :class="cn('mt-0.5 size-5 shrink-0', estilo.icone)" />
    <div class="min-w-0 flex-1">
      <p class="text-xs font-medium">
        {{ ROTULO_TIPO_ALERTA[alerta.tipo] }} · {{ ROTULO_GRAVIDADE[alerta.gravidade] }}
        <span v-if="referenciaItem" class="text-muted-foreground font-normal normal-case">· {{ referenciaItem }}</span>
      </p>
      <p class="mt-0.5 whitespace-pre-line">{{ alerta.texto }}</p>
    </div>
  </div>
</template>
