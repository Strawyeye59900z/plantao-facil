<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { Check, Star } from '@lucide/vue'
import { cn } from '@/lib/utils'
import { ETIQUETA_REVISAR } from './etiquetas'

/**
 * Cartão de uma prescrição ou calculadora na grade da biblioteca.
 * Com `selecionavel`, segurar o cartão inicia a seleção; com `selecionando`, tocar marca/desmarca em vez de abrir.
 */
const props = defineProps<{
  para: string
  titulo: string
  favorito: boolean
  etiquetas: string[]
  meta: string
  selecionavel?: boolean
  selecionando?: boolean
  marcado?: boolean
}>()
const emit = defineEmits<{ alternar: []; segurar: [] }>()

const TOQUE_LONGO_MS = 450
const MOVIMENTO_MAXIMO_PX = 10
let temporizador: number | undefined
let origem = { x: 0, y: 0 }
let segurou = false

function iniciar(e: PointerEvent) {
  if (!props.selecionavel || props.selecionando || (e.pointerType === 'mouse' && e.button !== 0)) return
  segurou = false
  origem = { x: e.clientX, y: e.clientY }
  temporizador = window.setTimeout(() => {
    segurou = true
    emit('segurar')
  }, TOQUE_LONGO_MS)
}
function mover(e: PointerEvent) {
  if (Math.hypot(e.clientX - origem.x, e.clientY - origem.y) > MOVIMENTO_MAXIMO_PX) cancelar()
}
function cancelar() {
  clearTimeout(temporizador)
}
function aoClicar(e: MouseEvent) {
  if (segurou) {
    // O dedo levantou depois do toque longo (que já marcou o cartão): não abre nem desmarca.
    e.preventDefault()
    e.stopPropagation()
    segurou = false
  } else if (props.selecionando) {
    e.preventDefault()
    e.stopPropagation()
    emit('alternar')
  }
}
// Em alguns navegadores o toque longo abre o menu do link; aqui ele inicia a seleção.
function aoMenu(e: Event) {
  if (props.selecionavel) e.preventDefault()
}

onBeforeUnmount(cancelar)
</script>

<template>
  <div
    @click.capture="aoClicar"
    @pointerdown="iniciar"
    @pointermove="mover"
    @pointerup="cancelar"
    @pointercancel="cancelar"
    @pointerleave="cancelar"
    @contextmenu="aoMenu"
  >
    <RouterLink
      :to="para"
      :role="selecionando ? 'checkbox' : undefined"
      :aria-checked="selecionando ? !!marcado : undefined"
      :draggable="selecionavel ? false : undefined"
      :class="cn(
        'bg-card hover:bg-accent/60 active:bg-accent flex min-h-24 flex-col gap-1.5 rounded-[1.125rem] p-4 shadow-xs transition-colors select-none',
        marcado && 'ring-primary bg-accent/60 ring-2',
      )"
    >
      <div v-if="etiquetas.length" class="flex flex-wrap gap-1.5">
        <span
          v-for="etiqueta in etiquetas"
          :key="etiqueta"
          :class="cn(
            'rounded-full px-2.5 py-0.5 text-xs font-semibold',
            etiqueta === ETIQUETA_REVISAR ? 'bg-atencao-suave text-atencao-suave-foreground' : 'bg-accent text-primary',
          )"
        >
          {{ etiqueta }}
        </span>
      </div>
      <div class="flex items-start gap-2">
        <span
          v-if="selecionando"
          :class="cn(
            'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2',
            marcado ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/50',
          )"
          aria-hidden="true"
        >
          <Check v-if="marcado" class="size-3.5" />
        </span>
        <p class="min-w-0 flex-1 text-[15px] leading-snug font-bold break-words">{{ titulo }}</p>
        <Star v-if="favorito" class="fill-atencao text-atencao mt-0.5 size-4 shrink-0" aria-label="Favorito" />
      </div>
      <p v-if="meta" class="text-muted-foreground text-xs">{{ meta }}</p>
    </RouterLink>
  </div>
</template>
