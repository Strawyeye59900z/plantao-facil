<script setup lang="ts">
import { Construction } from '@lucide/vue'

defineProps<{
  titulo: string
  fase: number
  descricao?: string
}>()
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-2xl font-semibold">{{ titulo }}</h1>
    <div class="text-muted-foreground flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
      <Construction class="size-8" />
      <p class="text-sm">Disponível na Fase {{ fase }}.</p>
      <p v-if="descricao" class="text-sm">{{ descricao }}</p>
    </div>
  </section>
</template>
