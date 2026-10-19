<script setup lang="ts">
import type { Component } from 'vue'
import { Folder, LayoutGrid } from '@lucide/vue'
import { ICONES_CATEGORIA } from '@/components/categorias/icones'
import type { ChaveLateral, EntradaLateral } from '@/dominio/biblioteca/lateral'
import { cn } from '@/lib/utils'

/**
 * Entradas da biblioteca: cartão vertical no PC (md+), fileira de pílulas rolável no celular.
 * `ativa` = null durante a busca (nenhuma entrada destacada).
 */
defineProps<{ entradas: EntradaLateral[]; ativa: ChaveLateral | null }>()
defineEmits<{ seleciona: [chave: ChaveLateral] }>()

function iconeDe(entrada: EntradaLateral): Component {
  if (entrada.icone && ICONES_CATEGORIA[entrada.icone]) return ICONES_CATEGORIA[entrada.icone]!.componente
  return entrada.chave === 'todas' ? LayoutGrid : Folder
}
</script>

<template>
  <nav
    class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:sticky md:top-24 md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible md:rounded-3xl md:bg-card md:p-3 md:pb-3 md:shadow-xs"
    aria-label="Grupos"
  >
    <button
      v-for="entrada in entradas"
      :key="entrada.chave"
      type="button"
      :aria-current="ativa === entrada.chave ? 'true' : undefined"
      :class="cn(
        'flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-xs transition-colors md:h-auto md:gap-2.5 md:rounded-2xl md:px-2.5 md:py-2 md:font-medium md:shadow-none',
        ativa === entrada.chave
          ? 'bg-primary text-primary-foreground md:bg-accent md:font-bold md:text-primary'
          : 'bg-card hover:bg-accent md:bg-transparent',
      )"
      @click="$emit('seleciona', entrada.chave)"
    >
      <span
        :class="cn(
          'grid shrink-0 place-items-center md:size-[30px] md:rounded-[10px]',
          ativa === entrada.chave ? 'md:bg-primary md:text-primary-foreground' : 'md:bg-background',
        )"
      >
        <component :is="iconeDe(entrada)" class="size-4" aria-hidden="true" />
      </span>
      <span class="truncate text-left">{{ entrada.rotulo }}</span>
      <span class="text-xs tabular-nums opacity-70 md:ml-auto">{{ entrada.quantidade }}</span>
    </button>
  </nav>
</template>
