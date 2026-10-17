<script setup lang="ts">
import { Star } from '@lucide/vue'
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
  <RouterLink :to="para" class="hover:bg-accent/70 active:bg-accent flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 transition-colors">
    <div class="min-w-0 flex-1">
      <p class="truncate text-[15px]">{{ titulo }}</p>
      <p v-if="categoria || naoRevisada" class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
        <span v-if="categoria" class="text-muted-foreground flex items-center gap-1">
          <IconeCategoria :icone="iconeCategoria" class="size-3.5" />{{ categoria }}
        </span>
        <span v-if="naoRevisada" class="text-atencao-foreground bg-atencao/25 rounded-full px-2 py-px font-medium dark:text-atencao dark:bg-atencao/15">Importada — não revisada</span>
      </p>
    </div>
    <Star v-if="favorito" class="fill-atencao text-atencao size-4 shrink-0" aria-label="Favorita" />
  </RouterLink>
</template>
