<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, X } from '@lucide/vue'
import { cn } from '@/lib/utils'
import { NAVEGACAO_PRINCIPAL, NAVEGACAO_SECUNDARIA } from './navegacao'
import AvisoAtualizacao from './AvisoAtualizacao.vue'
import LogoApp from './LogoApp.vue'
import { armazenamento, MODO_PENDRIVE } from '@/modo'
import { useConfiguracoesStore } from '@/stores/configuracoes'

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

// Cada aba tem sua busca: em Calculadoras busca calculadoras; no resto, prescrições.
const listaDaBusca = computed(() => (route.path.startsWith('/calculadoras') ? '/calculadoras' : '/prescricoes'))
const rotuloBusca = computed(() => (listaDaBusca.value === '/calculadoras' ? 'Buscar calculadora' : 'Buscar prescrição'))

function buscar() {
  const q = busca.value.trim()
  const destino = { path: listaDaBusca.value, query: q ? { q } : {} }
  // Na própria lista, substitui o histórico para o "voltar" não passar letra por letra.
  if (route.path === listaDaBusca.value) router.replace(destino)
  else router.push(destino)
}

function concluirBusca(evento: Event) {
  buscar()
  // Fecha o teclado do celular para mostrar os resultados.
  ;(evento.target as HTMLFormElement).querySelector('input')?.blur()
}

function limparBusca() {
  busca.value = ''
  if (route.path === listaDaBusca.value) router.replace({ path: listaDaBusca.value })
}

// Modo pen drive: faixa de aviso; na tela de carregar a biblioteca, sem menus.
const configuracoes = useConfiguracoesStore()
const telaCarregar = computed(() => route.path === '/carregar')
const dataBiblioteca = computed(() => {
  const de = configuracoes.config.bibliotecaPenDriveDe
  return de ? new Date(de).toLocaleDateString('pt-BR') : null
})

function ativo(rota: string) {
  return route.path === rota || route.path.startsWith(`${rota}/`)
}
</script>

<template>
  <div :class="cn('min-h-dvh', !telaCarregar && 'md:grid md:grid-cols-[16rem_1fr]')">
    <!-- Menu lateral (PC/tablet) -->
    <aside
      v-if="!telaCarregar"
      class="bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 hidden h-dvh flex-col gap-0.5 border-r px-3 py-4 md:flex"
    >
      <RouterLink to="/prescricoes" class="mb-5 flex items-center gap-2.5 px-2 py-1">
        <LogoApp class="size-7" />
        <span class="text-[15px] font-semibold tracking-tight">Plantão Fácil</span>
      </RouterLink>
      <nav class="flex flex-col gap-1" aria-label="Navegação principal">
        <RouterLink
          v-for="item in NAVEGACAO_PRINCIPAL"
          :key="item.rota"
          :to="item.rota"
          :class="cn(
            'text-sidebar-foreground/80 flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
            ativo(item.rota) && 'bg-sidebar-accent text-sidebar-accent-foreground',
          )"
        >
          <component :is="item.icone" class="size-[18px]" :stroke-width="1.75" />
          {{ item.rotulo }}
        </RouterLink>
      </nav>
      <template v-if="!MODO_PENDRIVE">
      <div class="text-muted-foreground mt-5 mb-1 px-3 text-xs font-medium">Dados</div>
      <nav class="flex flex-col gap-1" aria-label="Dados">
        <RouterLink
          v-for="item in NAVEGACAO_SECUNDARIA"
          :key="item.rota"
          :to="item.rota"
          :class="cn(
            'text-sidebar-foreground/80 flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
            ativo(item.rota) && 'bg-sidebar-accent text-sidebar-accent-foreground',
          )"
        >
          <component :is="item.icone" class="size-[18px]" :stroke-width="1.75" />
          {{ item.rotulo }}
        </RouterLink>
      </nav>
      </template>
    </aside>

    <div class="flex min-h-dvh min-w-0 flex-col">
      <!-- Barra superior com busca -->
      <header
        v-if="!telaCarregar"
        class="bg-background/85 sticky top-0 z-20 backdrop-blur-md pt-[env(safe-area-inset-top)]"
      >
        <div class="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 md:px-8">
          <LogoApp class="size-8 shrink-0 md:hidden" />
          <form class="relative flex-1" role="search" @submit.prevent="concluirBusca">
            <Search class="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2" />
            <input
              v-model="busca"
              type="search"
              @input="buscar"
              inputmode="search"
              enterkeyhint="search"
              :placeholder="`${rotuloBusca}…`"
              :aria-label="rotuloBusca"
              class="bg-card placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 h-11 w-full rounded-2xl border pr-10 pl-10 text-base shadow-xs outline-none transition-colors focus-visible:ring-3 dark:bg-input/20 [&::-webkit-search-cancel-button]:hidden"
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
        <p
          v-if="MODO_PENDRIVE"
          class="bg-atencao/15 text-foreground px-3 py-1 text-center text-xs font-medium"
        >
          Modo pen drive — somente leitura<span v-if="dataBiblioteca"> · biblioteca de {{ dataBiblioteca }}</span>
          <span v-if="armazenamento.emMemoria" class="text-destructive"> · dados só nesta aba</span>
        </p>
      </header>

      <main class="mx-auto w-full max-w-3xl flex-1 px-4 pt-3 pb-28 md:px-8 md:pt-6 md:pb-10">
        <RouterView v-slot="{ Component }">
          <component :is="Component" :key="route.path" />
        </RouterView>
      </main>

      <!-- Navegação inferior (celular) -->
      <nav
        v-if="!telaCarregar"
        class="bg-background/90 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Navegação principal"
      >
        <div class="grid grid-cols-3">
          <RouterLink
            v-for="item in NAVEGACAO_PRINCIPAL"
            :key="item.rota"
            :to="item.rota"
            :class="cn(
              'group flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
              ativo(item.rota) ? 'text-foreground' : 'text-muted-foreground',
            )"
          >
            <span
              :class="cn(
                'flex h-8 w-14 items-center justify-center rounded-full transition-colors',
                ativo(item.rota) ? 'bg-primary/15 text-primary' : 'group-active:bg-accent',
              )"
            >
              <component :is="item.icone" class="size-[22px]" :stroke-width="ativo(item.rota) ? 2.25 : 1.75" />
            </span>
            {{ item.rotulo }}
          </RouterLink>
        </div>
      </nav>
    </div>

    <AvisoAtualizacao />
  </div>
</template>
