<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, ExternalLink } from '@lucide/vue'
import IconeCategoria from '@/components/categorias/IconeCategoria.vue'
import UsoCalculadora from '@/components/calculadoras/UsoCalculadora.vue'
import type { Calculadora } from '@/dominio/tipos'
import { cn } from '@/lib/utils'
import { useCategoriasStore } from '@/stores/categorias'

/** Calculadora ou escala ligada a uma prescrição: cartão recolhível com a tela de uso (nada digitado é salvo). */
const props = defineProps<{ calculadora: Calculadora; aberta?: boolean }>()
const categorias = useCategoriasStore()

const aberta = ref(props.aberta ?? false)
const idCorpo = computed(() => `calc-ligada-${props.calculadora.id}`)
const rota = computed(() => `/${props.calculadora.area === 'escala' ? 'escalas' : 'calculadoras'}/${props.calculadora.id}`)
const icone = computed(() => categorias.obter(props.calculadora.categoriaId)?.icone)
</script>

<template>
  <section class="bg-card flex flex-col rounded-lg shadow-xs" :aria-label="calculadora.nome">
    <div class="flex items-center gap-1 p-1.5">
      <button
        type="button"
        class="hover:bg-accent flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-full px-3 text-left transition-colors"
        :aria-expanded="aberta"
        :aria-controls="idCorpo"
        @click="aberta = !aberta"
      >
        <span class="bg-accent text-primary flex size-8 shrink-0 items-center justify-center rounded-xl">
          <IconeCategoria :icone="icone" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate font-bold">{{ calculadora.nome }}</span>
          <span class="text-muted-foreground block truncate text-xs">{{ categorias.nome(calculadora.categoriaId) }}</span>
        </span>
        <ChevronDown :class="cn('text-muted-foreground size-5 shrink-0 transition-transform', aberta && 'rotate-180')" aria-hidden="true" />
      </button>
      <RouterLink
        :to="rota"
        class="text-primary hover:bg-accent flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors"
        :aria-label="`Abrir ${calculadora.nome}`"
      >
        Abrir <ExternalLink class="size-4" aria-hidden="true" />
      </RouterLink>
    </div>
    <!-- v-show: recolher não apaga o que foi digitado enquanto a tela estiver aberta -->
    <div v-show="aberta" :id="idCorpo" class="border-border border-t p-4 md:p-5">
      <UsoCalculadora :calculadora="calculadora" />
    </div>
  </section>
</template>
