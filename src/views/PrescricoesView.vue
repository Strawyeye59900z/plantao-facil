<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import EmBreve from '@/components/layout/EmBreve.vue'

const route = useRoute()
const termo = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))
</script>

<template>
  <div class="flex flex-col gap-3">
    <p v-if="termo" class="text-muted-foreground text-sm">Busca: “{{ termo }}”</p>
    <EmBreve titulo="Prescrições" :fase="1" descricao="Lista, busca, favoritos e recentes." />
  </div>
</template>
