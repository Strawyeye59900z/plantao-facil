<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, Plus, Trash2, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import CampoNumero from '@/components/comum/CampoNumero.vue'
import CampoSelect from '@/components/comum/CampoSelect.vue'
import CampoTags from '@/components/comum/CampoTags.vue'
import EditorRegraDose from './EditorRegraDose.vue'
import { limpar } from '@/dominio/dose/numeros'
import {
  alertaVazio,
  alternativaVazia,
  itemVazio,
  moverItem,
  removerItem,
  type DadosPrescricao,
} from '@/dominio/prescricoes/editar'
import { GRAVIDADES, ROTULO_GRAVIDADE, ROTULO_TIPO_ALERTA, type Gravidade, type TipoAlerta, type UUID } from '@/dominio/tipos'
import { ROTULO_SEM_CATEGORIA, useCategoriasStore } from '@/stores/categorias'

/**
 * Formulário de prescrição (editor e revisão da importação por IA).
 * `prefixo` deixa os ids únicos quando há mais de um formulário na tela.
 */
const props = withDefaults(defineProps<{ prefixo?: string; aceitarSemCategoria?: boolean }>(), {
  prefixo: '',
  aceitarSemCategoria: false,
})
const dados = defineModel<DadosPrescricao>({ required: true })

const categorias = useCategoriasStore()
const id = (nome: string) => `${props.prefixo}${nome}`

// Peso só para testar as regras no editor — nunca é salvo.
const pesoTesteDigitado = ref<number | null>(null)
const pesoTeste = computed(() => {
  const p = pesoTesteDigitado.value
  return p !== null && p > 0 && Number.isInteger(limpar(p * 10)) ? p : null
})

// ===== Categoria =====
const opcoesCategoria = computed(() => [
  ...(props.aceitarSemCategoria ? [{ valor: null as string | null, rotulo: ROTULO_SEM_CATEGORIA }] : []),
  ...categorias.dePrescricoes.map((c) => ({ valor: c.id as string | null, rotulo: c.nome })),
])
const criandoCategoria = ref(false)
const novaCategoria = ref('')

