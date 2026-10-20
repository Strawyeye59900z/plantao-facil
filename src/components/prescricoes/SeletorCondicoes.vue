<script setup lang="ts">
import { Check } from '@lucide/vue'
import type { CondicoesMarcadas } from '@/dominio/prescricoes/condicoes'
import type { Condicao, UUID } from '@/dominio/tipos'
import { cn } from '@/lib/utils'

/** "O paciente tem…": condições em pílulas que alternam com um toque (nenhuma vem marcada). */
defineProps<{ condicoes: Condicao[] }>()
const marcadas = defineModel<CondicoesMarcadas>({ required: true })

function alternar(id: UUID) {
  marcadas.value = { ...marcadas.value, [id]: !marcadas.value[id] }
}
</script>

<template>
  <div v-if="condicoes.length" class="flex flex-col gap-2">
    <p id="rotulo-condicoes" class="text-muted-foreground text-sm font-semibold">O paciente tem…</p>
    <div class="flex flex-wrap gap-2" role="group" aria-labelledby="rotulo-condicoes">
      <button
        v-for="condicao in condicoes"
        :key="condicao.id"
        type="button"
        :aria-pressed="!!marcadas[condicao.id]"
        :class="cn(
          'flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2 text-left text-sm font-semibold shadow-xs transition-colors',
          marcadas[condicao.id] ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
        )"
        @click="alternar(condicao.id)"
      >
        <Check v-if="marcadas[condicao.id]" class="size-4 shrink-0" aria-hidden="true" />
        {{ condicao.nome }}
      </button>
    </div>
  </div>
</template>
