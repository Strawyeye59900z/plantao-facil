<script setup lang="ts">
import { Button } from '@/components/ui/button'
</script>

<template>
  <section class="flex flex-col items-start gap-4">
    <h1 class="text-2xl font-semibold">Página não encontrada</h1>
    <Button as-child size="touch">
      <RouterLink to="/prescricoes">Ir para Prescrições</RouterLink>
    </Button>
  </section>
</template>
