<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { HeartPulse } from '@lucide/vue'
import { formatarTempo } from '@/dominio/pcr/pcr'
import { MODO_PENDRIVE } from '@/modo'
import { usePcrStore } from '@/stores/pcr'

/**
 * Botão flutuante e meio transparente que leva à tela de PCR de qualquer lugar do app, só no celular.
 * Fica de fora da transcrição e da própria tela de PCR. Com uma parada em andamento mostra o tempo e
 * pisca quando há alerta (checagem de ritmo ou epinefrina).
 */
const ehCelular = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
const route = useRoute()
const pcr = usePcrStore()

const visivel = computed(
  () => ehCelular && !MODO_PENDRIVE && route.path !== '/pcr' && route.path !== '/anamnese/transcricao' && route.meta.telaCheia !== true,
)
</script>

<template>
  <RouterLink
    v-if="visivel"
    to="/pcr"
    :aria-label="pcr.ativa ? `PCR em andamento, ${formatarTempo(pcr.estado?.totalMs ?? 0)}` : 'Abrir PCR'"
    class="fixed right-4 z-30 flex h-12 min-w-12 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold shadow-lg backdrop-blur-sm transition-opacity bottom-[max(1rem,env(safe-area-inset-bottom))]"
    :class="[
      pcr.ativa ? 'opacity-90' : 'opacity-50 active:opacity-100',
      pcr.alerta ? 'bg-critico text-critico-foreground animate-pulse' : 'bg-primary text-primary-foreground',
    ]"
  >
    <HeartPulse class="size-5" />
    <span v-if="pcr.ativa" class="tabular-nums">{{ formatarTempo(pcr.estado?.totalMs ?? 0) }}</span>
  </RouterLink>
</template>
