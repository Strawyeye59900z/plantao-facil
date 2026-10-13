<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, X } from '@lucide/vue'
import { cn } from '@/lib/utils'
import { NAVEGACAO_PRINCIPAL, NAVEGACAO_SECUNDARIA } from './navegacao'
import AvisoAtualizacao from './AvisoAtualizacao.vue'
import LogoApp from './LogoApp.vue'

const route = useRoute()
const router = useRouter()

// A busca do topo filtra a lista de prescrições (?q=) enquanto se digita.
const busca = ref('')
watch(
  () => route.query.q,
  (q) => {
    const termo = typeof q === 'string' ? q : ''
    // Não sobrescreve o que está sendo digitado (ex.: espaço no fim).
    if (busca.value.trim() !== termo) busca.value = termo
  },
  { immediate: true },
)

function buscar() {
  const q = busca.value.trim()
  const destino = { path: '/prescricoes', query: q ? { q } : {} }
  // Na própria lista, substitui o histórico para o "voltar" não passar letra por letra.
  if (route.path === '/prescricoes') router.replace(destino)
  else router.push(destino)
}

function concluirBusca(evento: Event) {
  buscar()
  // Fecha o teclado do celular para mostrar os resultados.
  ;(evento.target as HTMLFormElement).querySelector('input')?.blur()
}

function limparBusca() {
  busca.value = ''
  if (route.path === '/prescricoes') router.replace({ path: '/prescricoes' })
}

function ativo(rota: string) {
  return route.path === rota || route.path.startsWith(`${rota}/`)
}
</script>

<template>
  <div class="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
    <!-- Menu lateral (PC/tablet) -->
    <aside
      class="bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 hidden h-dvh flex-col gap-1 border-r p-3 md:flex"
    >
      <RouterLink to="/prescricoes" class="mb-4 flex items-center gap-2 px-2 py-1">
        <LogoApp class="size-8" />
        <span class="text-base font-semibold">Plantão Fácil</span>
      </RouterLink>
      <nav class="flex flex-col gap-1" aria-label="Navegação principal">
        <RouterLink
          v-for="item in NAVEGACAO_PRINCIPAL"
          :key="item.rota"
          :to="item.rota"
          :class="cn(
            'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-sidebar-accent',
            ativo(item.rota) && 'bg-sidebar-accent text-sidebar-accent-foreground',
          )"
        >
          <component :is="item.icone" class="size-5" />
          {{ item.rotulo }}
        </RouterLink>
      </nav>
      <div class="text-muted-foreground mt-4 px-3 text-xs font-medium uppercase tracking-wide">Dados</div>
      <nav class="flex flex-col gap-1" aria-label="Dados">
        <RouterLink
          v-for="item in NAVEGACAO_SECUNDARIA"
          :key="item.rota"
          :to="item.rota"
          :class="cn(
            'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-sidebar-accent',
            ativo(item.rota) && 'bg-sidebar-accent text-sidebar-accent-foreground',
          )"
        >
          <component :is="item.icone" class="size-5" />
          {{ item.rotulo }}
        </RouterLink>
      </nav>
    </aside>

    <div class="flex min-h-dvh min-w-0 flex-col">
      <!-- Barra superior com busca -->
      <header
        class="bg-background/90 sticky top-0 z-20 border-b backdrop-blur pt-[env(safe-area-inset-top)]"
      >
        <div class="mx-auto flex h-14 max-w-3xl items-center gap-2 px-3">
          <LogoApp class="size-8 shrink-0 md:hidden" />
          <form class="relative flex-1" role="search" @submit.prevent="concluirBusca">
            <Search class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2" />
            <input
              v-model="busca"
              type="search"
              @input="buscar"
              inputmode="search"
              enterkeyhint="search"
              placeholder="Buscar prescrição…"
              aria-label="Buscar prescrição"
              class="bg-muted/60 focus-visible:ring-ring/50 h-11 w-full rounded-xl border border-transparent pr-10 pl-10 text-base outline-none focus-visible:ring-3 [&::-webkit-search-cancel-button]:hidden"
            />
            <button
              v-if="busca"
              type="button"
              class="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg"
              aria-label="Limpar busca"
              @click="limparBusca"
            >
              <X class="size-5" />
            </button>
          </form>
        </div>
      </header>

      <main class="mx-auto w-full max-w-3xl flex-1 px-3 pt-4 pb-24 md:pb-8">
        <RouterView v-slot="{ Component }">
          <component :is="Component" :key="route.path" />
        </RouterView>
      </main>

      <!-- Navegação inferior (celular) -->
      <nav
        class="bg-background/95 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Navegação principal"
      >
        <div class="grid grid-cols-3">
          <RouterLink
            v-for="item in NAVEGACAO_PRINCIPAL"
            :key="item.rota"
            :to="item.rota"
            :class="cn(
              'flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
              ativo(item.rota) ? 'text-primary' : 'text-muted-foreground',
            )"
          >
            <component :is="item.icone" class="size-6" />
            {{ item.rotulo }}
          </RouterLink>
        </div>
      </nav>
    </div>

    <AvisoAtualizacao />
  </div>
</template>
