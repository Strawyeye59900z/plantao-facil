<script setup lang="ts">
import { nextTick } from 'vue'
import { ArrowDown, ArrowUp, Plus, Trash2, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import CampoNumero from '@/components/comum/CampoNumero.vue'
import CampoNumeroObrigatorio from '@/components/comum/CampoNumeroObrigatorio.vue'
import CampoSelect from '@/components/comum/CampoSelect.vue'
import { campoVazio, faixaPontosVazia, opcaoVazia } from '@/dominio/calculadoras/editar'
import { moverItem } from '@/dominio/prescricoes/editar'
import type { CampoPontos } from '@/dominio/tipos'

const campos = defineModel<CampoPontos[]>({ required: true })

const TIPOS = [
  { valor: 'sim_nao' as const, rotulo: 'Sim / não' },
  { valor: 'selecao' as const, rotulo: 'Seleção (opções)' },
  { valor: 'numero' as const, rotulo: 'Número (faixas)' },
]

/** Trocar o tipo recria o campo (mantém o texto). */
function trocarTipo(i: number, tipo: CampoPontos['tipo']) {
  const atual = campos.value[i]!
  if (atual.tipo === tipo) return
  campos.value[i] = { ...campoVazio(tipo), id: atual.id, rotulo: atual.rotulo }
}

function mover(i: number, direcao: -1 | 1) {
  campos.value = moverItem(campos.value, i, direcao)
}

async function focar(idCampo: string) {
  await nextTick()
  const campo = document.getElementById(idCampo)
  campo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  campo?.focus({ preventScroll: true })
}

function adicionarCampo() {
  const novo = campoVazio('sim_nao')
  campos.value.push(novo)
  focar(`campo-${novo.id}-rotulo`)
}

function adicionarOpcao(campo: Extract<CampoPontos, { tipo: 'selecao' }>) {
  const nova = opcaoVazia()
  campo.opcoes.push(nova)
  focar(`opcao-${nova.id}`)
}

function adicionarFaixa(campo: Extract<CampoPontos, { tipo: 'numero' }>) {
  const nova = faixaPontosVazia()
  campo.faixas.push(nova)
  focar(`faixa-pontos-${nova.id}`)
}

const BOTAO_ICONE = 'rounded-full'
</script>

<template>
  <section class="bg-card flex flex-col gap-4 rounded-lg p-4 shadow-xs md:p-5" aria-labelledby="titulo-campos">
    <h2 id="titulo-campos" class="text-lg font-extrabold tracking-tight">Campos *</h2>
    <p class="text-muted-foreground -mt-2 text-sm">O resultado é a soma dos pontos de todos os campos.</p>
    <div v-for="(campo, i) in campos" :key="campo.id" class="border-border flex flex-col gap-3 rounded-2xl border p-3 md:p-4">
      <div class="flex items-center gap-1">
        <span class="bg-secondary flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums" aria-hidden="true">
          {{ i + 1 }}
        </span>
        <span class="ml-1.5 flex-1 font-semibold">Campo {{ i + 1 }}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          :class="BOTAO_ICONE"
          :disabled="i === 0"
          :aria-label="`Mover campo ${i + 1} para cima`"
          @click="mover(i, -1)"
        >
          <ArrowUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          :class="BOTAO_ICONE"
          :disabled="i === campos.length - 1"
          :aria-label="`Mover campo ${i + 1} para baixo`"
          @click="mover(i, 1)"
        >
          <ArrowDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          :class="BOTAO_ICONE"
          :aria-label="`Remover campo ${i + 1}`"
          @click="campos.splice(i, 1)"
        >
          <Trash2 class="text-destructive" />
        </Button>
      </div>

      <Input
        :id="`campo-${campo.id}-rotulo`"
        v-model="campo.rotulo"
        class="h-11"
        placeholder="Texto do campo"
        :aria-label="`Texto do campo ${i + 1}`"
      />
      <CampoSelect
        :model-value="campo.tipo"
        :opcoes="TIPOS"
        :aria-label="`Tipo do campo ${i + 1}`"
        @update:model-value="(t) => trocarTipo(i, t)"
      />

      <!-- Sim / não -->
      <div v-if="campo.tipo === 'sim_nao'" class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-1">
          <Label :for="`campo-${campo.id}-sim`">Pontos se "sim"</Label>
          <CampoNumeroObrigatorio :id="`campo-${campo.id}-sim`" v-model="campo.pontosSim" />
        </div>
        <div class="flex flex-col gap-1">
          <Label :for="`campo-${campo.id}-nao`">Pontos se "não"</Label>
          <CampoNumeroObrigatorio :id="`campo-${campo.id}-nao`" v-model="campo.pontosNao" />
        </div>
      </div>

      <!-- Seleção -->
      <div v-else-if="campo.tipo === 'selecao'" class="flex flex-col gap-2">
        <div v-for="(opcao, j) in campo.opcoes" :key="opcao.id" class="grid grid-cols-[1fr_6rem_auto] items-center gap-2">
          <Input
            :id="`opcao-${opcao.id}`"
            v-model="opcao.rotulo"
            class="h-11"
            placeholder="Texto da opção"
            :aria-label="`Texto da opção ${j + 1} do campo ${i + 1}`"
          />
          <CampoNumeroObrigatorio v-model="opcao.pontos" sufixo="pts" :aria-label="`Pontos da opção ${j + 1} do campo ${i + 1}`" />
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            :class="BOTAO_ICONE"
            :aria-label="`Remover opção ${j + 1} do campo ${i + 1}`"
            @click="campo.opcoes.splice(j, 1)"
          >
            <X />
          </Button>
        </div>
        <Button type="button" variant="ghost" size="touch" class="text-primary self-start rounded-full" @click="adicionarOpcao(campo)">
          <Plus /> Opção
        </Button>
      </div>

      <!-- Número com faixas -->
      <div v-else class="flex flex-col gap-2">
        <div class="grid grid-cols-3 gap-2">
          <div class="flex flex-col gap-1">
            <Label :for="`campo-${campo.id}-unidade`">Unidade</Label>
            <Input :id="`campo-${campo.id}-unidade`" v-model="campo.unidade" class="h-11" />
          </div>
          <div class="flex flex-col gap-1">
            <Label :for="`campo-${campo.id}-min`">Mínimo</Label>
            <CampoNumero :id="`campo-${campo.id}-min`" v-model="campo.min" />
          </div>
          <div class="flex flex-col gap-1">
            <Label :for="`campo-${campo.id}-max`">Máximo</Label>
            <CampoNumero :id="`campo-${campo.id}-max`" v-model="campo.max" />
          </div>
        </div>
        <p class="text-muted-foreground text-sm">Faixas de valor → pontos (de ≤ valor ≤ até; vazio = sem limite).</p>
        <div v-for="(faixa, j) in campo.faixas" :key="faixa.id" class="grid grid-cols-[1fr_1fr_5.5rem_auto] items-center gap-2">
          <CampoNumero
            :id="`faixa-pontos-${faixa.id}`"
            v-model="faixa.de"
            placeholder="de"
            :aria-label="`Campo ${i + 1}, faixa ${j + 1}: de`"
          />
          <CampoNumero v-model="faixa.ate" placeholder="até" :aria-label="`Campo ${i + 1}, faixa ${j + 1}: até`" />
          <CampoNumeroObrigatorio v-model="faixa.pontos" sufixo="pts" :aria-label="`Campo ${i + 1}, faixa ${j + 1}: pontos`" />
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            :class="BOTAO_ICONE"
            :aria-label="`Remover faixa ${j + 1} do campo ${i + 1}`"
            @click="campo.faixas.splice(j, 1)"
          >
            <X />
          </Button>
        </div>
        <Button type="button" variant="ghost" size="touch" class="text-primary self-start rounded-full" @click="adicionarFaixa(campo)">
          <Plus /> Faixa
        </Button>
      </div>
    </div>
    <p v-if="!campos.length" class="text-muted-foreground text-sm">Nenhum campo. Inclua pelo menos 1.</p>
    <Button type="button" variant="outline" size="touch" class="self-start rounded-full" @click="adicionarCampo">
      <Plus /> Adicionar campo
    </Button>
  </section>
</template>
