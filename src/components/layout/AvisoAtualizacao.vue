<script setup lang="ts">
import { watch } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { RefreshCw, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'

// registerType 'prompt': a nova versão só é ativada quando o usuário toca em "Atualizar",
// para não recarregar a tela no meio do uso.
const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW()

// "Pronto para uso offline" é só informativo: some sozinho.
watch(offlineReady, (pronto) => {
  if (pronto) setTimeout(() => (offlineReady.value = false), 4000)
})

function fechar() {
  offlineReady.value = false
  needRefresh.value = false
}
</script>

<template>
  <div
    v-if="offlineReady || needRefresh"
    role="alert"
    class="bg-card text-card-foreground border shadow-xs fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 rounded-2xl p-3 shadow-lg md:inset-x-auto md:right-6 md:bottom-6 md:max-w-sm"
  >
    <p class="flex-1 text-sm">
      {{ needRefresh ? 'Nova versão disponível.' : 'Pronto para uso offline.' }}
    </p>
    <Button v-if="needRefresh" size="touch" @click="updateServiceWorker()">
      <RefreshCw />
      Atualizar
    </Button>
    <Button variant="ghost" size="icon-touch" aria-label="Fechar aviso" @click="fechar">
      <X />
    </Button>
  </div>
</template>
