<script setup lang="ts">
import { computed } from 'vue'
import CampoNumero from './CampoNumero.vue'

/** Campo numérico de preenchimento obrigatório: vazio vira NaN (a validação acusa). */
defineOptions({ inheritAttrs: false })
defineProps<{ sufixo?: string; class?: string }>()
const valor = defineModel<number>({ required: true })

const modelo = computed<number | null>({
  get: () => valor.value,
  set: (v) => (valor.value = v ?? Number.NaN),
})
</script>

<template>
  <CampoNumero v-model="modelo" v-bind="$attrs" :sufixo="sufixo" :class="$props.class" />
</template>
