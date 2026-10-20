<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { RotateCcw, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
import type { ISODate, UUID } from '@/dominio/tipos'
import { useCalculadorasStore } from '@/stores/calculadoras'
import { useCategoriasStore } from '@/stores/categorias'
import { usePrescricoesStore } from '@/stores/prescricoes'

const prescricoes = usePrescricoesStore()
const calculadoras = useCalculadorasStore()
const categorias = useCategoriasStore()

interface ItemLixeira {
  id: UUID
  tipo: 'prescricao' | 'calculadora' | 'escala'
  nome: string
  categoriaId: UUID | null
  excluidoEm: ISODate
}

/** Prescrições, calculadoras e escalas na lixeira, mais recentes primeiro. */
const itens = computed<ItemLixeira[]>(() =>
  [
    ...prescricoes.lixeira.map((p) => ({ id: p.id, tipo: 'prescricao' as const, nome: p.titulo, categoriaId: p.categoriaId, excluidoEm: p.excluidoEm! })),
    ...calculadoras.lixeira.map((c) => ({ id: c.id, tipo: c.area, nome: c.nome, categoriaId: c.categoriaId, excluidoEm: c.excluidoEm! })),
  ].sort((a, b) => b.excluidoEm.localeCompare(a.excluidoEm)),
)

const store = (item: ItemLixeira) => (item.tipo === 'prescricao' ? prescricoes : calculadoras)
const ROTA: Record<ItemLixeira['tipo'], string> = { prescricao: 'prescricoes', calculadora: 'calculadoras', escala: 'escalas' }
const ROTULO: Record<ItemLixeira['tipo'], string> = { prescricao: 'Prescrição', calculadora: 'Calculadora', escala: 'Escala' }
const rota = (item: ItemLixeira) => `/${ROTA[item.tipo]}/${item.id}`

const paraExcluir = ref<ItemLixeira | null>(null)
const confirmar = computed({
  get: () => paraExcluir.value !== null,
  set: (aberto) => {
    if (!aberto) paraExcluir.value = null
  },
})

function dataExclusao(item: ItemLixeira) {
  return new Date(item.excluidoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

async function restaurar(item: ItemLixeira) {
  await store(item).restaurar(item.id)
  toast.success(`“${item.nome}” restaurada.`)
}

async function excluirDeVez() {
  if (!paraExcluir.value) return
  await store(paraExcluir.value).excluirPermanentemente(paraExcluir.value.id)
  paraExcluir.value = null
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-2xl font-semibold md:text-3xl">Lixeira</h1>

    <p v-if="itens.length === 0" class="text-muted-foreground py-6 text-center">A lixeira está vazia.</p>

    <ul v-else class="bg-card border shadow-xs divide-y overflow-hidden rounded-2xl">
      <li v-for="item in itens" :key="item.id" class="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
        <RouterLink :to="rota(item)" class="min-w-0 flex-1">
          <p class="truncate font-medium">{{ item.nome }}</p>
          <p class="text-muted-foreground text-xs">
            {{ ROTULO[item.tipo] }} · {{ categorias.nome(item.categoriaId) }} ·
            excluída em {{ dataExclusao(item) }}
          </p>
        </RouterLink>
        <div class="flex gap-2">
          <Button variant="outline" size="touch" class="flex-1" @click="restaurar(item)"><RotateCcw /> Restaurar</Button>
          <Button variant="destructive" size="touch" class="flex-1" @click="paraExcluir = item">
            <Trash2 /> Excluir de vez
          </Button>
        </div>
      </li>
    </ul>

    <DialogoConfirmar
      v-model:aberto="confirmar"
      titulo="Excluir permanentemente?"
      :descricao="`“${paraExcluir?.nome}” será apagada deste aparelho. Não é possível desfazer.`"
      rotulo-confirmar="Excluir permanentemente"
      perigoso
      @confirmar="excluirDeVez"
    />
  </section>
</template>
