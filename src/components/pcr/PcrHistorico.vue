<script setup lang="ts">
import { ref } from 'vue'
import { Copy, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
import { contar, descreverEvento, formatarTempo, estadoDaParada, montarResumo, type RegistroPcr } from '@/dominio/pcr/pcr'
import { toast } from 'vue-sonner'

/** Lista de paradas já registradas: linha do tempo, resumo para copiar e, no celular, exclusão. */
defineProps<{ registros: RegistroPcr[]; podeExcluir?: boolean }>()
const emit = defineEmits<{ excluir: [id: string] }>()

const aberto = ref<string | null>(null)
const excluindo = ref<string | null>(null)

const quando = (ms: number) => new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const hora = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

async function copiar(registro: RegistroPcr) {
  try {
    await navigator.clipboard.writeText(montarResumo(registro))
    toast.success('Resumo copiado.')
  } catch {
    toast.error('Não consegui copiar. Tente de novo.')
  }
}
</script>

<template>
  <ul class="flex flex-col gap-3" aria-label="Paradas registradas">
    <li v-for="r in registros" :key="r.id" class="bg-card rounded-2xl border p-4">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 text-left"
        :aria-expanded="aberto === r.id"
        @click="aberto = aberto === r.id ? null : r.id"
      >
        <span class="font-semibold">PCR de {{ quando(r.iniciadoEm) }}</span>
        <span class="text-muted-foreground text-sm">
          {{ formatarTempo(estadoDaParada(r, r.encerradoEm ?? Date.now()).totalMs) }}
          · {{ contar(r).choques }} choque(s)
          <template v-if="r.encerradoEm === null"> · em andamento</template>
        </span>
      </button>

      <div v-if="aberto === r.id" class="mt-3 flex flex-col gap-3">
        <p class="text-muted-foreground text-sm">
          Epinefrina {{ contar(r).epinefrina }} · Amiodarona {{ contar(r).amiodarona }} · Lidocaína {{ contar(r).lidocaina }}
          · Via aérea avançada {{ contar(r).viaAerea }}
        </p>
        <ol class="flex flex-col gap-1 text-sm">
          <li v-for="e in r.eventos" :key="e.id" class="flex gap-3">
            <span class="text-muted-foreground w-24 shrink-0 tabular-nums">{{ hora(e.em) }} ({{ formatarTempo(e.em - r.iniciadoEm) }})</span>
            <span>{{ descreverEvento(r, e) }}</span>
          </li>
          <li v-if="!r.eventos.length" class="text-muted-foreground">Nenhuma marcação.</li>
        </ol>
        <div class="flex flex-wrap gap-2">
          <Button size="touch" variant="outline" @click="copiar(r)"><Copy /> Copiar resumo</Button>
          <Button v-if="podeExcluir" size="touch" variant="outline" @click="excluindo = r.id"><Trash2 /> Excluir</Button>
        </div>
      </div>
    </li>
  </ul>

  <DialogoConfirmar
    :aberto="excluindo !== null"
    titulo="Excluir este registro?"
    descricao="O registro da parada será apagado deste aparelho."
    rotulo-confirmar="Excluir"
    perigoso
    @update:aberto="(v: boolean) => !v && (excluindo = null)"
    @confirmar="excluindo && emit('excluir', excluindo)"
  />
</template>