async function salvarNovaCategoria() {
  const nome = novaCategoria.value.trim()
  if (!nome) return
  const existente = categorias.dePrescricoes.find((c) => c.nome.localeCompare(nome, 'pt-BR', { sensitivity: 'base' }) === 0)
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

/** Liga/desliga opções equivalentes; ao ligar sem nenhuma alternativa, já cria a opção 2. */
function alternarOpcoes(indiceItem: number, ligado: boolean) {
  const item = dados.value.itens[indiceItem]!
  item.opcoesEquivalentes = ligado
  if (ligado && item.alternativas.length === 0) item.alternativas.push(alternativaVazia())
}

function removerAlternativa(indiceItem: number, altId: UUID) {
  const item = dados.value.itens[indiceItem]!
  item.alternativas = item.alternativas.filter((a) => a.id !== altId)
}

// ===== Alertas =====
const opcoesTipo = (Object.keys(ROTULO_TIPO_ALERTA) as TipoAlerta[]).map((t) => ({ valor: t, rotulo: ROTULO_TIPO_ALERTA[t] }))
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
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Dados gerais -->
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <Label :for="id('titulo')">Título (doença/situação) *</Label>
        <Input :id="id('titulo')" v-model="dados.titulo" class="h-11" autocomplete="off" />
      </div>

      <div class="flex flex-col gap-1.5">
        <Label :for="id('categoria')">Categoria{{ aceitarSemCategoria ? '' : ' *' }}</Label>
        <div v-if="!criandoCategoria" class="flex gap-2">
          <CampoSelect
            :id="id('categoria')"
            v-model="dados.categoriaId"
            :opcoes="opcoesCategoria"
            :placeholder="aceitarSemCategoria ? undefined : 'Escolha…'"
            class="flex-1"
          />
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
          <Button type="button" variant="ghost" size="icon-touch" aria-label="Cancelar" @click="criandoCategoria = false">
            <X />
          </Button>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <Label :for="id('tags')">Tags</Label>
        <CampoTags :id="id('tags')" v-model="dados.tags" />
      </div>
    </div>

    <!-- Itens -->
    <fieldset class="flex flex-col gap-3">
      <legend class="mb-2 text-lg font-semibold">Itens *</legend>
      <div class="flex items-center gap-3">
        <Label :for="id('peso-teste')" class="shrink-0">Testar com peso</Label>
        <CampoNumero :id="id('peso-teste')" v-model="pesoTesteDigitado" sufixo="kg" class="w-32" />
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
        <!-- Opções equivalentes (OU): texto principal = opção 1; alternativas = opções 2, 3… -->
        <Label class="flex items-center justify-between gap-3 font-normal">
          <span>
            Opções equivalentes (“OU”)
            <span class="text-muted-foreground block text-xs">Na prescrição, uma delas precisa ser escolhida antes de copiar.</span>
          </span>
          <Switch
            :model-value="!!item.opcoesEquivalentes"
            :aria-label="`Opções equivalentes no item ${i + 1}`"
            @update:model-value="(v: boolean) => alternarOpcoes(i, v)"
          />
        </Label>

        <span v-if="item.opcoesEquivalentes" class="text-muted-foreground -mb-2 text-sm font-medium">Opção 1</span>
        <Textarea v-model="item.texto" :aria-label="`Texto do item ${i + 1}`" class="min-h-20" />
        <EditorRegraDose v-model:regra="item.regraDose" :chave="id(`item-${i}`)" :texto="item.texto" :peso-teste="pesoTeste" />

        <!-- Alternativas (ou opções 2, 3… quando equivalentes) -->
        <div v-for="(alt, j) in item.alternativas" :key="alt.id" class="border-primary/50 flex flex-col gap-2 border-l-2 pl-3">
          <div class="flex items-center gap-2">
            <span class="text-muted-foreground flex-1 text-sm font-medium">
              {{ item.opcoesEquivalentes ? `Opção ${j + 2}` : `Alternativa ${j + 1}` }}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-touch"
              :aria-label="item.opcoesEquivalentes ? 'Remover opção' : 'Remover alternativa'"
              @click="removerAlternativa(i, alt.id)"
            >
              <X />
            </Button>
          </div>
          <Input
            v-model="alt.motivo"
            class="h-11"
            :placeholder="item.opcoesEquivalentes ? 'Rótulo (opcional)' : 'Motivo (ex.: alergia a …)'"
            :aria-label="`${item.opcoesEquivalentes ? 'Rótulo da opção' : 'Motivo da alternativa'} ${j + 1} do item ${i + 1}`"
          />
          <Textarea
            v-model="alt.texto"
            :placeholder="item.opcoesEquivalentes ? 'Texto da opção' : 'Texto da alternativa'"
            :aria-label="`Texto da alternativa ${j + 1} do item ${i + 1}`"
          />
          <EditorRegraDose v-model:regra="alt.regraDose" :chave="id(`item-${i}-alt-${j}`)" :texto="alt.texto" :peso-teste="pesoTeste" />
        </div>
        <Button type="button" variant="ghost" size="touch" class="self-start" @click="adicionarAlternativa(i)">
          <Plus /> {{ item.opcoesEquivalentes ? 'Opção' : 'Alternativa' }}
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

    <!-- Receita pronta, observações e referência -->
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <Label :for="id('receita')">Receita pronta</Label>
        <Textarea :id="id('receita')" v-model="dados.receita" class="min-h-32" placeholder="Opcional. Copiada como está, com as quebras de linha." />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label :for="id('observacoes')">Observações</Label>
        <Textarea :id="id('observacoes')" v-model="dados.observacoes" class="min-h-20" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label :for="id('referencia')">Referência / fonte</Label>
        <Textarea :id="id('referencia')" v-model="dados.referencia" />
      </div>
    </div>
  </div>
</template>
