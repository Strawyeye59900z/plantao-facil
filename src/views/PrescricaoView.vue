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
import { condicaoDoItem, ordenarPorCondicao, type CondicoesMarcadas } from '@/dominio/prescricoes/condicoes'
import { copiarTexto } from '@/lib/areaTransferencia'
import { MODO_PENDRIVE } from '@/modo'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
import type { ItemPrescricao, UUID } from '@/dominio/tipos'
import { cn } from '@/lib/utils'
import { useCategoriasStore } from '@/stores/categorias'
import { usePrescricoesStore } from '@/stores/prescricoes'

const route = useRoute()
const router = useRouter()
const prescricoes = usePrescricoesStore()
const categorias = useCategoriasStore()

const id = computed(() => String(route.params.id))
const prescricao = computed(() => prescricoes.obter(id.value))

/** Alternativa/opção escolhida por item (id, OPCAO_PRINCIPAL ou null) — só na memória desta tela. */
const escolhidas = ref<Record<UUID, string | null>>({})
/** Condições marcadas (os itens delas entram no Copiar) — só na memória desta tela; nenhuma vem marcada. */
const marcadas = ref<CondicoesMarcadas>({})
/** Peso digitado — só na memória desta tela, nunca salvo. */
const pesoDigitado = ref('')

watch(
  id,
  () => {
    escolhidas.value = {}
    marcadas.value = {}
    pesoDigitado.value = ''
  },
  { immediate: true },
)

/** Itens na ordem de exibição: "Sempre" primeiro, depois cada condição. */
const condicoes = computed(() => prescricao.value?.condicoes ?? [])
const itens = computed(() => ordenarPorCondicao(prescricao.value?.itens ?? [], condicoes.value))

function numeroItem(itemId: UUID | null): string | undefined {
  if (!itemId) return undefined
  const i = itens.value.findIndex((item) => item.id === itemId)
  return i === -1 ? undefined : `Item ${i + 1}`
}

/** Cabeçalho antes do primeiro item de cada grupo (só quando a prescrição tem condições). */
function cabecalho(i: number): { id: UUID; nome: string } | 'sempre' | null {
  if (!condicoes.value.length) return null
  const grupo = condicaoDoItem(itens.value[i]!, condicoes.value)
  if (i > 0 && condicaoDoItem(itens.value[i - 1]!, condicoes.value) === grupo) return null
  return grupo === null ? 'sempre' : condicoes.value.find((c) => c.id === grupo)!
}

function alternarCondicao(condicaoId: UUID) {
  marcadas.value = { ...marcadas.value, [condicaoId]: !marcadas.value[condicaoId] }
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
  calcularPrescricao(itens.value, escolhidas.value, pesoKg.value, condicoes.value, marcadas.value),
)

