<script setup lang="ts">
import { ChevronRight, Star } from '@lucide/vue'
import IconeCategoria from '@/components/categorias/IconeCategoria.vue'

/** Linha das listas de prescrições e calculadoras. */
defineProps<{
  para: string
  titulo: string
  favorito: boolean
  /** Prescrição importada e ainda não revisada. */
  naoRevisada?: boolean
  /** Mostra o nome da categoria (nas seções Recentes e Favoritos). */
  categoria?: string
  iconeCategoria?: string | null
}>()
</script>

<template>
  <RouterLink :to="para" class="hover:bg-muted/60 active:bg-muted flex min-h-14 items-center gap-3 px-4 py-2">
    <div class="min-w-0 flex-1">
      <p class="truncate text-base font-medium">{{ titulo }}</p>
      <p v-if="categoria || naoRevisada" class="flex flex-wrap items-center gap-x-2 text-xs">
        <span v-if="categoria" class="text-muted-foreground flex items-center gap-1">
          <IconeCategoria :icone="iconeCategoria" class="size-3.5" />{{ categoria }}
        </span>
        <span v-if="naoRevisada" class="text-atencao font-medium">Importada — não revisada</span>
      </p>
    </div>
    <Star v-if="favorito" class="fill-atencao text-atencao size-4 shrink-0" aria-label="Favorita" />
    <ChevronRight class="text-muted-foreground size-5 shrink-0" />
  </RouterLink>
</template>
