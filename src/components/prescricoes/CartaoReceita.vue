<script setup lang="ts">
import { ClipboardCopy } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { copiarTexto } from '@/lib/areaTransferencia'

/** Receita de alta: texto em fonte mono, com as quebras preservadas; "Copiar receita" copia exatamente o cadastrado. */
const props = defineProps<{ receita: string }>()

async function copiar() {
  try {
    await copiarTexto(props.receita)
    toast.success('Receita copiada.')
  } catch {
    toast.error('Não foi possível copiar.')
  }
}
</script>

<template>
  <section aria-labelledby="titulo-receita" class="bg-card flex flex-col gap-3 rounded-lg p-4 shadow-xs md:p-5">
    <h2 id="titulo-receita" class="text-muted-foreground text-xs font-semibold">Receita de alta</h2>
    <pre class="bg-secondary/70 rounded-2xl p-3.5 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap">{{ receita }}</pre>
    <Button size="touch" class="bg-foreground text-background hover:bg-foreground/90 self-start rounded-full font-semibold" @click="copiar">
      <ClipboardCopy /> Copiar receita
    </Button>
  </section>
</template>
