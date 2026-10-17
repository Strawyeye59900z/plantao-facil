<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Calculator, ListChecks, Plus, TriangleAlert, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import CampoSelect from '@/components/comum/CampoSelect.vue'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
import EditorCamposPontos from '@/components/calculadoras/EditorCamposPontos.vue'
import EditorFaixasInterpretacao from '@/components/calculadoras/EditorFaixasInterpretacao.vue'
import EditorFormula from '@/components/calculadoras/EditorFormula.vue'
import UsoCalculadora from '@/components/calculadoras/UsoCalculadora.vue'
import { useAvisoSaida } from '@/composables/useAvisoSaida'
import {
  avisosCalculadora,
  calculadoraVazia,
  paraDadosCalculadora,
  validarCalculadora,
  type DadosCalculadora,
} from '@/dominio/calculadoras/editar'
import type { Calculadora } from '@/dominio/tipos'
import { useCalculadorasStore } from '@/stores/calculadoras'
import { useCategoriasStore } from '@/stores/categorias'

const route = useRoute()
const router = useRouter()
const calculadoras = useCalculadorasStore()
const categorias = useCategoriasStore()

const idEdicao = route.params.id ? String(route.params.id) : null
const original = idEdicao ? calculadoras.obter(idEdicao) : undefined
const naoEncontrada = idEdicao !== null && !original

/** Na criação, o tipo é escolhido primeiro. */
const dados = ref<DadosCalculadora | null>(original ? paraDadosCalculadora(original) : null)
const inicial = ref(JSON.stringify(dados.value))
const alterado = computed(() => dados.value !== null && JSON.stringify(dados.value) !== inicial.value)

function escolherTipo(tipo: Calculadora['tipo']) {
  dados.value = calculadoraVazia(tipo)
  inicial.value = JSON.stringify(dados.value)
}

// ===== Categoria =====
const opcoesCategoria = computed(() =>
  categorias.deCalculadoras.map((c) => ({ valor: c.id as string | null, rotulo: c.nome })),
)
const criandoCategoria = ref(false)
const novaCategoria = ref('')

async function salvarNovaCategoria() {
  const nome = novaCategoria.value.trim()
  if (!nome || !dados.value) return
  novaCategoria.value = ''
  criandoCategoria.value = false
  const existente = categorias.deCalculadoras.find((c) => c.nome.localeCompare(nome, 'pt-BR', { sensitivity: 'base' }) === 0)
  dados.value.categoriaId = (existente ?? (await categorias.criar(nome, 'calculadora'))).id
}

// ===== Validação, avisos e teste =====
const erros = ref<string[]>([])
const caixaErros = ref<HTMLElement | null>(null)
const avisos = computed(() => (dados.value ? avisosCalculadora(dados.value) : []))
const mostrarTeste = ref(false)

