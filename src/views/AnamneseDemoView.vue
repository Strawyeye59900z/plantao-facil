<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import ModoConsulta, { type LembreteConsulta } from '@/components/anamnese/ModoConsulta.vue'

/**
 * Demonstração do modo consulta: timer falso e lembretes, sem gravar nada.
 */
const lembretesPadrao = [
  'Alergias',
  'Medicações em uso',
  'Doenças prévias',
  'Cirurgias e internações',
  'Tabagismo e etilismo',
  'Gestação e DUM',
]

const items = ref<LembreteConsulta[]>(
  lembretesPadrao.map((label, i) => ({ id: `l${i + 1}`, label, done: false, via: null })),
)
const segundos = ref(0)
const pausado = ref(false)
let relogio: number | undefined

function iniciar() {
  relogio = window.setInterval(() => {
    if (!pausado.value) segundos.value += 1
  }, 1000)
}

function alternar(id: string) {
  const item = items.value.find((i) => i.id === id)
  if (!item) return
  item.done = !item.done
  item.via = item.done ? 'manual' : null
}

iniciar()
onBeforeUnmount(() => window.clearInterval(relogio))
</script>

<template>
  <div>
    <p class="mb-3 text-sm text-muted-foreground">Demonstração: nada é gravado nem enviado.</p>
    <ModoConsulta
      :elapsed-seconds="segundos"
      :paused="pausado"
      :items="items"
      session-code="482 913"
      @toggle-pause="pausado = !pausado"
      @toggle-item="alternar"
      @finish="() => {}"
    />
  </div>
</template>
