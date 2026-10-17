<script lang="ts">
import { ref } from 'vue'

// Fora do setup: grupos recolhidos e filtro duram enquanto o app está aberto (um estado por lista).
const estados = new Map<string, { recolhidas: ReturnType<typeof ref<Set<string>>>; filtro: ReturnType<typeof ref<string | null>> }>()
function estadoDa(chave: string) {
  if (!estados.has(chave)) estados.set(chave, { recolhidas: ref(new Set<string>()), filtro: ref<string | null>(null) })
  return estados.get(chave)!
}
</script>

<script setup lang="ts" generic="T extends { id: string; categoriaId: string | null; titulo?: string; nome?: string; favorito: boolean; revisada?: boolean }">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, Clock, Plus, Star } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import IconeCategoria from '@/components/categorias/IconeCategoria.vue'
import LinhaItem from './LinhaItem.vue'
import { agruparPorCategoria, nomeDoItem } from '@/dominio/prescricoes/agrupar'
import type { Categoria } from '@/dominio/tipos'
import { cn } from '@/lib/utils'
import { MODO_PENDRIVE } from '@/modo'
import { ROTULO_SEM_CATEGORIA } from '@/stores/categorias'

/**
 * Lista com busca (?q=), chips de categoria, Recentes, Favoritos e grupos colapsáveis.
 * Usada por Prescrições e Calculadoras.
 */
const props = defineProps<{
  titulo: string
  /** Ex.: "/prescricoes" — itens em /prescricoes/:id, novo em /prescricoes/nova. */
  rotaBase: string
  rotuloNovo: string
  textoVazio: string
  itens: T[]
  categorias: Categoria[]
  recentesIds: string[]
  filtrar: (itens: T[], termo: string) => T[]
}>()

const SEM_CATEGORIA = '__sem__'
const { recolhidas, filtro: categoriaFiltro } = estadoDa(props.rotaBase)

const route = useRoute()
const termo = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''))
const buscando = computed(() => termo.value.length > 0)

const encontrados = computed(() => props.filtrar(props.itens, termo.value))
const grupos = computed(() => agruparPorCategoria(encontrados.value, props.categorias))

const chips = computed(() =>
  agruparPorCategoria(props.itens, props.categorias).map((g) => ({
    chave: g.categoria?.id ?? SEM_CATEGORIA,
    nome: g.categoria?.nome ?? ROTULO_SEM_CATEGORIA,
    icone: g.categoria?.icone ?? null,
    total: g.itens.length,
  })),
)

const gruposVisiveis = computed(() =>
  categoriaFiltro.value === null
    ? grupos.value
    : grupos.value.filter((g) => (g.categoria?.id ?? SEM_CATEGORIA) === categoriaFiltro.value),
)

const porId = computed(() => new Map(props.itens.map((i) => [i.id, i])))
const listaRecentes = computed(() => props.recentesIds.map((id) => porId.value.get(id)).filter((i): i is T => !!i))
const favoritos = computed(() =>
  props.itens.filter((i) => i.favorito).sort((a, b) => nomeDoItem(a).localeCompare(nomeDoItem(b), 'pt-BR')),
)
const mostrarAtalhos = computed(() => !buscando.value && categoriaFiltro.value === null)

function categoriaDe(item: T) {
  return props.categorias.find((c) => c.id === item.categoriaId && c.excluidoEm === null)
}

function chaveGrupo(categoriaId: string | undefined) {
  return categoriaId ?? SEM_CATEGORIA
}

function aberta(chave: string) {
  // Durante a busca todos os grupos ficam abertos para mostrar os resultados.
  return buscando.value || !recolhidas.value!.has(chave)
}

function alternarGrupo(chave: string) {
  const novo = new Set(recolhidas.value)
  if (novo.has(chave)) novo.delete(chave)
  else novo.add(chave)
  recolhidas.value = novo
}

function filtrarCategoria(chave: string | null) {
  categoriaFiltro.value = categoriaFiltro.value === chave ? null : chave
}
</script>

