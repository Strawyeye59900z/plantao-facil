<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { TriangleAlert } from '@lucide/vue'
import { montarLinhaDosePeso } from '@/dominio/calculadoras/dosePeso'
import { lerPeso } from '@/dominio/dose/peso'
import type { CalculadoraDosePeso } from '@/dominio/tipos'

/**
 * Uso de uma calculadora de doses por peso. O peso vive só na memória deste componente
 * (nenhum dado de paciente é salvo). Sem peso válido, as linhas mostram as regras.
 */
const props = defineProps<{ calculadora: Pick<CalculadoraDosePeso, 'linhas'> }>()

/** Ids únicos: a tela da prescrição pode mostrar várias calculadoras ao mesmo tempo. */
const idPeso = useId()
const idErro = `${idPeso}-erro`

const textoPeso = ref('')
const leitura = computed(() => (textoPeso.value.trim() === '' ? null : lerPeso(textoPeso.value)))
const pesoKg = computed(() => (leitura.value?.ok ? leitura.value.kg : null))
const erro = computed(() => (leitura.value && !leitura.value.ok ? leitura.value.erro : null))

const linhas = computed(() => props.calculadora.linhas.map((l) => ({ id: l.id, partes: montarLinhaDosePeso(l, pesoKg.value) })))
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="bg-card flex flex-col gap-2 rounded-3xl p-4 shadow-xs">
      <label :for="idPeso" class="text-muted-foreground text-xs font-semibold">Peso (kg)</label>
      <div class="relative">
        <input
          :id="idPeso"
          v-model="textoPeso"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          placeholder="0"
          :aria-invalid="!!erro || undefined"
          :aria-describedby="idErro"
          class="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-16 w-full rounded-2xl border px-4 pr-14 text-3xl font-extrabold outline-none focus-visible:ring-3 aria-invalid:ring-3"
        />
        <span class="text-muted-foreground pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-base">kg</span>
      </div>
      <p :id="idErro" class="text-destructive min-h-0 text-sm" role="alert">{{ erro }}</p>
    </div>

    <ul class="flex flex-col gap-2">
      <li v-for="linha in linhas" :key="linha.id" class="bg-card rounded-2xl px-4 py-3 leading-relaxed whitespace-pre-line shadow-xs">
        <template v-for="(parte, i) in linha.partes" :key="i">
          <span v-if="parte.tipo === 'texto'">{{ parte.texto }}</span>
          <template v-else>
            <strong class="text-primary font-bold whitespace-nowrap">{{ parte.texto }}</strong>
            <span
              v-if="parte.limitada"
              class="bg-atencao-suave text-atencao-suave-foreground mx-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-xs font-semibold"
            >
              <TriangleAlert class="size-3" /> limitada à dose máxima
            </span>
          </template>
        </template>
      </li>
    </ul>
  </div>
</template>