// ===== Salvar =====
let salvando = false
async function salvar() {
  if (salvando || !dados.value) return
  erros.value = validarCalculadora(dados.value, (id) => !!categorias.obter(id))
  if (erros.value.length) {
    await nextTick()
    caixaErros.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  salvando = true
  try {
    const salva = idEdicao ? await calculadoras.atualizar(idEdicao, dados.value) : await calculadoras.criar(dados.value)
    inicial.value = JSON.stringify(dados.value)
    toast.success('Calculadora salva.')
    await router.replace(`/calculadoras/${salva.id}`)
  } catch (erro) {
    toast.error(`Não foi possível salvar: ${erro instanceof Error ? erro.message : String(erro)}`)
  } finally {
    salvando = false
  }
}

const { confirmarSaida, responderSaida } = useAvisoSaida(alterado)
</script>

<template>
  <section v-if="naoEncontrada" class="flex flex-col items-start gap-4">
    <h1 class="text-2xl font-semibold md:text-3xl">Calculadora não encontrada</h1>
    <Button size="touch" as-child><RouterLink to="/calculadoras">Voltar para a lista</RouterLink></Button>
  </section>

  <!-- Criação: escolher o tipo -->
  <section v-else-if="!dados" class="flex flex-col gap-4">
    <h1 class="text-2xl font-semibold md:text-3xl">Nova calculadora</h1>
    <p class="text-muted-foreground">Qual o tipo?</p>
    <button
      type="button"
      class="bg-card border shadow-xs hover:bg-accent/70 flex items-start gap-3 rounded-2xl p-4 text-left"
      @click="escolherTipo('pontos')"
    >
      <ListChecks class="text-primary mt-0.5 size-6 shrink-0" />
      <span>
        <span class="block font-semibold">Escore por pontos</span>
        <span class="text-muted-foreground text-sm">Checklist de sim/não, seleções e números com faixas. Resultado = soma.</span>
      </span>
    </button>
    <button
      type="button"
      class="bg-card border shadow-xs hover:bg-accent/70 flex items-start gap-3 rounded-2xl p-4 text-left"
      @click="escolherTipo('formula')"
    >
      <Calculator class="text-primary mt-0.5 size-6 shrink-0" />
      <span>
        <span class="block font-semibold">Fórmula</span>
        <span class="text-muted-foreground text-sm">Entradas numéricas e uma expressão matemática.</span>
      </span>
    </button>
  </section>

  <form v-else class="flex flex-col gap-6 pb-24" novalidate @submit.prevent="salvar">
    <h1 class="text-2xl font-semibold md:text-3xl">
      {{ idEdicao ? 'Editar calculadora' : 'Nova calculadora' }}
      <span class="text-muted-foreground text-base font-normal">· {{ dados.tipo === 'pontos' ? 'escore por pontos' : 'fórmula' }}</span>
    </h1>

    <div v-if="erros.length" ref="caixaErros" role="alert" class="border-critico/35 bg-critico/10 rounded-xl border p-3">
      <p class="font-semibold">Corrija antes de salvar:</p>
      <ul class="list-disc pl-5 text-sm">
        <li v-for="erro in erros" :key="erro">{{ erro }}</li>
      </ul>
    </div>

    <!-- Dados gerais -->
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <Label for="nome">Nome *</Label>
        <Input id="nome" v-model="dados.nome" class="h-11" autocomplete="off" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="categoria">Categoria *</Label>
        <div v-if="!criandoCategoria" class="flex gap-2">
          <CampoSelect id="categoria" v-model="dados.categoriaId" :opcoes="opcoesCategoria" placeholder="Escolha…" class="flex-1" />
          <Button type="button" variant="outline" size="touch" @click="criandoCategoria = true"><Plus /> Nova</Button>
        </div>
        <div v-else class="flex gap-2">
          <Input
            v-model="novaCategoria"
            class="h-11 flex-1"
            placeholder="Nome da nova categoria"
            aria-label="Nome da nova categoria"
            @keydown.enter.prevent="salvarNovaCategoria"
          />
          <Button type="button" size="touch" @click="salvarNovaCategoria">Criar</Button>
          <Button type="button" variant="ghost" size="icon-touch" aria-label="Cancelar" @click="criandoCategoria = false"><X /></Button>
        </div>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="descricao">Descrição</Label>
        <Textarea id="descricao" v-model="dados.descricao" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="referencia">Referência / fonte</Label>
        <Textarea id="referencia" v-model="dados.referencia" />
      </div>
    </div>

    <EditorCamposPontos v-if="dados.tipo === 'pontos'" v-model="dados.campos" />
    <EditorFormula
      v-else
      v-model:entradas="dados.entradas"
      v-model:expressao="dados.expressao"
      v-model:unidade-resultado="dados.unidadeResultado"
      v-model:casas-decimais="dados.casasDecimais"
      v-model:teto="dados.teto"
      v-model:piso="dados.piso"
    />

    <EditorFaixasInterpretacao v-model="dados.faixas" />

    <!-- Avisos (não impedem salvar) -->
    <div v-if="avisos.length" class="border-atencao/45 bg-atencao/12 flex flex-col gap-1 rounded-xl border p-3 text-sm">
      <p class="flex items-center gap-2 font-semibold"><TriangleAlert class="text-atencao size-4" /> Avisos</p>
      <ul class="list-disc pl-5">
        <li v-for="aviso in avisos" :key="aviso">{{ aviso }}</li>
      </ul>
    </div>

    <!-- Testar antes de salvar -->
    <div class="flex flex-col gap-3 border-t pt-4">
      <Button type="button" variant="outline" size="touch" class="self-start" @click="mostrarTeste = !mostrarTeste">
        <Calculator /> {{ mostrarTeste ? 'Fechar teste' : 'Testar calculadora' }}
      </Button>
      <UsoCalculadora v-if="mostrarTeste" :calculadora="dados" />
    </div>

    <div class="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 px-3 md:bottom-4 md:left-64 md:px-8">
      <div class="bg-card/95 pointer-events-auto mx-auto flex max-w-[44rem] items-center gap-2 rounded-2xl border p-2 shadow-lg backdrop-blur-md">
        <Button type="button" variant="outline" size="touch" class="flex-1" @click="router.back()">Cancelar</Button>
        <Button type="submit" size="touch" class="flex-1">Salvar</Button>
      </div>
    </div>

    <DialogoConfirmar
      v-model:aberto="confirmarSaida"
      titulo="Descartar alterações?"
      descricao="As alterações feitas nesta calculadora não foram salvas."
      rotulo-confirmar="Descartar"
      perigoso
      @confirmar="responderSaida(true)"
      @cancelar="responderSaida(false)"
    />
  </form>
</template>
