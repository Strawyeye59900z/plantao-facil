<script setup lang="ts" generic="T extends { id: string; categoriaId: string | null; titulo?: string; nome?: string; favorito: boolean }">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { filtrarPorChave, montarLateral, type ChaveLateral } from '@/dominio/biblioteca/lateral'
import { nomeDoItem } from '@/dominio/prescricoes/agrupar'
import type { Categoria } from '@/dominio/tipos'
import { MODO_PENDRIVE } from '@/modo'
import CartaoItem from './CartaoItem.vue'
import LateralGrupos from './LateralGrupos.vue'

/**
 * Biblioteca com lateral de grupos (pílulas no celular) e grade de cartões.
 * Usada por Prescrições e Calculadoras. Grupo selecionado em ?grupo= (padrão: todas); busca em ?q=.
 */
const props = defineProps<{
  /** Ex.: "/prescricoes" — itens em /prescricoes/:id, novo em /prescricoes/nova. */
  rotaBase: string
  rotuloNovo: string
  textoVazio: string
  /** Singular e plural do que a lista contém (ex.: "prescrição" / "prescrições"). */
  nomeItens: { um: string; varios: string }
  itens: T[]
  grupos: Categoria[]
  filtrar: (itens: T[], termo: string) => T[]
  /** Etiquetas e linha de meta do cartão. */
  descrever: (item: T) => { etiquetas: string[]; meta: string }
}>()

const colador = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

const route = useRoute()
const router = useRouter()

const termo = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''))
const buscando = computed(() => termo.value.length > 0)

const entradas = computed(() => montarLateral(props.itens, props.grupos))

// Grupo inexistente em ?grupo= (ex.: excluído) cai em "todas".
const chave = computed<ChaveLateral>(() => {
  const pedida = route.query.grupo
  return typeof pedida === 'string' && entradas.value.some((e) => e.chave === pedida) ? pedida : 'todas'
})
const entradaAtiva = computed(() => entradas.value.find((e) => e.chave === chave.value)!)

function selecionar(nova: ChaveLateral) {
  // Escolher um grupo encerra a busca (o campo do topo acompanha a rota).
  router.replace({ path: route.path, query: nova === 'todas' ? {} : { grupo: nova } })
}

const visiveis = computed(() => {
  const lista = buscando.value ? props.filtrar(props.itens, termo.value) : filtrarPorChave(props.itens, chave.value, props.grupos)
  return [...lista].sort((a, b) => colador.compare(nomeDoItem(a), nomeDoItem(b)))
})

const titulo = computed(() => (buscando.value ? 'Resultados' : entradaAtiva.value.rotulo))
const subtitulo = computed(() => {
  const n = visiveis.value.length
  const base = `${n} ${n === 1 ? props.nomeItens.um : props.nomeItens.varios}`
  return buscando.value ? `${base} para “${termo.value}”` : base
})
const textoSemItens = computed(() => {
  if (buscando.value) return 'Nada encontrado.'
  return chave.value === 'favoritos' ? 'Nenhum favorito ainda.' : 'Nenhum item neste grupo.'
})
</script>

<template>
  <section class="flex flex-col gap-4 md:grid md:grid-cols-[220px_1fr] md:items-start md:gap-5">
    <LateralGrupos :entradas="entradas" :ativa="buscando ? null : chave" @seleciona="selecionar" />

    <div class="flex min-w-0 flex-col gap-4">
      <div class="flex items-end justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-3xl leading-tight font-extrabold tracking-tight md:text-4xl">{{ titulo }}</h1>
          <p class="text-muted-foreground text-sm">{{ subtitulo }}</p>
        </div>
        <!-- No celular só o "+" (o rótulo fica para leitores de tela), para o título não ser cortado. -->
        <Button v-if="!MODO_PENDRIVE" size="touch" class="max-sm:size-11 max-sm:px-0 shrink-0" as-child>
          <RouterLink :to="`${rotaBase}/nova`">
            <Plus /> <span class="max-sm:sr-only">{{ rotuloNovo }}</span>
          </RouterLink>
        </Button>
      </div>

      <!-- Biblioteca vazia -->
      <div
        v-if="itens.length === 0"
        class="text-muted-foreground bg-card flex flex-col items-center gap-4 rounded-3xl p-10 text-center"
      >
        <p>{{ textoVazio }}</p>
        <Button v-if="!MODO_PENDRIVE" size="touch" as-child>
          <RouterLink :to="`${rotaBase}/nova`"><Plus /> Criar a primeira</RouterLink>
        </Button>
      </div>

      <p v-else-if="visiveis.length === 0" class="text-muted-foreground py-6 text-center">{{ textoSemItens }}</p>

      <div v-else class="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        <CartaoItem
          v-for="item in visiveis"
          :key="item.id"
          :para="`${rotaBase}/${item.id}`"
          :titulo="nomeDoItem(item)"
          :favorito="item.favorito"
          :etiquetas="descrever(item).etiquetas"
          :meta="descrever(item).meta"
        />
      </div>
    </div>
  </section>
</template>
