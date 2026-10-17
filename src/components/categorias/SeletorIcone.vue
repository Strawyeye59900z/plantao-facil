<script setup lang="ts">
import { ref } from 'vue'
import { ImageOff } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ICONES_CATEGORIA } from './icones'
import IconeCategoria from './IconeCategoria.vue'

/** Botão que mostra o ícone atual e abre a galeria para escolher outro. */
defineProps<{ nomeCategoria?: string }>()
const icone = defineModel<string | null>({ required: true })
const aberto = ref(false)

function escolher(chave: string | null) {
  icone.value = chave
  aberto.value = false
}
</script>

<template>
  <Button
    type="button"
    variant="outline"
    size="icon-touch"
    :aria-label="nomeCategoria ? `Ícone de ${nomeCategoria}` : 'Escolher ícone'"
    @click="aberto = true"
  >
    <IconeCategoria v-if="icone" :icone="icone" class="size-5" />
    <ImageOff v-else class="text-muted-foreground" />
  </Button>

  <Dialog v-model:open="aberto">
    <DialogContent class="max-h-[85dvh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Ícone{{ nomeCategoria ? ` de “${nomeCategoria}”` : '' }}</DialogTitle>
        <DialogDescription>Opcional. Aparece na lista, nos filtros e na prescrição.</DialogDescription>
      </DialogHeader>
      <div class="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
        <button
          type="button"
          :class="cn(
            'flex aspect-square items-center justify-center rounded-xl border',
            icone === null ? 'border-primary/50 bg-primary/10' : 'hover:bg-accent/70 border-transparent',
          )"
          aria-label="Sem ícone"
          title="Sem ícone"
          @click="escolher(null)"
        >
          <ImageOff class="text-muted-foreground size-5" />
        </button>
        <button
          v-for="(definicao, chave) in ICONES_CATEGORIA"
          :key="chave"
          type="button"
          :class="cn(
            'flex aspect-square items-center justify-center rounded-xl border',
            icone === chave ? 'border-primary/50 bg-primary/10 text-primary' : 'hover:bg-accent/70 border-transparent',
          )"
          :aria-label="definicao.rotulo"
          :aria-pressed="icone === chave"
          :title="definicao.rotulo"
          @click="escolher(chave)"
        >
          <component :is="definicao.componente" class="size-5" />
        </button>
      </div>
    </DialogContent>
  </Dialog>
</template>
