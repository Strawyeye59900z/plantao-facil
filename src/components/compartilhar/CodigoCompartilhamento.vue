<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { Copy, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { copiarTexto } from '@/lib/areaTransferencia'
import type { Compartilhamento } from '@/lib/compartilhar/compartilhar'

/** Mostra o código de um compartilhamento recém-criado para o médico passar ao colega. */
const props = defineProps<{
  compartilhamento: Compartilhamento | null
  /** Ex.: "3 prescrições". */
  descricao: string
}>()
const aberto = defineModel<boolean>('aberto', { required: true })
const emit = defineEmits<{ cancelar: [] }>()

const validade = computed(() =>
  props.compartilhamento
    ? props.compartilhamento.expiraEm.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : '',
)

const convite = computed(
  () =>
    `Código do Plantão Fácil: ${props.compartilhamento?.codigo}\nVale até ${validade.value}. No app: menu → Receber de colega, e digite o código.`,
)

async function copiar(texto: string, aviso: string) {
  try {
    await copiarTexto(texto)
    toast.success(aviso)
  } catch {
    toast.error('Não consegui copiar. Anote o código.')
  }
}
</script>

<template>
  <Dialog v-model:open="aberto">
    <DialogContent v-if="compartilhamento">
      <DialogHeader>
        <DialogTitle>Código para o colega</DialogTitle>
        <DialogDescription>
          {{ descricao }} prontas para receber. O colega digita o código no app, em <strong>menu → Receber de colega</strong>.
          Vários colegas podem usar o mesmo código.
        </DialogDescription>
      </DialogHeader>

      <p class="text-primary text-center font-mono text-4xl font-bold tracking-widest" aria-label="Código de compartilhamento">
        {{ compartilhamento.codigo }}
      </p>
      <p class="text-muted-foreground text-center text-sm">Vale até {{ validade }} (7 dias).</p>

      <div class="flex flex-col gap-2">
        <Button size="touch" @click="copiar(compartilhamento.codigo, 'Código copiado.')"><Copy /> Copiar código</Button>
        <Button size="touch" variant="outline" @click="copiar(convite, 'Mensagem copiada.')">Copiar mensagem com instruções</Button>
        <Button size="touch" variant="ghost" class="text-destructive" @click="emit('cancelar')">
          <Trash2 /> Cancelar compartilhamento
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
