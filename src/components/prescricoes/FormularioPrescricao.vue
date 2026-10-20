<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ArrowDown, ArrowUp, Plus, Trash2, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import AjudaRecolhivel from '@/components/comum/AjudaRecolhivel.vue'
import CampoSelect from '@/components/comum/CampoSelect.vue'
import CampoTags from '@/components/comum/CampoTags.vue'
import {
  alertaVazio,
  definirCondicaoDoItem,
  itemVazio,
  moverCondicao,
  moverItemNoGrupo,
  opcaoVazia,
  podeMoverItemNoGrupo,
  removerCondicao,
  removerItem,
  removerOpcao,
  type DadosPrescricao,
} from '@/dominio/prescricoes/editar'
import { condicaoDoItem, condicaoVazia, ordenarPorCondicao } from '@/dominio/prescricoes/condicoes'
import {
  GRAVIDADES,
  ROTULO_GRAVIDADE,
  ROTULO_TIPO_ALERTA,
  type Alerta,
  type Gravidade,
  type TipoAlerta,
  type UUID,
} from '@/dominio/tipos'
import { cn } from '@/lib/utils'
import { ROTULO_SEM_CATEGORIA, useCategoriasStore } from '@/stores/categorias'
import { ESTILO_GRAVIDADE } from './gravidade'
import SeletorCalculadoras from './SeletorCalculadoras.vue'

/**
 * Formulário de prescrição (editor e revisão da importação por IA), em cartões:
 * dados gerais → condições → itens (opções "OU") → alertas → calculadoras e escalas → observações → receita → referência.
 * `prefixo` deixa os ids únicos quando há mais de um formulário na tela.
 */
const props = withDefaults(defineProps<{ prefixo?: string; aceitarSemCategoria?: boolean }>(), {
  prefixo: '',
  aceitarSemCategoria: false,
})
const dados = defineModel<DadosPrescricao>({ required: true })

const categorias = useCategoriasStore()
const id = (nome: string) => `${props.prefixo}${nome}`

/** Foca um campo criado agora (item, opção, condição ou alerta novo). */
async function focar(idCampo: string) {
  await nextTick()
  const campo = document.getElementById(idCampo)
  campo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  campo?.focus({ preventScroll: true })
}

// ===== Grupo =====
const opcoesCategoria = computed(() => [
  ...(props.aceitarSemCategoria ? [{ valor: null as string | null, rotulo: ROTULO_SEM_CATEGORIA }] : []),
  ...categorias.dePrescricoes.map((c) => ({ valor: c.id as string | null, rotulo: c.nome })),
])
const criandoCategoria = ref(false)
const novaCategoria = ref('')

async function abrirNovoGrupo() {
  criandoCategoria.value = true
  await focar(id('novo-grupo'))
}

async function salvarNovaCategoria() {
  const nome = novaCategoria.value.trim()
  if (!nome) return
  const existente = categorias.dePrescricoes.find((c) => c.nome.localeCompare(nome, 'pt-BR', { sensitivity: 'base' }) === 0)
  novaCategoria.value = ''
  criandoCategoria.value = false
  const categoria = existente ?? (await categorias.criar(nome, 'prescricao'))
  dados.value.categoriaId = categoria.id
}

// ===== Condições =====
const nomeCondicao = (i: number) => dados.value.condicoes[i]?.nome.trim() || `Condição ${i + 1}`

function adicionarCondicao() {
  const nova = condicaoVazia()
  dados.value.condicoes.push(nova)
  focar(id(`condicao-${nova.id}`))
}

function trocarOrdemCondicao(indice: number, direcao: -1 | 1) {
  dados.value = moverCondicao(dados.value, indice, direcao)
}

function excluirCondicao(condicaoId: UUID) {
  dados.value = removerCondicao(dados.value, condicaoId)
}

const opcoesCondicao = computed(() => [
  { valor: null as string | null, rotulo: 'Sempre' },
  ...dados.value.condicoes.map((c, i) => ({ valor: c.id as string | null, rotulo: nomeCondicao(i) })),
])

// ===== Itens =====
// Ficam sempre agrupados: "Sempre" primeiro, depois cada condição na ordem.
const grupoDe = (indiceItem: number) => condicaoDoItem(dados.value.itens[indiceItem]!, dados.value.condicoes)

