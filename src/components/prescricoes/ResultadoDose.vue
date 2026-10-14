<script setup lang="ts">
import { OctagonAlert, TriangleAlert } from '@lucide/vue'
import { TEXTO_AVISO_DOSE, type ResultadoDose } from '@/dominio/tipos'

/** Avisos (teto, peso limite) em destaque + memória de cálculo para conferência. */
defineProps<{ resultado: ResultadoDose }>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <p
      v-if="!resultado.ok"
      role="alert"
      class="border-critico bg-critico/12 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
    >
      <OctagonAlert class="text-critico size-4 shrink-0" /> {{ resultado.erro }}
    </p>
    <template v-else>
      <p
        v-for="aviso in resultado.avisos"
        :key="aviso"
        class="border-atencao bg-atencao/12 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold"
      >
        <TriangleAlert class="text-atencao size-4 shrink-0" /> {{ TEXTO_AVISO_DOSE[aviso] }}
      </p>
    </template>
    <div class="bg-muted/50 rounded-lg px-3 py-2">
      <p class="text-muted-foreground mb-0.5 text-xs font-semibold tracking-wide uppercase">Memória de cálculo</p>
      <p v-for="(linha, i) in resultado.memoria" :key="i" class="font-mono text-xs leading-relaxed">{{ linha }}</p>
    </div>
  </div>
</template>