const motivoBloqueio = computed(() => {
  if (calculada.value.podeCopiar) return null
  if (calculada.value.nadaParaCopiar) return 'Marque uma condição para copiar.'
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
  <section v-if="prescricao" class="flex flex-col gap-5 pb-24">
    <!-- Cabeçalho -->
    <header class="flex flex-col gap-3">
      <p class="text-muted-foreground bg-secondary flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
        <IconeCategoria :icone="categorias.obter(prescricao.categoriaId)?.icone" class="size-3.5" />
        {{ categorias.nome(prescricao.categoriaId) }}
      </p>
      <div class="flex items-start gap-2">
        <h1 class="flex-1 text-2xl leading-tight font-semibold md:text-3xl">{{ prescricao.titulo }}</h1>
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
        <span v-for="tag in prescricao.tags" :key="tag" class="text-muted-foreground rounded-full border px-2.5 py-0.5 text-xs">
          #{{ tag }}
        </span>
      </div>
      <!-- Ações (antes ficavam no fim da página) -->
      <div v-if="!prescricao.excluidoEm && !MODO_PENDRIVE" class="-ml-2 flex flex-wrap gap-1">
        <Button variant="ghost" size="touch" class="text-muted-foreground px-3 text-sm" as-child>
          <RouterLink :to="`/prescricoes/${prescricao.id}/editar`"><Pencil /> Editar</RouterLink>
        </Button>
        <Button variant="ghost" size="touch" class="text-muted-foreground px-3 text-sm" @click="duplicar"><Copy /> Duplicar</Button>
        <Button variant="ghost" size="touch" class="text-muted-foreground hover:text-destructive px-3 text-sm" @click="confirmarLixeira = true">
          <Trash2 /> Excluir
        </Button>
      </div>
    </header>

    <div v-if="prescricao.excluidoEm" class="bg-muted rounded-2xl p-3 text-sm">
      Esta prescrição está na lixeira.
    </div>

    <!-- Importada e não revisada -->
    <div v-if="!prescricao.revisada" class="border-atencao/45 bg-atencao/12 flex flex-col gap-2 rounded-2xl border p-4">
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
    <div v-if="temRegra" class="bg-card flex flex-col gap-2 rounded-2xl border p-4 shadow-xs">
      <label for="peso" class="text-muted-foreground flex items-center gap-2 text-sm font-medium"><Scale class="size-4" /> Peso do paciente</label>
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
          class="border-input bg-background dark:bg-input/20 focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-14 w-full rounded-xl border pr-12 pl-4 text-2xl font-semibold tabular-nums outline-none focus-visible:ring-3 aria-invalid:ring-3"
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
      <template v-for="(item, i) in itens" :key="item.id">
        <!-- Cabeçalho do grupo: condição com caixa de marcar (entra no Copiar) ou "Sempre" -->
        <li v-if="cabecalho(i) === 'sempre'" class="text-muted-foreground mt-1 px-1 text-xs font-medium">
          Sempre
        </li>
        <li v-else-if="cabecalho(i)" class="mt-1">
          <label
            :class="cn(
              'flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors',
              marcadas[(cabecalho(i) as { id: UUID }).id] ? 'border-primary/50 bg-primary/10' : 'border-dashed hover:bg-accent/60',
            )"
          >
            <input
              type="checkbox"
              class="accent-primary size-5 shrink-0"
              :checked="!!marcadas[(cabecalho(i) as { id: UUID }).id]"
              @change="alternarCondicao((cabecalho(i) as { id: UUID }).id)"
            />
            <span class="flex-1 font-semibold">{{ (cabecalho(i) as { nome: string }).nome }}</span>
            <span class="text-muted-foreground text-xs">
              {{ marcadas[(cabecalho(i) as { id: UUID }).id] ? 'entra no Copiar' : 'não entra no Copiar' }}
            </span>
          </label>
        </li>
        <li
          :class="cn(
     'bg-card flex flex-col gap-3 rounded-2xl border p-4 shadow-xs transition-opacity',
      !calculada.linhas[i]!.copiar &&'opacity-55',
     )"
        >
          <div class="flex flex-wrap gap-3 sm:flex-nowrap">
            <span class="bg-primary/12 text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums">
              {{ i + 1 }}
            </span>
            <!-- Opções equivalentes (OU): todas por extenso; escolher uma é obrigatório para copiar -->
            <div
              v-if="calculada.linhas[i]!.opcoesEquivalentes"
              class="flex min-w-0 flex-1 basis-[calc(100%-2.5rem)] flex-col gap-1.5 sm:basis-0"
              role="radiogroup"
              :aria-label="`Opções do item ${i + 1}`"
            >
              <p :class="cn('text-xs font-medium', calculada.linhas[i]!.escolhaPendente ? 'text-atencao' : 'text-muted-foreground')">
                {{ calculada.linhas[i]!.escolhaPendente ? 'Escolha uma opção' : 'Opção escolhida' }}
              </p>
              <button
                v-for="(opcao, k) in calculada.linhas[i]!.opcoes"
                :key="opcao.id"
                type="button"
                role="radio"
                :aria-checked="escolhidas[item.id] === opcao.id"
                :class="cn(
                  'flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors',
                  escolhidas[item.id] === opcao.id
                    ? 'border-primary/50 bg-primary/10'
                    : calculada.linhas[i]!.escolhaPendente
                      ? 'hover:bg-accent/60'
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
            <div v-else class="min-w-0 flex-1 basis-[calc(100%-2.5rem)] sm:basis-0">
              <p v-if="calculada.linhas[i]!.motivoAlternativa" class="text-primary mb-1 flex items-center gap-1 text-xs font-semibold">
                <Replace class="size-3.5" /> Alternativa: {{ calculada.linhas[i]!.motivoAlternativa }}
              </p>
              <p class="text-base leading-relaxed whitespace-pre-line">{{ calculada.linhas[i]!.texto }}</p>
            </div>
            <!-- Troca pela alternativa -->
            <CampoSelect
              v-if="item.alternativas.length && !calculada.linhas[i]!.opcoesEquivalentes"
              :model-value="escolhidas[item.id] ?? null"
              :opcoes="opcoesItem(item)"
              class="ml-10 w-[calc(100%-2.5rem)] shrink-0 sm:ml-0 sm:w-48"
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
      </template>
    </ol>

    <div v-if="prescricao.receita" class="bg-card flex flex-col gap-3 rounded-2xl border p-4 shadow-xs">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-sm font-semibold">Receita pronta</h2>
        <Button variant="outline" size="touch" class="text-sm" @click="copiarReceita"><ClipboardCopy /> Copiar receita</Button>
      </div>
      <p class="bg-muted/70 rounded-xl p-3 leading-relaxed whitespace-pre-line">{{ prescricao.receita }}</p>
    </div>

    <div v-if="prescricao.observacoes" class="flex flex-col gap-1.5 px-1">
      <h2 class="text-sm font-semibold">Observações</h2>
      <p class="leading-relaxed whitespace-pre-line">{{ prescricao.observacoes }}</p>
    </div>

    <div v-if="prescricao.referencia" class="flex flex-col gap-1.5 border-t px-1 pt-4">
      <h2 class="text-muted-foreground text-xs font-medium">Referência</h2>
      <p class="text-muted-foreground text-sm whitespace-pre-line">{{ prescricao.referencia }}</p>
    </div>

    <!-- Copiar: barra fixa -->
    <div
      v-if="!prescricao.excluidoEm"
      class="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 px-3 md:px-8"
    >
      <div class="bg-card/95 pointer-events-auto mx-auto flex max-w-[44rem] items-center gap-2 rounded-2xl border p-2 shadow-lg backdrop-blur-md">
        <p v-if="motivoBloqueio" class="text-muted-foreground flex-1 px-2 text-sm">{{ motivoBloqueio }}</p>
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
    <h1 class="text-2xl font-semibold md:text-3xl">Prescrição não encontrada</h1>
    <Button size="touch" as-child><RouterLink to="/prescricoes">Voltar para a lista</RouterLink></Button>
  </section>
</template>