/** Título do grupo antes do item (no primeiro item de cada grupo, só se houver condições). */
function tituloGrupo(indiceItem: number): string | null {
  if (!dados.value.condicoes.length) return null
  const grupo = grupoDe(indiceItem)
  if (indiceItem > 0 && grupoDe(indiceItem - 1) === grupo) return null
  if (grupo === null) return 'Sempre'
  return nomeCondicao(dados.value.condicoes.findIndex((c) => c.id === grupo))
}

function adicionarItem() {
  const novo = itemVazio()
  dados.value.itens = ordenarPorCondicao([...dados.value.itens, novo], dados.value.condicoes)
  focar(id(`opcao-${novo.opcoes[0]!.id}`))
}

/** Trocar a condição leva o item para o fim do grupo novo. */
function trocarCondicao(itemId: UUID, condicaoId: UUID | null) {
  dados.value = definirCondicaoDoItem(dados.value, itemId, condicaoId)
}

/** ↑/↓ só dentro do grupo da condição. */
function mover(indice: number, direcao: -1 | 1) {
  dados.value = moverItemNoGrupo(dados.value, indice, direcao)
}

/** Alertas do item removido passam a valer para a prescrição inteira. */
function remover(itemId: UUID) {
  dados.value = removerItem(dados.value, itemId)
}

function adicionarOpcao(indiceItem: number) {
  const nova = opcaoVazia()
  dados.value.itens[indiceItem]!.opcoes.push(nova)
  focar(id(`opcao-${nova.id}`))
}

function excluirOpcao(indiceItem: number, opcaoId: UUID) {
  const item = dados.value.itens[indiceItem]!
  dados.value.itens[indiceItem] = removerOpcao(item, opcaoId)
}

/** Motivo aparece em todas as opções de um item "OU" e, no item simples, só se já estiver preenchido. */
const mostrarMotivo = (opcoes: { motivo: string }[], j: number) => opcoes.length >= 2 || opcoes[j]!.motivo !== ''

const alertasDoItem = (itemId: UUID) => dados.value.alertas.filter((a) => a.itemId === itemId).length

// ===== Alertas =====
const opcoesTipo = (Object.keys(ROTULO_TIPO_ALERTA) as TipoAlerta[]).map((t) => ({ valor: t, rotulo: ROTULO_TIPO_ALERTA[t] }))
const opcoesGravidade = GRAVIDADES.map((g) => ({ valor: g as Gravidade, rotulo: ROTULO_GRAVIDADE[g] }))

function resumoItem(i: number): string {
  const texto = dados.value.itens[i]!.opcoes[0]?.texto.trim().replace(/\s+/g, ' ') ?? ''
  return `Item ${i + 1}${texto ? ` — ${texto.length > 40 ? `${texto.slice(0, 40)}…` : texto}` : ''}`
}

const opcoesVinculo = computed(() => [
  { valor: null as string | null, rotulo: 'Prescrição inteira' },
  ...dados.value.itens.map((item, i) => ({ valor: item.id as string | null, rotulo: resumoItem(i) })),
])

/** Alerta ligado a um item que não existe mais (dados importados): mostra o vínculo em vez de um campo vazio. */
function opcoesVinculoDe(alerta: Alerta) {
  if (alerta.itemId === null || dados.value.itens.some((i) => i.id === alerta.itemId)) return opcoesVinculo.value
  return [...opcoesVinculo.value, { valor: alerta.itemId as string | null, rotulo: 'Item inexistente (aparece no topo)' }]
}

function adicionarAlerta() {
  const novo = alertaVazio()
  dados.value.alertas.push(novo)
  focar(id(`alerta-${novo.id}`))
}

function removerAlerta(alertaId: UUID) {
  dados.value.alertas = dados.value.alertas.filter((a) => a.id !== alertaId)
}

