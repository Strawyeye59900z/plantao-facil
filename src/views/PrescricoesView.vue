<script lang="ts">
import { ref } from 'vue'

// Fora do setup: o estado dos grupos recolhidos dura enquanto o app está aberto.
const recolhidas = ref(new Set<string>())
const categoriaFiltro = ref<string | null>(null)
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, Clock, Plus, Star } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import LinhaPrescricao from '@/components/prescricoes/LinhaPrescricao.vue'
import IconeCategoria from '@/components/categorias/IconeCategoria.vue'
import { agruparPorCategoria } from '@/dominio/prescricoes/agrupar'
import { filtrarPrescricoes } from '@/dominio/prescricoes/busca'
import type { Prescricao } from '@/dominio/tipos'
import { cn } from '@/lib/utils'
import { ROTULO_SEM_CATEGORIA, useCategoriasStore } from '@/stores/categorias'
import { usePrescricoesStore } from '@/stores/prescricoes'
import { useRecentesStore } from '@/stores/recentes'
import { MODO_PENDRIVE } from '@/modo'

const SEM_CATEGORIA = '__sem__'

const route = useRoute()
const prescricoes = usePrescricoesStore()
const categorias = useCategoriasStore()
const recentes = useRecentesStore()

const termo = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''))
const buscando = computed(() => termo.value.length > 0)

const encontradas = computed(() =>
  filtrarPrescricoes(prescricoes.ativas, termo.value, (id) => categorias.obter(id)?.nome ?? ''),
)

const grupos = computed(() => agruparPorCategoria(encontradas.value, categorias.dePrescricoes))

const chips = computed(() =>
  agruparPorCategoria(prescricoes.ativas, categorias.dePrescricoes).map((g) => ({
    chave: g.categoria?.id ?? SEM_CATEGORIA,
    nome: g.categoria?.nome ?? ROTULO_SEM_CATEGORIA,
    icone: g.categoria?.icone ?? null,
    total: g.prescricoes.length,
  })),
)

const gruposVisiveis = computed(() =>
  categoriaFiltro.value === null
    ? grupos.value
    : grupos.value.filter((g) => (g.categoria?.id ?? SEM_CATEGORIA) === categoriaFiltro.value),
)

const listaRecentes = computed(() =>
  recentes
    .ids('prescricao')
    .map((id) => prescricoes.obter(id))
    .filter((p): p is Prescricao => !!p && p.excluidoEm === null),
)

const mostrarAtalhos = computed(() => !buscando.value && categoriaFiltro.value === null)

function chaveGrupo(categoriaId: string | undefined) {
  return categoriaId ?? SEM_CATEGORIA
}

function aberta(chave: string) {
  // Durante a busca todos os grupos ficam abertos para mostrar os resultados.
  return buscando.value || !recolhidas.value.has(chave)
}

function alternarGrupo(chave: string) {
  const novo = new Set(recolhidas.value)
  if (novo.has(chave)) novo.delete(chave)
  else novo.add(chave)
  recolhidas.value = novo
}

