<script setup lang="ts">
import { ref } from 'vue'
import { X } from '@lucide/vue'
import { normalizarTags } from '@/dominio/prescricoes/editar'

defineProps<{ id?: string }>()
const tags = defineModel<string[]>({ required: true })
const digitando = ref('')

function confirmar() {
  if (!digitando.value.trim()) return
  tags.value = normalizarTags([...tags.value, digitando.value])
  digitando.value = ''
}

function remover(indice: number) {
  tags.value = tags.value.filter((_, i) => i !== indice)
}

function aoDigitar(evento: Event) {
  // Vírgula confirma a tag (o teclado do Android nem sempre envia keydown de vírgula).
  if ((evento.target as HTMLInputElement).value.includes(',')) confirmar()
}

function aoApagar() {
  if (!digitando.value && tags.value.length) remover(tags.value.length - 1)
}
</script>

<template>
  <div
    class="border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 focus-within:ring-3"
  >
    <span
      v-for="(tag, i) in tags"
      :key="tag"
      class="bg-secondary text-secondary-foreground inline-flex h-8 items-center gap-1 rounded-full pr-1 pl-3 text-sm"
    >
      {{ tag }}
      <button
        type="button"
        class="hover:bg-muted flex size-6 items-center justify-center rounded-full"
        :aria-label="`Remover tag ${tag}`"
        @click="remover(i)"
      >
        <X class="size-3.5" />
      </button>
    </span>
    <input
      :id="id"
      v-model="digitando"
      type="text"
      enterkeyhint="done"
      placeholder="Digite e toque Enter"
      class="h-8 min-w-32 flex-1 bg-transparent px-1 text-base outline-none"
      @keydown.enter.prevent="confirmar"
      @keydown.backspace="aoApagar"
      @input="aoDigitar"
      @blur="confirmar"
    />
  </div>
</template>
