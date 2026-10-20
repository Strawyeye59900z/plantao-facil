<script setup lang="ts">
import { RefreshCw, TriangleAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import LogoApp from '@/components/layout/LogoApp.vue'
import { MENSAGEM_FALHA_ABERTURA } from '@/abertura'

/** Montada no lugar do app quando o banco do aparelho não abre (ver `montarApp`). */
function recarregar() {
  location.reload()
}
</script>

<template>
  <main class="bg-background text-foreground flex min-h-dvh items-center justify-center px-4 py-8">
    <section class="bg-card flex w-full max-w-md flex-col items-center gap-4 rounded-3xl p-6 text-center shadow-xs" role="alert">
      <LogoApp class="size-12" />
      <div class="border-atencao/45 bg-atencao/12 flex flex-col items-center gap-3 rounded-2xl border p-4">
        <TriangleAlert class="text-atencao size-6" />
        <p class="leading-relaxed font-medium">{{ MENSAGEM_FALHA_ABERTURA }}</p>
      </div>
      <Button size="touch" class="rounded-full" @click="recarregar"><RefreshCw /> Recarregar</Button>
    </section>
  </main>
</template>
