<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAvisoSaida } from '@/composables/useAvisoSaida'
import { toast } from 'vue-sonner'
import { ArrowDown, ArrowUp, Plus, Trash2, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import CampoSelect from '@/components/comum/CampoSelect.vue'
import CampoTags from '@/components/comum/CampoTags.vue'
import CampoNumero from '@/components/comum/CampoNumero.vue'
import EditorRegraDose from '@/components/prescricoes/EditorRegraDose.vue'
import { limpar } from '@/dominio/dose/numeros'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
import {
  alertaVazio,
  alternativaVazia,
  itemVazio,
  moverItem,
  paraDados,
  prescricaoVazia,
  removerItem,
  validarPrescricao,
  type DadosPrescricao,
} from '@/dominio/prescricoes/editar'
import {
  GRAVIDADES,
  ROTULO_GRAVIDADE,
  ROTULO_TIPO_ALERTA,
  type Gravidade,
  type TipoAlerta,
  type UUID,
} from '@/dominio/tipos'
import { useCategoriasStore } from '@/stores/categorias'
import { usePrescricoesStore } from '@/stores/prescricoes'

const route = useRoute()
const router = useRouter()
const prescricoes = usePrescricoesStore()
const categorias = useCategoriasStore()

const idEdicao = computed(() => (route.params.id ? String(route.params.id) : null))
const original = idEdicao.value ? prescricoes.obter(idEdicao.value) : undefined
const naoEncontrada = idEdicao.value !== null && !original

const dados = ref<DadosPrescricao>(original ? paraDados(original) : prescricaoVazia())
const inicial = ref(JSON.stringify(dados.value))
const alterado = computed(() => JSON.stringify(dados.value) !== inicial.value)

const erros = ref<string[]>([])

// Peso só para testar as regras no editor — nunca é salvo.
const pesoTesteDigitado = ref<number | null>(null)
const pesoTeste = computed(() => {
  const p = pesoTesteDigitado.value
  return p !== null && p > 0 && Number.isInteger(limpar(p * 10)) ? p : null
})
const caixaErros = ref<HTMLElement | null>(null)

// ===== Categoria =====
const opcoesCategoria = computed(() =>
  categorias.dePrescricoes.map((c) => ({ valor: c.id as string | null, rotulo: c.nome })),
)
const criandoCategoria = ref(false)
const novaCategoria = ref('')

async function salvarNovaCategoria() {
  const nome = novaCategoria.value.trim()
  if (!nome) return
  const existente = categorias.dePrescricoes.find(
    (c) => c.nome.localeCompare(nome, 'pt-BR', { sensitivity: 'base' }) === 0,
  )
  novaCategoria.value = ''
  criandoCategoria.value = false
  const categoria = existente ?? (await categorias.criar(nome, 'prescricao'))
  dados.value.categoriaId = categoria.id
}

// ===== Itens =====
function adicionarItem() {
  dados.value.itens.push(itemVazio())
}

function mover(indice: number, direcao: -1 | 1) {
  dados.value.itens = moverItem(dados.value.itens, indice, direcao)
}

function remover(itemId: UUID) {
  dados.value = removerItem(dados.value, itemId)
}

function adicionarAlternativa(indiceItem: number) {
  dados.value.itens[indiceItem]!.alternativas.push(alternativaVazia())
}

function removerAlternativa(indiceItem: number, altId: UUID) {
  const item = dados.value.itens[indiceItem]!
  item.alternativas = item.alternativas.filter((a) => a.id !== altId)
}

// ===== Alertas =====
const opcoesTipo = (Object.keys(ROTULO_TIPO_ALERTA) as TipoAlerta[]).map((t) => ({
  valor: t,
  rotulo: ROTULO_TIPO_ALERTA[t],
}))
const opcoesGravidade = GRAVIDADES.map((g) => ({ valor: g as Gravidade, rotulo: ROTULO_GRAVIDADE[g] }))
const opcoesVinculo = computed(() => [
  { valor: null as string | null, rotulo: 'Prescrição inteira' },
  ...dados.value.itens.map((item, i) => ({
    valor: item.id as string | null,
    rotulo: `Item ${i + 1}${item.texto.trim() ? ` — ${item.texto.trim().slice(0, 40)}` : ''}`,
  })),
])

function adicionarAlerta() {
  dados.value.alertas.push(alertaVazio())
}

function removerAlerta(alertaId: UUID) {
  dados.value.alertas = dados.value.alertas.filter((a) => a.id !== alertaId)
}

// ===== Salvar / sair =====
let salvando = false

async function salvar() {
  if (salvando) return
  erros.value = validarPrescricao(dados.value, (id) => !!categorias.obter(id))
  if (erros.value.length) {
    await nextTick()
    caixaErros.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  salvando = true
  try {
    const salva = idEdicao.value
      ? await prescricoes.atualizar(idEdicao.value, dados.value)
      : await prescricoes.criar(dados.value)
    inicial.value = JSON.stringify(dados.value)
    toast.success('Prescrição salva.')
    await router.replace(`/prescricoes/${salva.id}`)
  } catch (erro) {
    toast.error(`Não foi possível salvar: ${erro instanceof Error ? erro.message : String(erro)}`)
  } finally {
    salvando = false
  }
}

function cancelar() {
  router.back()
}

// Aviso ao sair com alterações não salvas (depois de salvar, `inicial` é atualizado e libera a saída).
const { confirmarSaida, responderSaida } = useAvisoSaida(alterado)
</script>

<template>
  <section v-if="naoEncontrada" class="flex flex-col items-start gap-4">
    <h1 class="text-2xl font-semibold">Prescrição não encontrada</h1>
    <Button size="touch" as-child><RouterLink to="/prescricoes">Voltar para a lista</RouterLink></Button>
  </section>

  <form v-else class="flex flex-col gap-6 pb-24" novalidate @submit.prevent="salvar">
    <h1 class="text-2xl font-semibold">{{ idEdicao ? 'Editar prescrição' : 'Nova prescrição' }}</h1>

    <div
      v-if="erros.length"
      ref="caixaErros"
      role="alert"
      class="border-critico bg-critico/12 rounded-xl border p-3"
    >
      <p class="font-semibold">Corrija antes de salvar:</p>
      <ul class="list-disc pl-5 text-sm">
        <li v-for="erro in erros" :key="erro">{{ erro }}</li>
      </ul>
    </div>

    <!-- Dados gerais -->
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <Label for="titulo">Título (doença/situação) *</Label>
        <Input id="titulo" v-model="dados.titulo" class="h-11" autocomplete="off" />
      </div>

      <div class="flex flex-col gap-1.5">
        <Label for="categoria">Categoria *</Label>
        <div v-if="!criandoCategoria" class="flex gap-2">
          <CampoSelect
            id="categoria"
            v-model="dados.categoriaId"
            :opcoes="opcoesCategoria"
            placeholder="Escolha…"
            class="flex-1"
          />
          <Button type="button" variant="outline" size="touch" @click="criandoCategoria = true">
            <Plus /> Nova
          </Button>
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
          <Button type="button" variant="ghost" size="icon-touch" aria-label="Cancelar" @click="criandoCategoria = false">
            <X />
          </Button>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <Label for="tags">Tags</Label>
        <CampoTags id="tags" v-model="dados.tags" />
      </div>
    </div>

    <!-- Itens -->
    <fieldset class="flex flex-col gap-3">
      <legend class="mb-2 text-lg font-semibold">Itens *</legend>
      <div class="flex items-center gap-3">
        <Label for="peso-teste" class="shrink-0">Testar com peso</Label>
        <CampoNumero id="peso-teste" v-model="pesoTesteDigitado" sufixo="kg" class="w-32" />
        <span class="text-muted-foreground text-xs">não é salvo</span>
      </div>
      <div
        v-for="(item, i) in dados.itens"
        :key="item.id"
        class="bg-card ring-foreground/10 flex flex-col gap-3 rounded-xl p-3 ring-1"
      >
        <div class="flex items-center gap-1">
          <span class="flex-1 font-semibold">Item {{ i + 1 }}</span>
          <Button type="button" variant="ghost" size="icon-touch" :disabled="i === 0" aria-label="Mover para cima" @click="mover(i, -1)">
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            :disabled="i === dados.itens.length - 1"
            aria-label="Mover para baixo"
            @click="mover(i, 1)"
          >
            <ArrowDown />
          </Button>
          <Button type="button" variant="ghost" size="icon-touch" aria-label="Remover item" @click="remover(item.id)">
            <Trash2 class="text-destructive" />
          </Button>
        </div>
        <Textarea v-model="item.texto" :aria-label="`Texto do item ${i + 1}`" class="min-h-20" />
        <EditorRegraDose v-model:regra="item.regraDose" :chave="`item-${i}`" :texto="item.texto" :peso-teste="pesoTeste" />

        <!-- Alternativas do item -->
        <div v-for="(alt, j) in item.alternativas" :key="alt.id" class="border-primary/50 flex flex-col gap-2 border-l-2 pl-3">
          <div class="flex items-center gap-2">
            <span class="text-muted-foreground flex-1 text-sm font-medium">Alternativa {{ j + 1 }}</span>
            <Button type="button" variant="ghost" size="icon-touch" aria-label="Remover alternativa" @click="removerAlternativa(i, alt.id)">
              <X />
            </Button>
          </div>
          <Input v-model="alt.motivo" class="h-11" placeholder="Motivo (ex.: alergia a …)" :aria-label="`Motivo da alternativa ${j + 1} do item ${i + 1}`" />
          <Textarea v-model="alt.texto" placeholder="Texto da alternativa" :aria-label="`Texto da alternativa ${j + 1} do item ${i + 1}`" />
          <EditorRegraDose v-model:regra="alt.regraDose" :chave="`item-${i}-alt-${j}`" :texto="alt.texto" :peso-teste="pesoTeste" />
        </div>
        <Button type="button" variant="ghost" size="touch" class="self-start" @click="adicionarAlternativa(i)">
          <Plus /> Alternativa
        </Button>
      </div>
      <Button type="button" variant="outline" size="touch" @click="adicionarItem"><Plus /> Adicionar item</Button>
    </fieldset>

    <!-- Alertas -->
    <fieldset class="flex flex-col gap-3">
      <legend class="mb-2 text-lg font-semibold">Alertas</legend>
      <div
        v-for="(alerta, i) in dados.alertas"
        :key="alerta.id"
        class="bg-card ring-foreground/10 flex flex-col gap-3 rounded-xl p-3 ring-1"
      >
        <div class="flex items-center gap-2">
          <span class="flex-1 font-semibold">Alerta {{ i + 1 }}</span>
          <Button type="button" variant="ghost" size="icon-touch" aria-label="Remover alerta" @click="removerAlerta(alerta.id)">
            <Trash2 class="text-destructive" />
          </Button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <CampoSelect v-model="alerta.tipo" :opcoes="opcoesTipo" :aria-label="`Tipo do alerta ${i + 1}`" />
          <CampoSelect v-model="alerta.gravidade" :opcoes="opcoesGravidade" :aria-label="`Gravidade do alerta ${i + 1}`" />
        </div>
        <CampoSelect v-model="alerta.itemId" :opcoes="opcoesVinculo" :aria-label="`Vínculo do alerta ${i + 1}`" />
        <Textarea v-model="alerta.texto" placeholder="Texto do alerta" :aria-label="`Texto do alerta ${i + 1}`" />
      </div>
      <Button type="button" variant="outline" size="touch" @click="adicionarAlerta"><Plus /> Adicionar alerta</Button>
    </fieldset>

    <!-- Observações e referência -->
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <Label for="observacoes">Observações</Label>
        <Textarea id="observacoes" v-model="dados.observacoes" class="min-h-20" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="referencia">Referência / fonte</Label>
        <Textarea id="referencia" v-model="dados.referencia" />
      </div>
    </div>

    <!-- Barra de ações fixa -->
    <div
      class="bg-background/95 fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t backdrop-blur md:bottom-0 md:left-60"
    >
      <div class="mx-auto flex max-w-3xl gap-2 px-3 py-2">
        <Button type="button" variant="outline" size="touch" class="flex-1" @click="cancelar">Cancelar</Button>
        <Button type="submit" size="touch" class="flex-1">Salvar</Button>
      </div>
    </div>

    <DialogoConfirmar
      v-model:aberto="confirmarSaida"
      titulo="Descartar alterações?"
      descricao="As alterações feitas nesta prescrição não foram salvas."
      rotulo-confirmar="Descartar"
      perigoso
      @confirmar="responderSaida(true)"
      @cancelar="responderSaida(false)"
    />
  </form>
</template>
