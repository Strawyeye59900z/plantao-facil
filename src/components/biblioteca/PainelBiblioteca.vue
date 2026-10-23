<script setup lang="ts" generic="T extends { id: string; categoriaId: string | null; titulo?: string; nome?: string; favorito: boolean }">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ListChecks, Plus, Trash2, X } from '@lucide/vue'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
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
 * Com `selecionavel` (só Prescrições): seleção de vários cartões e exclusão do grupo aberto; quem usa faz a exclusão.
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
  selecionavel?: boolean
}>()
const emit = defineEmits<{ excluirVarias: [ids: string[]]; excluirGrupo: [grupoId: string] }>()

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

// ===== Seleção em massa =====
const selecionando = ref(false)
const marcadas = ref<string[]>([])
const confirmarExcluir = ref(false)
const confirmarExcluirGrupo = ref(false)

const podeSelecionar = computed(() => props.selecionavel && !MODO_PENDRIVE)
const todasMarcadas = computed(() => visiveis.value.length > 0 && visiveis.value.every((i) => marcadas.value.includes(i.id)))
// Só um grupo cadastrado (não Favoritos, Todas, Sem grupo nem busca) pode ser excluído por inteiro.
const grupoAtivo = computed(() => (buscando.value ? undefined : props.grupos.find((g) => g.id === chave.value)))

function iniciarSelecao(id?: string) {
  selecionando.value = true
  marcadas.value = id ? [id] : []
}
function sairDaSelecao() {
  selecionando.value = false
  marcadas.value = []
}
function alternar(id: string) {
  marcadas.value = marcadas.value.includes(id) ? marcadas.value.filter((m) => m !== id) : [...marcadas.value, id]
}
function alternarTodas() {
  marcadas.value = todasMarcadas.value ? [] : visiveis.value.map((i) => i.id)
}
function excluirMarcadas() {
  emit('excluirVarias', [...marcadas.value])
  sairDaSelecao()
}

// Trocar de grupo ou de busca desmarca tudo: ninguém exclui o que não está vendo.
watch([chave, termo], () => (marcadas.value = []))
// Itens que saíram da lista (excluídos, sincronizados) deixam de estar marcados.
watch(
  () => props.itens,
  (itens) => (marcadas.value = marcadas.value.filter((id) => itens.some((i) => i.id === id))),
)

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
        <div v-if="!MODO_PENDRIVE" class="flex shrink-0 items-center gap-2">
          <Button
            v-if="podeSelecionar && grupoAtivo && !selecionando"
            size="touch"
            variant="outline"
            class="text-destructive max-sm:size-11 max-sm:px-0"
            @click="confirmarExcluirGrupo = true"
          >
            <Trash2 /> <span class="max-sm:sr-only">Excluir grupo</span>
          </Button>
          <Button
            v-if="podeSelecionar && itens.length > 0 && !selecionando"
            size="touch"
            variant="outline"
            class="max-sm:size-11 max-sm:px-0"
            @click="iniciarSelecao()"
          >
            <ListChecks /> <span class="max-sm:sr-only">Selecionar</span>
          </Button>
          <Button size="touch" class="max-sm:size-11 max-sm:px-0" as-child>
            <RouterLink :to="`${rotaBase}/nova`">
              <Plus /> <span class="max-sm:sr-only">{{ rotuloNovo }}</span>
            </RouterLink>
          </Button>
        </div>
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

      <div v-else :class="['grid grid-cols-1 gap-2.5 md:grid-cols-2', selecionando && 'pb-24']">
        <CartaoItem
          v-for="item in visiveis"
          :key="item.id"
          :para="`${rotaBase}/${item.id}`"
          :titulo="nomeDoItem(item)"
          :favorito="item.favorito"
          :etiquetas="descrever(item).etiquetas"
          :meta="descrever(item).meta"
          :selecionavel="podeSelecionar"
          :selecionando="selecionando"
          :marcado="marcadas.includes(item.id)"
          @alternar="alternar(item.id)"
          @segurar="iniciarSelecao(item.id)"
        />
      </div>
    </div>

    <!-- Barra da seleção em massa -->
    <div
      v-if="selecionando"
      class="bg-card fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl items-center gap-1.5 rounded-full p-2 shadow-lg ring-1 ring-black/10"
      role="toolbar"
      aria-label="Seleção de prescrições"
    >
      <Button size="icon-touch" variant="ghost" class="rounded-full" aria-label="Cancelar seleção" @click="sairDaSelecao">
        <X />
      </Button>
      <span class="min-w-0 flex-1 truncate text-sm font-semibold" aria-live="polite">
        {{ marcadas.length }} {{ marcadas.length === 1 ? 'selecionada' : 'selecionadas' }}
      </span>
      <Button size="touch" variant="ghost" class="rounded-full" @click="alternarTodas">
        {{ todasMarcadas ? 'Nenhuma' : 'Todas' }}
      </Button>
      <Button size="touch" variant="destructive" class="rounded-full" :disabled="marcadas.length === 0" @click="confirmarExcluir = true">
        <Trash2 /> Excluir
      </Button>
    </div>

    <DialogoConfirmar
      v-model:aberto="confirmarExcluir"
      :titulo="`Excluir ${marcadas.length} ${marcadas.length === 1 ? nomeItens.um : nomeItens.varios}?`"
      descricao="Elas vão para a Lixeira, de onde podem ser restauradas."
      rotulo-confirmar="Excluir"
      perigoso
      @confirmar="excluirMarcadas"
    />
    <DialogoConfirmar
      v-model:aberto="confirmarExcluirGrupo"
      :titulo="`Excluir o grupo “${grupoAtivo?.nome ?? ''}”?`"
      :descricao="`O grupo será removido e as ${entradaAtiva.quantidade} ${entradaAtiva.quantidade === 1 ? nomeItens.um : nomeItens.varios} dele vão para a Lixeira, de onde podem ser restauradas (sem grupo).`"
      rotulo-confirmar="Excluir grupo"
      perigoso
      @confirmar="grupoAtivo && emit('excluirGrupo', grupoAtivo.id)"
    />
  </section>
</template>