function filtrar(chave: string | null) {
  categoriaFiltro.value = categoriaFiltro.value === chave ? null : chave
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-2">
      <h1 class="text-2xl font-semibold">Prescrições</h1>
      <Button v-if="!MODO_PENDRIVE" size="touch" class="hidden md:inline-flex" as-child>
        <RouterLink to="/prescricoes/nova"><Plus /> Nova</RouterLink>
      </Button>
    </div>

    <!-- Filtro por categoria -->
    <div
      v-if="chips.length > 1"
      class="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]"
      role="group"
      aria-label="Filtrar por categoria"
    >
      <button
        type="button"
        :class="cn(
          'h-9 shrink-0 rounded-full border px-4 text-sm font-medium',
          categoriaFiltro === null ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted',
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
          'h-9 shrink-0 rounded-full border px-4 text-sm font-medium',
          categoriaFiltro === chip.chave ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted',
        )"
        @click="filtrar(chip.chave)"
      >
        <span class="flex items-center gap-1.5">
          <IconeCategoria :icone="chip.icone" />
          {{ chip.nome }} <span class="opacity-70">{{ chip.total }}</span>
        </span>
      </button>
    </div>

    <p v-if="buscando" class="text-muted-foreground text-sm">
      {{ encontradas.length }} {{ encontradas.length === 1 ? 'resultado' : 'resultados' }} para “{{ termo }}”
    </p>

    <!-- Lista vazia -->
    <div
      v-if="prescricoes.ativas.length === 0"
      class="text-muted-foreground flex flex-col items-center gap-4 rounded-xl border border-dashed p-8 text-center"
    >
      <p>Nenhuma prescrição cadastrada.</p>
      <Button v-if="!MODO_PENDRIVE" size="touch" as-child>
        <RouterLink to="/prescricoes/nova"><Plus /> Criar a primeira</RouterLink>
      </Button>
    </div>

    <template v-else>
      <!-- Recentes -->
      <div v-if="mostrarAtalhos && listaRecentes.length" class="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <h2 class="text-muted-foreground flex items-center gap-2 px-4 pt-3 pb-1 text-xs font-semibold tracking-wide uppercase">
          <Clock class="size-4" /> Recentes
        </h2>
        <div class="divide-y">
          <LinhaPrescricao
            v-for="p in listaRecentes"
            :key="p.id"
            :prescricao="p"
            :categoria="categorias.nome(p.categoriaId)"
            :icone-categoria="categorias.obter(p.categoriaId)?.icone"
          />
        </div>
      </div>

      <!-- Favoritos -->
      <div v-if="mostrarAtalhos && prescricoes.favoritas.length" class="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <h2 class="text-muted-foreground flex items-center gap-2 px-4 pt-3 pb-1 text-xs font-semibold tracking-wide uppercase">
          <Star class="size-4" /> Favoritos
        </h2>
        <div class="divide-y">
          <LinhaPrescricao
            v-for="p in [...prescricoes.favoritas].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))"
            :key="p.id"
            :prescricao="p"
            :categoria="categorias.nome(p.categoriaId)"
            :icone-categoria="categorias.obter(p.categoriaId)?.icone"
          />
        </div>
      </div>

      <!-- Todas, por categoria -->
      <div
        v-for="grupo in gruposVisiveis"
        :key="chaveGrupo(grupo.categoria?.id)"
        class="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1"
      >
        <button
          type="button"
          class="hover:bg-muted/60 flex h-12 w-full items-center gap-2 px-4 text-left"
          :aria-expanded="aberta(chaveGrupo(grupo.categoria?.id))"
          @click="alternarGrupo(chaveGrupo(grupo.categoria?.id))"
        >
          <IconeCategoria :icone="grupo.categoria?.icone" class="text-muted-foreground size-5" />
          <span class="flex-1 font-semibold">{{ grupo.categoria?.nome ?? ROTULO_SEM_CATEGORIA }}</span>
          <span class="text-muted-foreground text-sm">{{ grupo.prescricoes.length }}</span>
          <ChevronDown
            :class="cn('text-muted-foreground size-5 transition-transform', !aberta(chaveGrupo(grupo.categoria?.id)) && '-rotate-90')"
          />
        </button>
        <div v-show="aberta(chaveGrupo(grupo.categoria?.id))" class="divide-y border-t">
          <LinhaPrescricao v-for="p in grupo.prescricoes" :key="p.id" :prescricao="p" />
        </div>
      </div>

      <p v-if="buscando && encontradas.length === 0" class="text-muted-foreground py-6 text-center">
        Nada encontrado.
      </p>
    </template>

    <!-- Botão flutuante (celular) -->
    <Button
      v-if="!MODO_PENDRIVE"
      size="icon-touch"
      class="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 size-14 rounded-full shadow-lg md:hidden"
      aria-label="Nova prescrição"
      as-child
    >
      <RouterLink to="/prescricoes/nova"><Plus class="size-6" /></RouterLink>
    </Button>
  </section>
</template>
