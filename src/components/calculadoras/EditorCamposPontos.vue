<script setup lang="ts">
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
</script>

<template>
  <fieldset class="flex flex-col gap-3">
    <legend class="mb-2 text-lg font-semibold">Campos *</legend>
    <div
      v-for="(campo, i) in campos"
      :key="campo.id"
      class="bg-card border shadow-xs flex flex-col gap-3 rounded-2xl p-3"
    >
      <div class="flex items-center gap-1">
        <span class="flex-1 font-semibold">Campo {{ i + 1 }}</span>
        <Button type="button" variant="ghost" size="icon-touch" :disabled="i === 0" aria-label="Mover para cima" @click="mover(i, -1)">
          <ArrowUp />
        </Button>
        <Button type="button" variant="ghost" size="icon-touch" :disabled="i === campos.length - 1" aria-label="Mover para baixo" @click="mover(i, 1)">
          <ArrowDown />
        </Button>
        <Button type="button" variant="ghost" size="icon-touch" aria-label="Remover campo" @click="campos.splice(i, 1)">
          <Trash2 class="text-destructive" />
        </Button>
      </div>

      <Input v-model="campo.rotulo" class="h-11" placeholder="Texto do campo" :aria-label="`Texto do campo ${i + 1}`" />
      <CampoSelect
        :model-value="campo.tipo"
        :opcoes="TIPOS"
        :aria-label="`Tipo do campo ${i + 1}`"
        @update:model-value="(t) => trocarTipo(i, t)"
      />

      <!-- Sim / não -->
      <div v-if="campo.tipo === 'sim_nao'" class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-1">
          <Label :for="`c${i}-sim`">Pontos se "sim"</Label>
          <CampoNumeroObrigatorio :id="`c${i}-sim`" v-model="campo.pontosSim" />
        </div>
        <div class="flex flex-col gap-1">
          <Label :for="`c${i}-nao`">Pontos se "não"</Label>
          <CampoNumeroObrigatorio :id="`c${i}-nao`" v-model="campo.pontosNao" />
        </div>
      </div>

      <!-- Seleção -->
      <div v-else-if="campo.tipo === 'selecao'" class="flex flex-col gap-2">
        <div v-for="(opcao, j) in campo.opcoes" :key="opcao.id" class="grid grid-cols-[1fr_6rem_auto] items-center gap-2">
          <Input v-model="opcao.rotulo" class="h-11" placeholder="Texto da opção" :aria-label="`Opção ${j + 1} do campo ${i + 1}`" />
          <CampoNumeroObrigatorio v-model="opcao.pontos" sufixo="pts" :aria-label="`Pontos da opção ${j + 1}`" />
          <Button type="button" variant="ghost" size="icon-touch" aria-label="Remover opção" @click="campo.opcoes.splice(j, 1)">
            <X />
          </Button>
        </div>
        <Button type="button" variant="ghost" size="touch" class="self-start" @click="campo.opcoes.push(opcaoVazia())">
          <Plus /> Opção
        </Button>
      </div>

      <!-- Número com faixas -->
      <div v-else class="flex flex-col gap-2">
        <div class="grid grid-cols-3 gap-2">
          <div class="flex flex-col gap-1">
            <Label :for="`c${i}-un`">Unidade</Label>
            <Input :id="`c${i}-un`" v-model="campo.unidade" class="h-11" />
          </div>
          <div class="flex flex-col gap-1">
            <Label :for="`c${i}-min`">Mínimo</Label>
            <CampoNumero :id="`c${i}-min`" v-model="campo.min" />
          </div>
          <div class="flex flex-col gap-1">
            <Label :for="`c${i}-max`">Máximo</Label>
            <CampoNumero :id="`c${i}-max`" v-model="campo.max" />
          </div>
        </div>
        <p class="text-muted-foreground text-xs">Faixas de valor → pontos (de ≤ valor ≤ até; vazio = sem limite).</p>
        <div v-for="(faixa, j) in campo.faixas" :key="faixa.id" class="grid grid-cols-[1fr_1fr_5.5rem_auto] items-center gap-2">
          <CampoNumero v-model="faixa.de" placeholder="de" :aria-label="`Faixa ${j + 1}: de`" />
          <CampoNumero v-model="faixa.ate" placeholder="até" :aria-label="`Faixa ${j + 1}: até`" />
          <CampoNumeroObrigatorio v-model="faixa.pontos" sufixo="pts" :aria-label="`Faixa ${j + 1}: pontos`" />
          <Button type="button" variant="ghost" size="icon-touch" aria-label="Remover faixa" @click="campo.faixas.splice(j, 1)">
            <X />
          </Button>
        </div>
        <Button type="button" variant="ghost" size="touch" class="self-start" @click="campo.faixas.push(faixaPontosVazia())">
          <Plus /> Faixa
        </Button>
      </div>
    </div>
    <Button type="button" variant="outline" size="touch" @click="campos.push(campoVazio('sim_nao'))">
      <Plus /> Adicionar campo
    </Button>
  </fieldset>
</template>
