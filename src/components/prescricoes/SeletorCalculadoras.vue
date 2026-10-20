<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, Plus, Search, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import IconeCategoria from '@/components/categorias/IconeCategoria.vue'
import { filtrarCalculadoras } from '@/dominio/calculadoras/busca'
import { moverItem } from '@/dominio/prescricoes/editar'
import type { AreaCalculadora, Calculadora, UUID } from '@/dominio/tipos'
import { useCalculadorasStore } from '@/stores/calculadoras'
import { useCategoriasStore } from '@/stores/categorias'

/** Escolha das calculadoras e escalas ligadas a uma prescrição; a ordem da lista é a ordem na aba. */
const props = defineProps<{ idCampo: string }>()
const ids = defineModel<UUID[]>({ required: true })

const calculadoras = useCalculadorasStore()
const categorias = useCategoriasStore()
const busca = ref('')

const AREAS: { area: AreaCalculadora; titulo: string }[] = [
  { area: 'calculadora', titulo: 'Calculadoras' },
  { area: 'escala', titulo: 'Escalas' },
]

const ligadas = computed(() =>
  ids.value.map((id) => ({ id, item: calculadoras.obter(id) })),
)

const disponiveis = computed(() => {
  const jaLigadas = new Set(ids.value)
  const lista = calculadoras.ativas.filter((c) => !jaLigadas.has(c.id))
  return filtrarCalculadoras(lista, busca.value, (cid) => categorias.nome(cid)).sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR'),
  )
})
const porArea = computed(() =>
  AREAS.map((a) => ({ ...a, itens: disponiveis.value.filter((c) => c.area === a.area) })).filter((a) => a.itens.length),
)

const iconeDe = (c: Calculadora) => categorias.obter(c.categoriaId)?.icone

function adicionar(id: UUID) {
  ids.value = [...ids.value, id]
}
function remover(id: UUID) {
  ids.value = ids.value.filter((x) => x !== id)
}
function mover(indice: number, direcao: -1 | 1) {
  ids.value = moverItem(ids.value, indice, direcao)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <ul v-if="ligadas.length" class="flex flex-col gap-2" aria-label="Calculadoras e escalas ligadas">
      <li
        v-for="(l, i) in ligadas"
        :key="l.id"
        class="border-border flex items-center gap-1 rounded-2xl border py-1 pr-1 pl-3"
      >
        <IconeCategoria :icone="l.item ? iconeDe(l.item) : null" class="text-primary" />
        <span class="min-w-0 flex-1 text-sm font-semibold">
          {{ l.item?.nome ?? 'Calculadora não encontrada' }}
          <span v-if="l.item?.excluidoEm" class="text-muted-foreground font-normal"> (na lixeira)</span>
          <span v-else-if="l.item" class="text-muted-foreground font-normal">
            · {{ l.item.area === 'escala' ? 'Escala' : 'Calculadora' }}
          </span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          class="rounded-full"
          :disabled="i === 0"
          :aria-label="`Mover ${l.item?.nome ?? 'item'} para cima`"
          @click="mover(i, -1)"
        >
          <ArrowUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          class="rounded-full"
          :disabled="i === ligadas.length - 1"
          :aria-label="`Mover ${l.item?.nome ?? 'item'} para baixo`"
          @click="mover(i, 1)"
        >
          <ArrowDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          class="rounded-full"
          :aria-label="`Desligar ${l.item?.nome ?? 'item'}`"
          @click="remover(l.id)"
        >
          <Trash2 class="text-destructive" />
        </Button>
      </li>
    </ul>

    <div class="relative">
      <Search class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
      <Input
        :id="props.idCampo"
        v-model="busca"
        type="search"
        class="h-11 pl-9"
        placeholder="Buscar calculadora ou escala"
        aria-label="Buscar calculadora ou escala"
        autocomplete="off"
      />
    </div>

    <p v-if="!calculadoras.ativas.length" class="text-muted-foreground text-sm">
      Nenhuma calculadora ou escala cadastrada ainda.
    </p>
    <p v-else-if="!porArea.length" class="text-muted-foreground text-sm">
      {{ busca.trim() ? 'Nada encontrado.' : 'Todas já estão ligadas.' }}
    </p>
    <div v-for="grupo in porArea" :key="grupo.area" class="flex flex-col gap-1">
      <h3 class="text-muted-foreground text-xs font-semibold">{{ grupo.titulo }}</h3>
      <ul class="flex max-h-64 flex-col gap-1 overflow-y-auto">
        <li v-for="c in grupo.itens" :key="c.id">
          <button
            type="button"
            class="hover:bg-accent flex min-h-11 w-full items-center gap-2 rounded-2xl px-3 text-left text-sm transition-colors"
            :aria-label="`Ligar ${c.nome}`"
            @click="adicionar(c.id)"
          >
            <IconeCategoria :icone="iconeDe(c)" class="text-primary" />
            <span class="min-w-0 flex-1 font-semibold">{{ c.nome }}</span>
            <span class="text-muted-foreground max-w-[40%] truncate text-xs">{{ categorias.nome(c.categoriaId) }}</span>
            <Plus class="text-primary size-4 shrink-0" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
