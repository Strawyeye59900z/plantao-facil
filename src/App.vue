<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import { Toaster } from '@/components/ui/sonner'
import { useConfiguracoesStore } from '@/stores/configuracoes'

const configuracoes = useConfiguracoesStore()
const route = useRoute()
/** Telas em tela cheia (sem o topo do app), como o modo consulta. */
const telaCheia = computed(() => route.meta.telaCheia === true)
</script>

<template>
  <RouterView v-if="telaCheia" />
  <AppLayout v-else />
  <Toaster
    position="top-center"
    :theme="configuracoes.config.tema === 'escuro' ? 'dark' : 'light'"
    :duration="5000"
  />
</template>
