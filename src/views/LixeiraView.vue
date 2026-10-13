<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { RotateCcw, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
import type { Prescricao } from '@/dominio/tipos'
import { useCategoriasStore } from '@/stores/categorias'
import { usePrescricoesStore } from '@/stores/prescricoes'

const prescricoes = usePrescricoesStore()
const categorias = useCategoriasStore()

const paraExcluir = ref<Prescricao | null>(null)
const confirmar = computed({
  get: () => paraExcluir.value !== null,
  set: (aberto) => {
    if (!aberto) paraExcluir.value = null
  },
})

function dataExclusao(p: Prescricao) {
  return new Date(p.excluidoEm!).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

async function restaurar(p: Prescricao) {
  await prescricoes.restaurar(p.id)
  toast.success(`“${p.titulo}” restaurada.`)
}

async function excluirDeVez() {
  if (!paraExcluir.value) return
  await prescricoes.excluirPermanentemente(paraExcluir.value.id)
  paraExcluir.value = null
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-2xl font-semibold">Lixeira</h1>

    <p v-if="prescricoes.lixeira.length === 0" class="text-muted-foreground py-6 text-center">A lixeira está vazia.</p>

    <ul v-else class="bg-card ring-foreground/10 divide-y overflow-hidden rounded-xl ring-1">
      <li v-for="p in prescricoes.lixeira" :key="p.id" class="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
        <RouterLink :to="`/prescricoes/${p.id}`" class="min-w-0 flex-1">
          <p class="truncate font-medium">{{ p.titulo }}</p>
          <p class="text-muted-foreground text-xs">
            {{ categorias.nome(p.categoriaId) }} · excluída em {{ dataExclusao(p) }}
          </p>
        </RouterLink>
        <div class="flex gap-2">
          <Button variant="outline" size="touch" class="flex-1" @click="restaurar(p)"><RotateCcw /> Restaurar</Button>
          <Button variant="destructive" size="touch" class="flex-1" @click="paraExcluir = p">
            <Trash2 /> Excluir de vez
          </Button>
        </div>
      </li>
    </ul>

    <DialogoConfirmar
      v-model:aberto="confirmar"
      titulo="Excluir permanentemente?"
      :descricao="`“${paraExcluir?.titulo}” será apagada deste aparelho. Não é possível desfazer.`"
      rotulo-confirmar="Excluir permanentemente"
      perigoso
      @confirmar="excluirDeVez"
    />
  </section>
</template>
