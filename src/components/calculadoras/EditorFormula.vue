<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown, ArrowUp, CircleCheck, OctagonAlert, Plus, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import CampoNumero from '@/components/comum/CampoNumero.vue'
import CampoNumeroObrigatorio from '@/components/comum/CampoNumeroObrigatorio.vue'
import { entradaVazia } from '@/dominio/calculadoras/editar'
import { analisarExpressao, FUNCOES_PERMITIDAS } from '@/dominio/calculadoras/formula'
import { moverItem } from '@/dominio/prescricoes/editar'
import type { EntradaFormula } from '@/dominio/tipos'

const entradas = defineModel<EntradaFormula[]>('entradas', { required: true })
const expressao = defineModel<string>('expressao', { required: true })
const unidadeResultado = defineModel<string>('unidadeResultado', { required: true })
const casasDecimais = defineModel<number>('casasDecimais', { required: true })
const teto = defineModel<number | null>('teto', { required: true })
const piso = defineModel<number | null>('piso', { required: true })

const analise = computed(() =>
  expressao.value.trim() ? analisarExpressao(expressao.value, entradas.value.map((e) => e.variavel)) : null,
)

function mover(i: number, direcao: -1 | 1) {
  entradas.value = moverItem(entradas.value, i, direcao)
}
</script>

<template>
  <fieldset class="flex flex-col gap-3">
    <legend class="mb-2 text-lg font-semibold">Entradas *</legend>
    <div
      v-for="(entrada, i) in entradas"
      :key="entrada.id"
      class="bg-card border shadow-xs flex flex-col gap-3 rounded-2xl p-3"
    >
      <div class="flex items-center gap-1">
        <span class="flex-1 font-semibold">Entrada {{ i + 1 }}</span>
        <Button type="button" variant="ghost" size="icon-touch" :disabled="i === 0" aria-label="Mover para cima" @click="mover(i, -1)">
          <ArrowUp />
        </Button>
        <Button type="button" variant="ghost" size="icon-touch" :disabled="i === entradas.length - 1" aria-label="Mover para baixo" @click="mover(i, 1)">
          <ArrowDown />
        </Button>
        <Button type="button" variant="ghost" size="icon-touch" aria-label="Remover entrada" @click="entradas.splice(i, 1)">
          <Trash2 class="text-destructive" />
        </Button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-1">
          <Label :for="`e${i}-var`">Variável (na expressão)</Label>
          <Input :id="`e${i}-var`" v-model="entrada.variavel" class="h-11 font-mono" autocapitalize="off" autocomplete="off" spellcheck="false" />
        </div>
        <div class="flex flex-col gap-1">
          <Label :for="`e${i}-un`">Unidade</Label>
          <Input :id="`e${i}-un`" v-model="entrada.unidade" class="h-11" />
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <Label :for="`e${i}-rot`">Rótulo (aparece na tela)</Label>
        <Input :id="`e${i}-rot`" v-model="entrada.rotulo" class="h-11" />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-1">
          <Label :for="`e${i}-min`">Mínimo *</Label>
          <CampoNumeroObrigatorio :id="`e${i}-min`" v-model="entrada.min" :sufixo="entrada.unidade" />
        </div>
        <div class="flex flex-col gap-1">
          <Label :for="`e${i}-max`">Máximo *</Label>
          <CampoNumeroObrigatorio :id="`e${i}-max`" v-model="entrada.max" :sufixo="entrada.unidade" />
        </div>
      </div>
    </div>
    <Button type="button" variant="outline" size="touch" @click="entradas.push(entradaVazia())">
      <Plus /> Adicionar entrada
    </Button>
  </fieldset>

  <fieldset class="flex flex-col gap-3">
    <legend class="mb-2 text-lg font-semibold">Fórmula *</legend>
    <Textarea
      v-model="expressao"
      class="min-h-20 font-mono"
      placeholder="ex.: a / (b * b)"
      aria-label="Expressão"
      autocapitalize="off"
      spellcheck="false"
    />
    <p v-if="analise && !analise.ok" class="text-destructive flex items-center gap-1.5 text-sm">
      <OctagonAlert class="size-4 shrink-0" /> {{ analise.erro }}
    </p>
    <p v-else-if="analise?.ok" class="text-primary flex items-center gap-1.5 text-sm">
      <CircleCheck class="size-4 shrink-0" /> Expressão válida
    </p>
    <p class="text-muted-foreground text-xs">
      Variáveis: {{ entradas.map((e) => e.variavel).filter(Boolean).join(', ') || '—' }}. Operações: + − * / ^ e
      parênteses. Funções: {{ FUNCOES_PERMITIDAS.join(', ') }}. Decimal com ponto (0.5).
    </p>
    <div class="grid grid-cols-2 gap-2">
      <div class="flex flex-col gap-1">
        <Label for="f-un">Unidade do resultado</Label>
        <Input id="f-un" v-model="unidadeResultado" class="h-11" />
      </div>
      <div class="flex flex-col gap-1">
        <Label for="f-casas">Casas decimais</Label>
        <CampoNumeroObrigatorio id="f-casas" v-model="casasDecimais" />
      </div>
      <div class="flex flex-col gap-1">
        <Label for="f-piso">Piso (opcional)</Label>
        <CampoNumero id="f-piso" v-model="piso" :sufixo="unidadeResultado" />
      </div>
      <div class="flex flex-col gap-1">
        <Label for="f-teto">Teto (opcional)</Label>
        <CampoNumero id="f-teto" v-model="teto" :sufixo="unidadeResultado" />
      </div>
    </div>
  </fieldset>
</template>
