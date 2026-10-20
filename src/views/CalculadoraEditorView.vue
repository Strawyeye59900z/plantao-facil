<script setup lang="ts">
import { computed, nextTick, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Calculator, ListChecks, OctagonAlert, Plus, Syringe, TriangleAlert, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import CampoSelect from '@/components/comum/CampoSelect.vue'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
import EditorCamposPontos from '@/components/calculadoras/EditorCamposPontos.vue'
import EditorDosePeso from '@/components/calculadoras/EditorDosePeso.vue'
import EditorFaixasInterpretacao from '@/components/calculadoras/EditorFaixasInterpretacao.vue'
import EditorFormula from '@/components/calculadoras/EditorFormula.vue'
import UsoPontos from '@/components/calculadoras/UsoPontos.vue'
import { useAvisoSaida } from '@/composables/useAvisoSaida'
import {
  avisosCalculadora,
  calculadoraVazia,
  paraDadosCalculadora,
  validarCalculadora,
  type DadosCalculadora,
} from '@/dominio/calculadoras/editar'
import type { AreaCalculadora, Calculadora } from '@/dominio/tipos'
import { useCalculadorasStore } from '@/stores/calculadoras'
import { useCategoriasStore } from '@/stores/categorias'

/** Atende /calculadoras/nova, /escalas/nova e /<área>/:id/editar. */
const route = useRoute()
const router = useRouter()
const calculadoras = useCalculadorasStore()
const categorias = useCategoriasStore()

const idEdicao = route.params.id ? String(route.params.id) : null
const original = idEdicao ? calculadoras.obter(idEdicao) : undefined
const naoEncontrada = idEdicao !== null && !original

// A área vem do próprio item; na criação, da rota.
const area: AreaCalculadora = original ? original.area : route.path.startsWith('/escalas') ? 'escala' : 'calculadora'
const escala = area === 'escala'
const base = escala ? '/escalas' : '/calculadoras'
const rotulo = escala ? 'escala' : 'calculadora'

// Item de uma área aberto pela rota da outra: troca para a rota certa.
watchEffect(() => {
  if (original && route.params.id && route.path.startsWith('/escalas') !== escala) {
    router.replace(`${base}/${original.id}/editar`)
  }
})

/** Na criação, o tipo é escolhido primeiro. */
const dados = ref<DadosCalculadora | null>(original ? paraDadosCalculadora(original) : null)
const inicial = ref(JSON.stringify(dados.value))
const alterado = computed(() => dados.value !== null && JSON.stringify(dados.value) !== inicial.value)

const TIPOS = escala
  ? [
      {
        tipo: 'pontos' as const,
        icone: ListChecks,
        titulo: 'Pontos',
        descricao: 'Sim/não, seleções e números com faixas. O resultado é a soma dos pontos.',
      },
      {
        tipo: 'formula' as const,
        icone: Calculator,
        titulo: 'Fórmula',
        descricao: 'Campos de número ou sim/não e uma ou mais expressões.',
      },
    ]
  : [
      {
        tipo: 'dose_peso' as const,
        icone: Syringe,
        titulo: 'Doses por peso',
        descricao: 'Linhas de texto com a dose calculada pelo peso onde houver {marcador}.',
      },
      {
        tipo: 'formula' as const,
        icone: Calculator,
        titulo: 'Fórmula',
        descricao: 'Campos de número ou sim/não e uma ou mais expressões.',
      },
    ]

const NOME_TIPO: Record<Calculadora['tipo'], string> = { dose_peso: 'Doses por peso', formula: 'Fórmula', pontos: 'Pontos' }

async function escolherTipo(tipo: Calculadora['tipo']) {
  dados.value = calculadoraVazia(area, tipo)
  inicial.value = JSON.stringify(dados.value)
  await focar('nome')
}

async function focar(idCampo: string) {
  await nextTick()
  const campo = document.getElementById(idCampo)
  campo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  campo?.focus({ preventScroll: true })
}

// ===== Grupo =====
const gruposDaArea = computed(() => (escala ? categorias.deEscalas : categorias.deCalculadoras))
const opcoesCategoria = computed(() => gruposDaArea.value.map((c) => ({ valor: c.id as string | null, rotulo: c.nome })))
const criandoCategoria = ref(false)
const novaCategoria = ref('')

async function abrirNovoGrupo() {
  criandoCategoria.value = true
  await focar('novo-grupo')
}

async function salvarNovaCategoria() {
  const nome = novaCategoria.value.trim()
  if (!nome || !dados.value) return
  const existente = gruposDaArea.value.find((c) => c.nome.localeCompare(nome, 'pt-BR', { sensitivity: 'base' }) === 0)
  novaCategoria.value = ''
  criandoCategoria.value = false
  dados.value.categoriaId = (existente ?? (await categorias.criar(nome, area))).id
}

// ===== Validação e avisos =====
// Os erros aparecem no topo depois da primeira tentativa de salvar e somem conforme são corrigidos.
const tentouSalvar = ref(false)
const erros = computed(() =>
  tentouSalvar.value && dados.value ? validarCalculadora(dados.value, (id) => !!categorias.obter(id)) : [],
)
const caixaErros = ref<HTMLElement | null>(null)
// Fórmula e dose por peso mostram os avisos junto de cada parte; a escala de pontos, aqui.
const avisos = computed(() => (dados.value?.tipo === 'pontos' ? avisosCalculadora(dados.value) : []))

// ===== Salvar / sair =====
let salvando = false
async function salvar() {
  if (salvando || !dados.value) return
  tentouSalvar.value = true
  if (erros.value.length) {
    await nextTick()
    caixaErros.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  salvando = true
  try {
    const salva = idEdicao ? await calculadoras.atualizar(idEdicao, dados.value) : await calculadoras.criar(dados.value)
    inicial.value = JSON.stringify(dados.value)
    toast.success(escala ? 'Escala salva.' : 'Calculadora salva.')
    await router.replace(`${base}/${salva.id}`)
  } catch (erro) {
    toast.error(`Não foi possível salvar: ${erro instanceof Error ? erro.message : String(erro)}`)
  } finally {
    salvando = false
  }
}

function cancelar() {
  // Sem histórico (aberto direto pelo link), volta para o item ou para a lista da área.
  if (window.history.state?.back) router.back()
  else router.push(idEdicao ? `${base}/${idEdicao}` : base)
}

const { confirmarSaida, responderSaida } = useAvisoSaida(alterado)

const CARTAO = 'bg-card flex flex-col gap-4 rounded-lg p-4 shadow-xs md:p-5'
const TITULO = 'text-lg font-extrabold tracking-tight'
</script>

<template>
  <section v-if="naoEncontrada" class="flex flex-col items-start gap-4">
    <h1 class="text-2xl font-semibold md:text-3xl">{{ escala ? 'Escala não encontrada' : 'Calculadora não encontrada' }}</h1>
    <Button size="touch" as-child><RouterLink :to="base">Voltar para a lista</RouterLink></Button>
  </section>

  <!-- Criação: escolher o tipo -->
  <section v-else-if="!dados" :class="CARTAO" aria-labelledby="titulo-tipo">
    <h2 id="titulo-tipo" :class="TITULO">Qual o tipo de {{ rotulo }}?</h2>
    <button
      v-for="opcao in TIPOS"
      :key="opcao.tipo"
      type="button"
      class="border-border hover:bg-accent/70 flex min-h-11 items-start gap-3 rounded-2xl border p-4 text-left transition-colors"
      @click="escolherTipo(opcao.tipo)"
    >
      <component :is="opcao.icone" class="text-primary mt-0.5 size-6 shrink-0" aria-hidden="true" />
      <span>
        <span class="block font-semibold">{{ opcao.titulo }}</span>
        <span class="text-muted-foreground text-sm">{{ opcao.descricao }}</span>
      </span>
    </button>
  </section>

  <form v-else class="flex flex-col gap-4 pb-24" novalidate @submit.prevent="salvar">
    <div
      v-if="erros.length"
      ref="caixaErros"
      role="alert"
      class="bg-critico-suave text-critico-suave-foreground border-critico/20 flex gap-3 rounded-lg border p-4 md:p-5"
    >
      <OctagonAlert class="text-critico mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div class="flex min-w-0 flex-col gap-1">
        <p class="font-bold">Corrija antes de salvar:</p>
        <ul class="list-disc pl-5 text-sm">
          <li v-for="erro in erros" :key="erro">{{ erro }}</li>
        </ul>
      </div>
    </div>

    <!-- Dados gerais -->
    <section :class="CARTAO" aria-labelledby="titulo-gerais">
      <div class="flex items-center gap-2">
        <h2 id="titulo-gerais" class="sr-only">Dados gerais</h2>
        <span class="bg-accent text-primary rounded-full px-2.5 py-0.5 text-xs font-bold">{{ NOME_TIPO[dados.tipo] }}</span>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="nome">Nome *</Label>
        <Input id="nome" v-model="dados.nome" class="h-11 text-base" autocomplete="off" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label :for="criandoCategoria ? 'novo-grupo' : 'categoria'">Grupo *</Label>
        <div v-if="!criandoCategoria" class="flex gap-2">
          <CampoSelect id="categoria" v-model="dados.categoriaId" :opcoes="opcoesCategoria" placeholder="Escolha…" class="min-w-0 flex-1" />
          <Button type="button" variant="outline" size="touch" class="rounded-full" @click="abrirNovoGrupo">
            <Plus /> Novo grupo
          </Button>
        </div>
        <div v-else class="flex gap-2">
          <Input
            id="novo-grupo"
            v-model="novaCategoria"
            class="h-11 min-w-0 flex-1"
            placeholder="Nome do novo grupo"
            @keydown.enter.prevent="salvarNovaCategoria"
          />
          <Button type="button" size="touch" class="rounded-full" @click="salvarNovaCategoria">Criar</Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            class="rounded-full"
            aria-label="Cancelar novo grupo"
            @click="criandoCategoria = false"
          >
            <X />
          </Button>
        </div>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="descricao">Descrição</Label>
        <Textarea id="descricao" v-model="dados.descricao" />
      </div>
    </section>

    <EditorDosePeso v-if="dados.tipo === 'dose_peso'" v-model="dados.linhas" />

    <EditorFormula v-else-if="dados.tipo === 'formula'" v-model:campos="dados.campos" v-model:saidas="dados.saidas" />

    <template v-else>
      <EditorCamposPontos v-model="dados.campos" />
      <section :class="CARTAO" aria-labelledby="titulo-interpretacao">
        <h2 id="titulo-interpretacao" :class="TITULO">Interpretação</h2>
        <EditorFaixasInterpretacao v-model="dados.faixas" prefixo="escala-" />
        <div v-if="avisos.length" class="bg-atencao-suave text-atencao-suave-foreground border-atencao/30 flex gap-3 rounded-2xl border p-3 text-sm">
          <TriangleAlert class="text-atencao mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <ul class="flex flex-col gap-1">
            <li v-for="aviso in avisos" :key="aviso">{{ aviso }}</li>
          </ul>
        </div>
      </section>
      <section :class="CARTAO" aria-labelledby="titulo-testar">
        <h2 id="titulo-testar" :class="TITULO">Testar</h2>
        <p class="text-muted-foreground -mt-2 text-sm">Responda para conferir o total e a interpretação. Nada daqui é salvo.</p>
        <div class="bg-background rounded-2xl p-3 md:p-4">
          <UsoPontos :calculadora="dados" />
        </div>
      </section>
    </template>

    <!-- Referência -->
    <section :class="CARTAO">
      <Label for="referencia" :class="TITULO">Referência</Label>
      <Textarea id="referencia" v-model="dados.referencia" placeholder="Fonte, link, documento…" />
    </section>

    <!-- Barra de ações flutuante, em pílula, na largura do conteúdo -->
    <div class="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 px-4 md:px-8">
      <div
        class="bg-card/95 pointer-events-auto mx-auto flex max-w-[44rem] items-center gap-2 rounded-full border p-1.5 shadow-lg backdrop-blur-md"
      >
        <Button type="button" variant="ghost" size="touch" class="flex-1 rounded-full font-semibold" @click="cancelar">
          Cancelar
        </Button>
        <Button type="submit" size="touch" class="flex-1 rounded-full font-semibold">Salvar</Button>
      </div>
    </div>

    <DialogoConfirmar
      v-model:aberto="confirmarSaida"
      titulo="Descartar alterações?"
      :descricao="`As alterações feitas nesta ${rotulo} não foram salvas.`"
      rotulo-confirmar="Descartar"
      perigoso
      @confirmar="responderSaida(true)"
      @cancelar="responderSaida(false)"
    />
  </form>
</template>
