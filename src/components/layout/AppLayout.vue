<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ClipboardCheck, Menu, Search, X } from '@lucide/vue'
import { cn } from '@/lib/utils'
import { AREAS, MENU } from './navegacao'
import AvisoAtualizacao from './AvisoAtualizacao.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { armazenamento, MODO_PENDRIVE, rotaBloqueadaNoPenDrive } from '@/modo'
import { useConfiguracoesStore } from '@/stores/configuracoes'

const route = useRoute()
const router = useRouter()

// A busca do topo filtra a lista da área (?q=) enquanto se digita.
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

// Cada área tem sua busca: Calculadoras e Escalas buscam nelas; no resto, prescrições.
const listaDaBusca = computed(() =>
  route.path.startsWith('/calculadoras') ? '/calculadoras' : route.path.startsWith('/escalas') ? '/escalas' : '/prescricoes',
)
const rotuloBusca = computed(() =>
  listaDaBusca.value === '/calculadoras' ? 'Buscar calculadora' : listaDaBusca.value === '/escalas' ? 'Buscar escala' : 'Buscar prescrição, grupo ou medicação',
)

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

// Modo pen drive: faixa de aviso; na tela de carregar a biblioteca, sem topo.
const configuracoes = useConfiguracoesStore()
const telaCarregar = computed(() => route.path === '/carregar')
const dataBiblioteca = computed(() => {
  const de = configuracoes.config.bibliotecaPenDriveDe
  return de ? new Date(de).toLocaleDateString('pt-BR') : null
})

// No pen drive, o menu não mostra o que a rota bloqueia.
const menu = MODO_PENDRIVE ? MENU.filter((item) => !rotaBloqueadaNoPenDrive(item.rota)) : MENU

function ativo(rota: string) {
  return route.path === rota || route.path.startsWith(`${rota}/`)
}

// Telas de edição: o topo mostra só o voltar e o título.
const emEdicao = computed(() => /\/(nova|editar)$/.test(route.path))
// A biblioteca (lateral + grade) e a tela da prescrição (lista + receita ao lado) usam a largura toda;
// as demais telas ficam estreitas, para leitura.
const larguraTotal = computed(
  () =>
    route.path === '/prescricoes' ||
    route.path === '/calculadoras' ||
    route.path === '/escalas' ||
    route.name === 'prescricao',
)
const tituloEdicao = computed(() => route.meta.titulo ?? '')

function voltar() {
  // Sem histórico (aberta direto pelo link), volta para a lista da área.
  if (window.history.state?.back) router.back()
  else router.push(listaDaBusca.value)
}
</script>

<template>
  <div class="min-h-dvh">
    <div class="flex min-h-dvh min-w-0 flex-col">
      <header
        v-if="!telaCarregar"
        class="bg-background/85 sticky top-0 z-20 backdrop-blur-md pt-[env(safe-area-inset-top)]"
      >
        <!-- Rotas de edição: só voltar e título -->
        <div v-if="emEdicao" class="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 md:px-8">
          <button
            type="button"
            class="bg-card hover:bg-accent flex size-11 shrink-0 items-center justify-center rounded-full shadow-xs transition-colors"
            aria-label="Voltar"
            @click="voltar"
          >
            <ArrowLeft class="size-5" />
          </button>
          <p class="truncate text-lg font-bold tracking-tight">{{ tituloEdicao }}</p>
        </div>

        <!-- Celular: logo + busca + menu, pílulas na linha de baixo; PC: tudo numa linha -->
        <div
          v-else
          class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2.5 gap-y-2 px-4 py-2.5 md:flex-nowrap md:px-8"
        >
          <RouterLink
            to="/prescricoes"
            class="bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-full"
            aria-label="Plantão Fácil"
          >
            <ClipboardCheck class="size-5" />
          </RouterLink>

          <!-- Celular: 3 pílulas iguais na largura toda, ícone sobre o rótulo (cabe em 320 px). sm+: ícone ao lado. -->
          <nav class="order-last flex w-full gap-1.5 md:order-none md:w-auto" aria-label="Áreas">
            <RouterLink
              v-for="area in AREAS"
              :key="area.rota"
              :to="area.rota"
              :aria-current="ativo(area.rota) ? 'page' : undefined"
              :class="cn(
                'flex h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-xs leading-tight font-semibold shadow-xs transition-colors',
                'sm:flex-none sm:flex-row sm:gap-1.5 sm:px-4 sm:text-sm',
                ativo(area.rota) ? 'bg-foreground text-background' : 'bg-card hover:bg-accent',
              )"
            >
              <component :is="area.icone" class="size-4 shrink-0" :stroke-width="2" />
              <span class="max-w-full truncate">{{ area.rotulo }}</span>
            </RouterLink>
          </nav>

          <form class="relative min-w-0 flex-1 md:ml-auto md:max-w-xs" role="search" @submit.prevent="concluirBusca">
            <Search class="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
            <input
              v-model="busca"
              type="search"
              @input="buscar"
              inputmode="search"
              enterkeyhint="search"
              :placeholder="`${rotuloBusca}…`"
              :aria-label="rotuloBusca"
              class="bg-card placeholder:text-muted-foreground focus-visible:ring-ring/30 h-11 w-full rounded-full pr-10 pl-10 text-base shadow-xs outline-none transition-colors focus-visible:ring-3 md:text-sm [&::-webkit-search-cancel-button]:hidden"
            />
            <button
              v-if="busca"
              type="button"
              class="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-full"
              aria-label="Limpar busca"
              @click="limparBusca"
            >
              <X class="size-4" />
            </button>
          </form>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button
                type="button"
                class="bg-card hover:bg-accent flex size-11 shrink-0 items-center justify-center rounded-full shadow-xs transition-colors"
                aria-label="Menu"
              >
                <Menu class="size-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-56 rounded-2xl p-1.5">
              <DropdownMenuItem
                v-for="item in menu"
                :key="item.rota"
                as-child
                :class="cn('h-11 gap-3 rounded-xl px-3 text-sm font-medium', ativo(item.rota) && 'bg-accent text-accent-foreground')"
              >
                <RouterLink :to="item.rota">
                  <component :is="item.icone" class="size-[18px]" :stroke-width="1.75" />
                  {{ item.rotulo }}
                </RouterLink>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p
          v-if="MODO_PENDRIVE"
          class="bg-atencao/15 text-foreground px-3 py-1 text-center text-xs font-medium"
        >
          Modo pen drive — somente leitura<span v-if="dataBiblioteca"> · biblioteca de {{ dataBiblioteca }}</span>
          <span v-if="armazenamento.emMemoria" class="text-destructive"> · dados só nesta aba</span>
        </p>
      </header>

      <main :class="cn('mx-auto w-full flex-1 px-4 pt-3 pb-28 md:px-8 md:pt-6 md:pb-10', larguraTotal ? 'max-w-6xl' : 'max-w-3xl')">
        <RouterView v-slot="{ Component }">
          <component :is="Component" :key="route.path" />
        </RouterView>
      </main>
    </div>

    <AvisoAtualizacao />
  </div>
</template>