// ===== Estilos =====
const CARTAO = 'bg-card flex flex-col gap-4 rounded-lg p-4 shadow-xs md:p-5'
const TITULO = 'text-lg font-extrabold tracking-tight'
const DICA = 'text-muted-foreground -mt-2 text-sm'
const BOTAO_ICONE = 'rounded-full'
const ROTULO_GRUPO = 'text-xs font-semibold'
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 1. Dados gerais -->
    <section :class="CARTAO" :aria-labelledby="id('titulo-gerais')">
      <h2 :id="id('titulo-gerais')" class="sr-only">Dados gerais</h2>
      <div class="flex flex-col gap-1.5">
        <Label :for="id('titulo')">Título (doença/situação) *</Label>
        <Input :id="id('titulo')" v-model="dados.titulo" class="h-11 text-base" autocomplete="off" />
      </div>

      <div class="flex flex-col gap-1.5">
        <Label :for="criandoCategoria ? id('novo-grupo') : id('categoria')">Grupo{{ aceitarSemCategoria ? '' : ' *' }}</Label>
        <div v-if="!criandoCategoria" class="flex gap-2">
          <CampoSelect
            :id="id('categoria')"
            v-model="dados.categoriaId"
            :opcoes="opcoesCategoria"
            :placeholder="aceitarSemCategoria ? undefined : 'Escolha…'"
            class="min-w-0 flex-1"
          />
          <Button type="button" variant="outline" size="touch" class="rounded-full" @click="abrirNovoGrupo">
            <Plus /> Novo grupo
          </Button>
        </div>
        <div v-else class="flex gap-2">
          <Input
            :id="id('novo-grupo')"
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
            :class="BOTAO_ICONE"
            aria-label="Cancelar novo grupo"
            @click="criandoCategoria = false"
          >
            <X />
          </Button>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <Label :for="id('tags')">Tags</Label>
        <CampoTags :id="id('tags')" v-model="dados.tags" />
      </div>
    </section>

    <!-- 2. Condições -->
    <section :class="CARTAO" :aria-labelledby="id('titulo-condicoes')">
      <h2 :id="id('titulo-condicoes')" :class="TITULO">Condições</h2>
      <AjudaRecolhivel
        curta="Opcional. Itens de condição só entram no Copiar quando a condição for marcada."
        completa="Opcional. Itens de uma condição só entram no Copiar quando ela é marcada na tela da prescrição; itens “Sempre” entram sempre."
      />
      <div v-for="(condicao, i) in dados.condicoes" :key="condicao.id" class="flex items-center gap-1">
        <Input
          :id="id(`condicao-${condicao.id}`)"
          v-model="condicao.nome"
          class="h-11 min-w-0 flex-1"
          :placeholder="`Nome da condição ${i + 1}`"
          :aria-label="`Nome da condição ${i + 1}`"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          :class="BOTAO_ICONE"
          :disabled="i === 0"
          :aria-label="`Mover condição ${i + 1} para cima`"
          @click="trocarOrdemCondicao(i, -1)"
        >
          <ArrowUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          :class="BOTAO_ICONE"
          :disabled="i === dados.condicoes.length - 1"
          :aria-label="`Mover condição ${i + 1} para baixo`"
          @click="trocarOrdemCondicao(i, 1)"
        >
          <ArrowDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          :class="BOTAO_ICONE"
          :aria-label="`Remover condição ${i + 1}`"
          @click="excluirCondicao(condicao.id)"
        >
          <Trash2 class="text-destructive" />
        </Button>
      </div>
      <Button type="button" variant="outline" size="touch" class="self-start rounded-full" @click="adicionarCondicao">
        <Plus /> Adicionar condição
      </Button>
    </section>

    <!-- 3. Itens -->
    <section :class="CARTAO" :aria-labelledby="id('titulo-itens')">
      <h2 :id="id('titulo-itens')" :class="TITULO">Itens *</h2>
      <AjudaRecolhivel
        curta="Para opções equivalentes, use “+ opção OU”."
        completa="Para opções equivalentes, use “+ opção OU”: na prescrição nenhuma vem escolhida e é preciso escolher uma antes de copiar."
      />

      <template v-for="(item, i) in dados.itens" :key="item.id">
        <h3
          v-if="tituloGrupo(i)"
          :class="cn(ROTULO_GRUPO, 'mt-1 -mb-1', grupoDe(i) ? 'text-primary' : 'text-muted-foreground')"
        >
          {{ grupoDe(i) ? `Condição: ${tituloGrupo(i)}` : tituloGrupo(i) }}
        </h3>

        <div :id="id(`item-${item.id}`)" class="border-border flex flex-col gap-3 rounded-2xl border p-3 md:p-4">
          <!-- Cabeçalho: número, ↑/↓ no grupo, remover -->
          <div class="flex items-center gap-1">
            <span
              :class="cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                grupoDe(i) ? 'bg-primary text-primary-foreground' : 'bg-secondary',
              )"
              aria-hidden="true"
            >
              {{ i + 1 }}
            </span>
            <span class="ml-1.5 flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <span class="font-semibold">Item {{ i + 1 }}</span>
              <span
                v-if="item.opcoes.length >= 2"
                class="bg-accent text-primary rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap"
              >
                OU · {{ item.opcoes.length }} opções
              </span>
              <span v-if="alertasDoItem(item.id)" class="text-muted-foreground text-xs whitespace-nowrap">
                {{ alertasDoItem(item.id) }} {{ alertasDoItem(item.id) === 1 ? 'alerta' : 'alertas' }}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-touch"
              :class="BOTAO_ICONE"
              :disabled="!podeMoverItemNoGrupo(dados, i, -1)"
              :aria-label="`Mover item ${i + 1} para cima`"
              @click="mover(i, -1)"
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-touch"
              :class="BOTAO_ICONE"
              :disabled="!podeMoverItemNoGrupo(dados, i, 1)"
              :aria-label="`Mover item ${i + 1} para baixo`"
              @click="mover(i, 1)"
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-touch"
              :class="BOTAO_ICONE"
              :aria-label="`Remover item ${i + 1}`"
              @click="remover(item.id)"
            >
              <Trash2 class="text-destructive" />
            </Button>
          </div>

          <div v-if="dados.condicoes.length" class="flex items-center gap-3">
            <Label :for="id(`item-${item.id}-condicao`)" class="shrink-0">Condição</Label>
            <CampoSelect
              :id="id(`item-${item.id}-condicao`)"
              :model-value="condicaoDoItem(item, dados.condicoes)"
              :opcoes="opcoesCondicao"
              class="min-w-0 flex-1"
              @update:model-value="(c) => trocarCondicao(item.id, c)"
            />
          </div>

          <!-- Opções: a primeira é o texto do item; com 2 ou mais, o item é "OU" -->
          <template v-for="(opcao, j) in item.opcoes" :key="opcao.id">
            <div v-if="j > 0" class="flex items-center gap-2" aria-hidden="true">
              <span class="bg-border h-px flex-1" />
              <span class="bg-foreground text-background rounded-full px-2.5 py-0.5 text-xs font-bold">OU</span>
              <span class="bg-border h-px flex-1" />
            </div>
            <div
              :class="cn('flex flex-col gap-2', item.opcoes.length >= 2 && 'bg-secondary/50 rounded-2xl p-2.5')"
            >
              <div v-if="item.opcoes.length >= 2" class="flex items-center gap-2">
                <span class="text-muted-foreground flex-1 pl-1 text-sm font-semibold">Opção {{ j + 1 }}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-touch"
                  :class="BOTAO_ICONE"
                  :aria-label="`Remover opção ${j + 1} do item ${i + 1}`"
                  @click="excluirOpcao(i, opcao.id)"
                >
                  <X />
                </Button>
              </div>
              <Textarea
                :id="id(`opcao-${opcao.id}`)"
                v-model="opcao.texto"
                class="min-h-16"
                :placeholder="item.opcoes.length >= 2 ? 'Texto da opção' : 'Texto do item'"
                :aria-label="item.opcoes.length >= 2 ? `Texto da opção ${j + 1} do item ${i + 1}` : `Texto do item ${i + 1}`"
              />
              <Input
                v-if="mostrarMotivo(item.opcoes, j)"
                v-model="opcao.motivo"
                class="h-11"
                placeholder="Motivo (opcional)"
                :aria-label="`Motivo da opção ${j + 1} do item ${i + 1}`"
              />
            </div>
          </template>

          <Button type="button" variant="ghost" size="touch" class="text-primary self-start rounded-full" @click="adicionarOpcao(i)">
            <Plus /> opção OU
          </Button>
        </div>
      </template>

      <p v-if="!dados.itens.length" class="text-muted-foreground text-sm">Nenhum item. Inclua pelo menos 1.</p>
      <Button type="button" variant="outline" size="touch" class="self-start rounded-full" @click="adicionarItem">
        <Plus /> Adicionar item
      </Button>
    </section>

    <!-- 4. Alertas -->
    <section :class="CARTAO" :aria-labelledby="id('titulo-alertas')">
      <h2 :id="id('titulo-alertas')" :class="TITULO">Alertas</h2>
      <p :class="DICA">Alertas da prescrição inteira aparecem no topo; os de um item, junto dele.</p>
      <div
        v-for="(alerta, i) in dados.alertas"
        :key="alerta.id"
        :class="cn('flex flex-col gap-3 rounded-2xl border p-3 md:p-4', ESTILO_GRAVIDADE[alerta.gravidade].caixa)"
      >
        <div class="flex items-center gap-2">
          <component
            :is="ESTILO_GRAVIDADE[alerta.gravidade].componente"
            :class="cn('size-5 shrink-0', ESTILO_GRAVIDADE[alerta.gravidade].icone)"
            aria-hidden="true"
          />
          <span class="flex-1 font-semibold">Alerta {{ i + 1 }}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            :class="BOTAO_ICONE"
            :aria-label="`Remover alerta ${i + 1}`"
            @click="removerAlerta(alerta.id)"
          >
            <Trash2 class="text-destructive" />
          </Button>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <Label :for="id(`alerta-${alerta.id}-tipo`)">Tipo</Label>
            <CampoSelect :id="id(`alerta-${alerta.id}-tipo`)" v-model="alerta.tipo" :opcoes="opcoesTipo" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label :for="id(`alerta-${alerta.id}-gravidade`)">Gravidade</Label>
            <CampoSelect :id="id(`alerta-${alerta.id}-gravidade`)" v-model="alerta.gravidade" :opcoes="opcoesGravidade" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label :for="id(`alerta-${alerta.id}-vinculo`)">Vale para</Label>
          <CampoSelect :id="id(`alerta-${alerta.id}-vinculo`)" v-model="alerta.itemId" :opcoes="opcoesVinculoDe(alerta)" />
        </div>
        <Textarea
          :id="id(`alerta-${alerta.id}`)"
          v-model="alerta.texto"
          placeholder="Texto do alerta"
          :aria-label="`Texto do alerta ${i + 1}`"
        />
      </div>
      <Button type="button" variant="outline" size="touch" class="self-start rounded-full" @click="adicionarAlerta">
        <Plus /> Adicionar alerta
      </Button>
    </section>

    <!-- 5. Calculadoras e escalas -->
    <section :class="CARTAO" :aria-labelledby="id('titulo-calculadoras')">
      <h2 :id="id('titulo-calculadoras')" :class="TITULO">Calculadoras e escalas</h2>
      <p :class="DICA">Opcional. Aparecem na aba “Calculadoras” da prescrição, na ordem desta lista.</p>
      <SeletorCalculadoras v-model="dados.calculadoraIds" :id-campo="id('busca-calculadoras')" />
    </section>

    <!-- 6. Observações -->
    <section :class="CARTAO">
      <div class="flex flex-col gap-1.5">
        <Label :for="id('observacoes')" :class="TITULO">Observações</Label>
        <p :id="id('dica-observacoes')" class="text-muted-foreground text-sm">
          Comece cada parágrafo com o rótulo, ex.: Obs:
        </p>
      </div>
      <Textarea
        :id="id('observacoes')"
        v-model="dados.observacoes"
        class="min-h-24"
        :aria-describedby="id('dica-observacoes')"
      />
    </section>

    <!-- 7. Receita de alta -->
    <section :class="CARTAO">
      <div class="flex flex-col gap-1.5">
        <Label :for="id('receita')" :class="TITULO">Receita de alta</Label>
        <p :id="id('dica-receita')" class="text-muted-foreground text-sm">
          Opcional. Copiada exatamente como está, com as quebras de linha.
        </p>
      </div>
      <Textarea
        :id="id('receita')"
        v-model="dados.receita"
        class="min-h-32 font-mono text-[13px] leading-relaxed md:text-[13px]"
        :aria-describedby="id('dica-receita')"
      />
    </section>

    <!-- 8. Referência -->
    <section :class="CARTAO">
      <Label :for="id('referencia')" :class="TITULO">Referência</Label>
      <Textarea :id="id('referencia')" v-model="dados.referencia" placeholder="Fonte, link, documento…" />
    </section>
  </div>
</template>
