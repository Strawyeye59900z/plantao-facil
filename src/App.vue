<script setup lang="ts">
import AppLayout from '@/components/layout/AppLayout.vue'
import { Toaster } from '@/components/ui/sonner'
import { useConfiguracoesStore } from '@/stores/configuracoes'

const configuracoes = useConfiguracoesStore()
</script>

<template>
  <AppLayout />
  <Toaster
    position="top-center"
    :theme="configuracoes.config.tema === 'escuro' ? 'dark' : 'light'"
    :duration="5000"
  />
</template>