<template>
  <section class="flex flex-col gap-5">
    <div class="flex items-center justify-between gap-2">
      <h1 class="text-2xl font-semibold md:text-3xl">{{ titulo }}</h1>
      <Button v-if="!MODO_PENDRIVE" size="touch" class="hidden md:inline-flex" as-child>
        <RouterLink :to="`${rotaBase}/nova`"><Plus /> Nova</RouterLink>
      </Button>
    </div>

    <!-- Filtro por categoria -->
    <div
      v-if="chips.length > 1"
      class="-mx-4 -mt-1 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:-mx-8 md:px-8"
      role="group"
      aria-label="Filtrar por categoria"
    >
      <button
        type="button"
        :class="cn(
          'h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors',
          categoriaFiltro === null ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent',
        )"
        @click="categoriaFiltro = null"
      >
        Todas
      </button>
      <button
        v-for="chip in chips"
        :key="chip.chave"
        type="button"
        :aria-pressed="categoriaFiltro === chip.chave"
        :class="cn(
          'h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors',
          categoriaFiltro === chip.chave ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent',
        )"
        @click="filtrarCategoria(chip.chave)"
      >
        <span class="flex items-center gap-1.5">
          <IconeCategoria :icone="chip.icone" />
          {{ chip.nome }} <span class="opacity-70">{{ chip.total }}</span>
        </span>
      </button>
    </div>

    <p v-if="buscando" class="text-muted-foreground text-sm">
      {{ encontrados.length }} {{ encontrados.length === 1 ? 'resultado' : 'resultados' }} para “{{ termo }}”
    </p>

    <!-- Lista vazia -->
    <div
      v-if="itens.length === 0"
      class="text-muted-foreground bg-card flex flex-col items-center gap-4 rounded-2xl border border-dashed p-10 text-center"
    >
      <p>{{ textoVazio }}</p>
      <Button v-if="!MODO_PENDRIVE" size="touch" as-child>
        <RouterLink :to="`${rotaBase}/nova`"><Plus /> Criar a primeira</RouterLink>
      </Button>
    </div>

    <template v-else>
      <!-- Recentes -->
      <div v-if="mostrarAtalhos && listaRecentes.length" class="flex flex-col">
        <h2 class="text-muted-foreground flex items-center gap-2 px-3 pb-1 text-xs font-medium">
          <Clock class="size-3.5" /> Recentes
        </h2>
        <div class="flex flex-col">
          <LinhaItem
            v-for="item in listaRecentes"
            :key="item.id"
            :para="`${rotaBase}/${item.id}`"
            :titulo="nomeDoItem(item)"
            :favorito="item.favorito"
            :nao-revisada="item.revisada === false"
            :categoria="categoriaDe(item)?.nome ?? ROTULO_SEM_CATEGORIA"
            :icone-categoria="categoriaDe(item)?.icone"
          />
        </div>
      </div>

      <!-- Favoritos -->
      <div v-if="mostrarAtalhos && favoritos.length" class="flex flex-col">
        <h2 class="text-muted-foreground flex items-center gap-2 px-3 pb-1 text-xs font-medium">
          <Star class="size-3.5" /> Favoritos
        </h2>
        <div class="flex flex-col">
          <LinhaItem
            v-for="item in favoritos"
            :key="item.id"
            :para="`${rotaBase}/${item.id}`"
            :titulo="nomeDoItem(item)"
            :favorito="item.favorito"
            :nao-revisada="item.revisada === false"
            :categoria="categoriaDe(item)?.nome ?? ROTULO_SEM_CATEGORIA"
            :icone-categoria="categoriaDe(item)?.icone"
          />
        </div>
      </div>

      <!-- Todos, por categoria -->
      <div v-if="gruposVisiveis.length" class="flex flex-col gap-1">
        <div
          v-for="grupo in gruposVisiveis"
          :key="chaveGrupo(grupo.categoria?.id)"
          class="flex flex-col"
        >
          <button
            type="button"
            class="hover:bg-accent/70 flex h-11 w-full items-center gap-2 rounded-xl px-2 text-left transition-colors"
            :aria-expanded="aberta(chaveGrupo(grupo.categoria?.id))"
            @click="alternarGrupo(chaveGrupo(grupo.categoria?.id))"
          >
            <ChevronDown
              :class="cn('text-muted-foreground size-4 shrink-0 transition-transform', !aberta(chaveGrupo(grupo.categoria?.id)) && '-rotate-90')"
            />
            <IconeCategoria :icone="grupo.categoria?.icone" class="text-muted-foreground size-[18px]" />
            <span class="flex-1 text-sm font-semibold">{{ grupo.categoria?.nome ?? ROTULO_SEM_CATEGORIA }}</span>
            <span class="text-muted-foreground bg-secondary rounded-full px-2 py-0.5 text-xs">{{ grupo.itens.length }}</span>
          </button>
          <div v-show="aberta(chaveGrupo(grupo.categoria?.id))" class="flex flex-col pl-4">
            <LinhaItem
              v-for="item in grupo.itens"
              :key="item.id"
              :para="`${rotaBase}/${item.id}`"
              :titulo="nomeDoItem(item)"
              :favorito="item.favorito"
              :nao-revisada="item.revisada === false"
            />
          </div>
        </div>
      </div>

      <p v-if="buscando && encontrados.length === 0" class="text-muted-foreground py-6 text-center">Nada encontrado.</p>
    </template>

    <!-- Botão flutuante (celular) -->
    <Button
      v-if="!MODO_PENDRIVE"
      size="icon-touch"
      class="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 size-14 rounded-2xl shadow-lg md:hidden"
      :aria-label="rotuloNovo"
      as-child
    >
      <RouterLink :to="`${rotaBase}/nova`"><Plus class="size-6" /></RouterLink>
    </Button>
  </section>
</template>
