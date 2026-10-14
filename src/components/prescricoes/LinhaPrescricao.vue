<script setup lang="ts">
import { ChevronRight, Star } from '@lucide/vue'
import type { Prescricao } from '@/dominio/tipos'
import IconeCategoria from '@/components/categorias/IconeCategoria.vue'

defineProps<{
  prescricao: Prescricao
  /** Mostra o nome da categoria (nas seções Recentes e Favoritos). */
  categoria?: string
  iconeCategoria?: string | null
}>()
</script>

<template>
  <RouterLink
    :to="`/prescricoes/${prescricao.id}`"
    class="hover:bg-muted/60 active:bg-muted flex min-h-14 items-center gap-3 px-4 py-2"
  >
    <div class="min-w-0 flex-1">
      <p class="truncate text-base font-medium">{{ prescricao.titulo }}</p>
      <p v-if="categoria || !prescricao.revisada" class="flex flex-wrap items-center gap-x-2 text-xs">
        <span v-if="categoria" class="text-muted-foreground flex items-center gap-1">
          <IconeCategoria :icone="iconeCategoria" class="size-3.5" />{{ categoria }}
        </span>
        <span v-if="!prescricao.revisada" class="text-atencao font-medium">Importada — não revisada</span>
      </p>
    </div>
    <Star v-if="prescricao.favorito" class="fill-atencao text-atencao size-4 shrink-0" aria-label="Favorita" />
    <ChevronRight class="text-muted-foreground size-5 shrink-0" />
  </RouterLink>
</template>
