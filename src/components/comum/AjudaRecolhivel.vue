<script setup lang="ts">
import { ref, useId } from 'vue'

/**
 * Ajuda curta sempre visível; o texto completo abre em "Saiba mais".
 * Usada onde a explicação longa atrapalharia a leitura do formulário no celular.
 */
defineProps<{ curta: string; completa: string }>()

const aberta = ref(false)
const id = useId()
</script>

<template>
  <div class="text-muted-foreground text-sm">
    <p v-if="!aberta">{{ curta }}</p>
    <button
      type="button"
      class="text-primary mt-1 min-h-11 font-semibold underline-offset-2 hover:underline"
      :aria-expanded="aberta"
      :aria-controls="`${id}-completa`"
      @click="aberta = !aberta"
    >
      {{ aberta ? 'Ocultar' : 'Saiba mais' }}
    </button>
    <p v-if="aberta" :id="`${id}-completa`">{{ completa }}</p>
  </div>
</template>
