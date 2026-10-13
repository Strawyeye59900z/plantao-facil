<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { CircleCheck, Copy, Pencil, Replace, Star, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import CartaoAlerta from '@/components/prescricoes/CartaoAlerta.vue'
import CampoSelect from '@/components/comum/CampoSelect.vue'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
import type { ItemPrescricao, UUID } from '@/dominio/tipos'
import { cn } from '@/lib/utils'
import { useCategoriasStore } from '@/stores/categorias'
import { usePrescricoesStore } from '@/stores/prescricoes'
import { useRecentesStore } from '@/stores/recentes'

const route = useRoute()
const router = useRouter()
const prescricoes = usePrescricoesStore()
const categorias = useCategoriasStore()
const recentes = useRecentesStore()

const id = computed(() => String(route.params.id))
const prescricao = computed(() => prescricoes.obter(id.value))

/** Alternativa escolhida por item — só na memória desta tela. */
const escolhidas = ref<Record<UUID, UUID | null>>({})

watch(
  id,
  (novo) => {
    escolhidas.value = {}
    const p = prescricoes.obter(novo)
    if (p && p.excluidoEm === null) recentes.registrar('prescricao', novo)
  },
  { immediate: true },
)

function numeroItem(itemId: UUID | null): string | undefined {
  if (!itemId || !prescricao.value) return undefined
  const i = prescricao.value.itens.findIndex((item) => item.id === itemId)
  return i === -1 ? undefined : `Item ${i + 1}`
}

function alertasDoItem(itemId: UUID) {
  return prescricao.value?.alertas.filter((a) => a.itemId === itemId) ?? []
}

function alternativaEscolhida(item: ItemPrescricao) {
  const altId = escolhidas.value[item.id]
  return altId ? item.alternativas.find((a) => a.id === altId) : undefined
}

function opcoesItem(item: ItemPrescricao) {
  return [
    { valor: null as UUID | null, rotulo: 'Padrão' },
    ...item.alternativas.map((alt) => ({ valor: alt.id as UUID | null, rotulo: alt.motivo })),
  ]
}

function escolher(itemId: UUID, altId: UUID | null) {
  escolhidas.value = { ...escolhidas.value, [itemId]: altId }
}

async function favoritar() {
  await prescricoes.alternarFavorito(id.value)
}

async function marcarRevisada() {
  await prescricoes.atualizar(id.value, { revisada: true })
  toast.success('Marcada como revisada.')
}

async function duplicar() {
  const copia = await prescricoes.duplicar(id.value)
  toast.success('Prescrição duplicada.')
  router.push(`/prescricoes/${copia.id}/editar`)
}

const confirmarLixeira = ref(false)
async function moverParaLixeira() {
  const titulo = prescricao.value?.titulo
  await prescricoes.moverParaLixeira(id.value)
  router.replace('/prescricoes')
  toast(`“${titulo}” foi para a lixeira.`, {
    action: { label: 'Desfazer', onClick: () => prescricoes.restaurar(id.value) },
  })
}
</script>

<template>
  <section v-if="prescricao" class="flex flex-col gap-4 pb-4">
    <!-- Cabeçalho -->
    <header class="flex flex-col gap-2">
      <p class="text-muted-foreground text-sm">{{ categorias.nome(prescricao.categoriaId) }}</p>
      <div class="flex items-start gap-2">
        <h1 class="flex-1 text-2xl leading-tight font-semibold">{{ prescricao.titulo }}</h1>
        <Button
          variant="ghost"
          size="icon-touch"
          :aria-label="prescricao.favorito ? 'Remover dos favoritos' : 'Favoritar'"
          :aria-pressed="prescricao.favorito"
          @click="favoritar"
        >
          <Star :class="cn('size-6', prescricao.favorito && 'fill-atencao text-atencao')" />
        </Button>
      </div>
      <div v-if="prescricao.tags.length" class="flex flex-wrap gap-1.5">
        <span v-for="tag in prescricao.tags" :key="tag" class="bg-secondary rounded-full px-2.5 py-0.5 text-xs">
          {{ tag }}
        </span>
      </div>
    </header>

    <div v-if="prescricao.excluidoEm" class="bg-muted rounded-xl p-3 text-sm">
      Esta prescrição está na lixeira.
    </div>

    <!-- Importada e não revisada -->
    <div v-if="!prescricao.revisada" class="border-atencao bg-atencao/12 flex flex-col gap-2 rounded-xl border p-3">
      <p class="font-semibold">Importada — não revisada</p>
      <ul v-if="prescricao.duvidasImportacao.length" class="list-disc pl-5 text-sm">
        <li v-for="(duvida, i) in prescricao.duvidasImportacao" :key="i">{{ duvida }}</li>
      </ul>
      <Button size="touch" variant="outline" class="self-start" @click="marcarRevisada">
        <CircleCheck /> Marcar como revisada
      </Button>
    </div>

    <!-- Todos os alertas, em destaque no topo -->
    <div v-if="prescricao.alertas.length" class="flex flex-col gap-2">
      <CartaoAlerta
        v-for="alerta in prescricao.alertas"
        :key="alerta.id"
        :alerta="alerta"
        :referencia-item="numeroItem(alerta.itemId)"
      />
    </div>

    <!-- Itens -->
    <ol class="flex flex-col gap-3">
      <li
        v-for="(item, i) in prescricao.itens"
        :key="item.id"
        class="bg-card ring-foreground/10 flex flex-col gap-3 rounded-xl p-4 ring-1"
      >
        <div class="flex gap-3">
          <span class="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
            {{ i + 1 }}
          </span>
          <div class="min-w-0 flex-1">
            <p v-if="alternativaEscolhida(item)" class="text-primary mb-1 flex items-center gap-1 text-xs font-semibold">
              <Replace class="size-3.5" /> Alternativa: {{ alternativaEscolhida(item)!.motivo }}
            </p>
            <p class="text-base whitespace-pre-line">{{ alternativaEscolhida(item)?.texto ?? item.texto }}</p>
          </div>
          <!-- Troca pela alternativa -->
          <CampoSelect
            v-if="item.alternativas.length"
            :model-value="escolhidas[item.id] ?? null"
            :opcoes="opcoesItem(item)"
            class="w-36 shrink-0 sm:w-48"
            :aria-label="`Substituir item ${i + 1}`"
            @update:model-value="(altId) => escolher(item.id, altId)"
          />
        </div>

        <CartaoAlerta v-for="alerta in alertasDoItem(item.id)" :key="alerta.id" :alerta="alerta" compacto />

      </li>
    </ol>

    <div v-if="prescricao.observacoes" class="flex flex-col gap-1">
      <h2 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Observações</h2>
      <p class="whitespace-pre-line">{{ prescricao.observacoes }}</p>
    </div>

    <div v-if="prescricao.referencia" class="flex flex-col gap-1">
      <h2 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Referência</h2>
      <p class="text-muted-foreground text-sm whitespace-pre-line">{{ prescricao.referencia }}</p>
    </div>

    <!-- Ações -->
    <div v-if="!prescricao.excluidoEm" class="grid grid-cols-3 gap-2 border-t pt-4">
      <Button variant="outline" size="touch" as-child>
        <RouterLink :to="`/prescricoes/${prescricao.id}/editar`"><Pencil /> Editar</RouterLink>
      </Button>
      <Button variant="outline" size="touch" @click="duplicar"><Copy /> Duplicar</Button>
      <Button variant="destructive" size="touch" @click="confirmarLixeira = true"><Trash2 /> Excluir</Button>
    </div>

    <DialogoConfirmar
      v-model:aberto="confirmarLixeira"
      titulo="Mover para a lixeira?"
      descricao="Você pode restaurar depois, pela Lixeira."
      rotulo-confirmar="Mover para a lixeira"
      perigoso
      @confirmar="moverParaLixeira"
    />
  </section>

  <section v-else class="flex flex-col items-start gap-4">
    <h1 class="text-2xl font-semibold">Prescrição não encontrada</h1>
    <Button size="touch" as-child><RouterLink to="/prescricoes">Voltar para a lista</RouterLink></Button>
  </section>
</template>
