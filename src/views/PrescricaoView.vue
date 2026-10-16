<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { CircleCheck, ClipboardCopy, Copy, Pencil, Replace, Scale, Star, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import CartaoAlerta from '@/components/prescricoes/CartaoAlerta.vue'
import IconeCategoria from '@/components/categorias/IconeCategoria.vue'
import CampoSelect from '@/components/comum/CampoSelect.vue'
import ResultadoDose from '@/components/prescricoes/ResultadoDose.vue'
import { lerPeso } from '@/dominio/dose/peso'
import { calcularPrescricao, montarTextoCopia } from '@/dominio/dose/prescricaoCalculada'
import { copiarTexto } from '@/lib/areaTransferencia'
import { MODO_PENDRIVE } from '@/modo'
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
/** Alternativa/opção escolhida por item (id, OPCAO_PRINCIPAL ou null) — só na memória desta tela. */
const escolhidas = ref<Record<UUID, string | null>>({})
/** Peso digitado — só na memória desta tela, nunca salvo. */
const pesoDigitado = ref('')

watch(
  id,
  (novo) => {
    escolhidas.value = {}
    pesoDigitado.value = ''
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

// ===== Peso e doses (só na memória desta tela; nunca salvo) =====
const leituraPeso = computed(() => lerPeso(pesoDigitado.value))
const pesoKg = computed(() => (leituraPeso.value.ok ? leituraPeso.value.kg : null))

/** Mostra o campo de peso se qualquer item ou alternativa tiver regra de dose. */
const temRegra = computed(
  () =>
    prescricao.value?.itens.some((i) => i.regraDose || i.alternativas.some((a) => a.regraDose)) ?? false,
)

const calculada = computed(() =>
  calcularPrescricao(prescricao.value?.itens ?? [], escolhidas.value, pesoKg.value),
)

const motivoBloqueio = computed(() => {
  if (calculada.value.podeCopiar) return null
  const semEscolha = calculada.value.itensSemEscolha
  if (semEscolha.length) {
    return semEscolha.length === 1 ? `Escolha uma opção no item ${semEscolha[0]}.` : `Escolha uma opção nos itens ${semEscolha.join(', ')}.`
  }
  if (pesoKg.value === null) return 'Informe o peso para copiar.'
  return 'Há erro no cálculo de algum item.'
})

async function copiar() {
  if (!calculada.value.podeCopiar) return
  try {
    await copiarTexto(montarTextoCopia(calculada.value.linhas))
    toast.success('Copiado para a área de transferência.')
  } catch {
    toast.error('Não foi possível copiar.')
  }
}

/** Receita pronta: copiada como cadastrada, com as quebras de linha (só texto, sem cálculo). */
async function copiarReceita() {
  if (!prescricao.value?.receita) return
  try {
    await copiarTexto(prescricao.value.receita)
    toast.success('Receita copiada para a área de transferência.')
  } catch {
    toast.error('Não foi possível copiar.')
  }
}

function opcoesItem(item: ItemPrescricao) {
  return [
    { valor: null as UUID | null, rotulo: 'Padrão' },
    ...item.alternativas.map((alt) => ({ valor: alt.id as UUID | null, rotulo: alt.motivo })),
  ]
}

function escolher(itemId: UUID, altId: string | null) {
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
  <section v-if="prescricao" class="flex flex-col gap-4 pb-24">
    <!-- Cabeçalho -->
    <header class="flex flex-col gap-2">
      <p class="text-muted-foreground flex items-center gap-1.5 text-sm">
        <IconeCategoria :icone="categorias.obter(prescricao.categoriaId)?.icone" />
        {{ categorias.nome(prescricao.categoriaId) }}
      </p>
      <div class="flex items-start gap-2">
        <h1 class="flex-1 text-2xl leading-tight font-semibold">{{ prescricao.titulo }}</h1>
        <!-- Pen drive: favorito só exibido (a próxima atualização da biblioteca apagaria a mudança) -->
        <Star
          v-if="MODO_PENDRIVE"
          :class="cn('m-2.5 size-6 shrink-0', prescricao.favorito ? 'fill-atencao text-atencao' : 'hidden')"
          aria-label="Favorita"
        />
        <Button
          v-else
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
      <Button v-if="!MODO_PENDRIVE" size="touch" variant="outline" class="self-start" @click="marcarRevisada">
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

    <!-- Peso do paciente (só na memória desta tela) -->
    <div v-if="temRegra" class="bg-card ring-foreground/10 flex flex-col gap-1.5 rounded-xl p-4 ring-1">
      <label for="peso" class="flex items-center gap-2 font-semibold"><Scale class="size-5" /> Peso do paciente</label>
      <div class="relative">
        <input
          id="peso"
          v-model="pesoDigitado"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          placeholder="ex.: 12,5"
          :aria-invalid="(pesoDigitado.trim() !== '' && !leituraPeso.ok) || undefined"
          aria-describedby="peso-ajuda"
          class="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-14 w-full rounded-xl border bg-transparent pr-12 pl-4 text-2xl font-semibold outline-none focus-visible:ring-3 aria-invalid:ring-3"
        />
        <span class="text-muted-foreground pointer-events-none absolute top-1/2 right-4 -translate-y-1/2">kg</span>
      </div>
      <p
        id="peso-ajuda"
        :class="cn('text-sm', pesoDigitado.trim() !== '' && !leituraPeso.ok ? 'text-destructive' : 'text-muted-foreground')"
      >
        {{
          pesoDigitado.trim() !== '' && !leituraPeso.ok
            ? (leituraPeso as { erro: string }).erro
            : 'Até 1 casa decimal. Não é salvo.'
        }}
      </p>
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
          <!-- Opções equivalentes (OU): todas por extenso; escolher uma é obrigatório para copiar -->
          <div
            v-if="calculada.linhas[i]!.opcoesEquivalentes"
            class="flex min-w-0 flex-1 flex-col gap-1.5"
            role="radiogroup"
            :aria-label="`Opções do item ${i + 1}`"
          >
            <p :class="cn('text-xs font-semibold tracking-wide uppercase', calculada.linhas[i]!.escolhaPendente ? 'text-atencao' : 'text-muted-foreground')">
              {{ calculada.linhas[i]!.escolhaPendente ? 'Escolha uma opção' : 'Opção escolhida' }}
            </p>
            <button
              v-for="(opcao, k) in calculada.linhas[i]!.opcoes"
              :key="opcao.id"
              type="button"
              role="radio"
              :aria-checked="escolhidas[item.id] === opcao.id"
              :class="cn(
                'flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-opacity',
                escolhidas[item.id] === opcao.id
                  ? 'border-primary bg-primary/10'
                  : calculada.linhas[i]!.escolhaPendente
                    ? 'hover:bg-muted'
                    : 'opacity-50 hover:opacity-100',
              )"
              @click="escolher(item.id, opcao.id)"
            >
              <span
                :class="cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                  escolhidas[item.id] === opcao.id ? 'border-primary' : 'border-muted-foreground/50',
                )"
              >
                <span v-if="escolhidas[item.id] === opcao.id" class="bg-primary size-2.5 rounded-full" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="text-muted-foreground block text-xs">Opção {{ k + 1 }}<template v-if="opcao.rotulo"> · {{ opcao.rotulo }}</template></span>
                <span class="text-base whitespace-pre-line">{{ opcao.texto }}</span>
              </span>
            </button>
          </div>
          <div v-else class="min-w-0 flex-1">
            <p v-if="calculada.linhas[i]!.motivoAlternativa" class="text-primary mb-1 flex items-center gap-1 text-xs font-semibold">
              <Replace class="size-3.5" /> Alternativa: {{ calculada.linhas[i]!.motivoAlternativa }}
            </p>
            <p class="text-base whitespace-pre-line">{{ calculada.linhas[i]!.texto }}</p>
          </div>
          <!-- Troca pela alternativa -->
          <CampoSelect
            v-if="item.alternativas.length && !calculada.linhas[i]!.opcoesEquivalentes"
            :model-value="escolhidas[item.id] ?? null"
            :opcoes="opcoesItem(item)"
            class="w-36 shrink-0 sm:w-48"
            :aria-label="`Substituir item ${i + 1}`"
            @update:model-value="(altId) => escolher(item.id, altId)"
          />
        </div>

        <CartaoAlerta v-for="alerta in alertasDoItem(item.id)" :key="alerta.id" :alerta="alerta" compacto />

        <!-- Dose calculada: avisos de teto/peso limite + memória de cálculo -->
        <ResultadoDose v-if="calculada.linhas[i]!.resultado" :resultado="calculada.linhas[i]!.resultado!" />
        <p v-else-if="calculada.linhas[i]!.regra" class="text-muted-foreground flex items-center gap-1.5 text-sm">
          <Scale class="size-4" /> Informe o peso para calcular a dose.
        </p>
      </li>
    </ol>

    <div v-if="prescricao.receita" class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Receita pronta</h2>
        <Button variant="outline" size="touch" @click="copiarReceita"><ClipboardCopy /> Copiar receita</Button>
      </div>
      <p class="bg-muted/50 rounded-lg border p-3 whitespace-pre-line">{{ prescricao.receita }}</p>
    </div>

    <div v-if="prescricao.observacoes" class="flex flex-col gap-1">
      <h2 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Observações</h2>
      <p class="whitespace-pre-line">{{ prescricao.observacoes }}</p>
    </div>

    <div v-if="prescricao.referencia" class="flex flex-col gap-1">
      <h2 class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Referência</h2>
      <p class="text-muted-foreground text-sm whitespace-pre-line">{{ prescricao.referencia }}</p>
    </div>

    <!-- Ações -->
    <div v-if="!prescricao.excluidoEm && !MODO_PENDRIVE" class="grid grid-cols-3 gap-2 border-t pt-4">
      <Button variant="outline" size="touch" as-child>
        <RouterLink :to="`/prescricoes/${prescricao.id}/editar`"><Pencil /> Editar</RouterLink>
      </Button>
      <Button variant="outline" size="touch" @click="duplicar"><Copy /> Duplicar</Button>
      <Button variant="destructive" size="touch" @click="confirmarLixeira = true"><Trash2 /> Excluir</Button>
    </div>

    <!-- Copiar: barra fixa -->
    <div
      v-if="!prescricao.excluidoEm"
      class="bg-background/95 fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t backdrop-blur md:bottom-0 md:left-60"
    >
      <div class="mx-auto flex max-w-3xl items-center gap-3 px-3 py-2">
        <p v-if="motivoBloqueio" class="text-muted-foreground flex-1 text-sm">{{ motivoBloqueio }}</p>
        <Button size="touch" :class="motivoBloqueio ? '' : 'flex-1'" :disabled="!calculada.podeCopiar" @click="copiar">
          <ClipboardCopy /> Copiar
        </Button>
      </div>
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
