<script setup lang="ts">
import { computed, nextTick } from 'vue'
import { ArrowDown, ArrowUp, CircleCheck, OctagonAlert, Plus, Trash2, TriangleAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import CampoNumero from '@/components/comum/CampoNumero.vue'
import CampoNumeroObrigatorio from '@/components/comum/CampoNumeroObrigatorio.vue'
import CampoSelect from '@/components/comum/CampoSelect.vue'
import { campoFormulaVazio, saidaVazia } from '@/dominio/calculadoras/editar'
import { analisarExpressao, FUNCOES_PERMITIDAS } from '@/dominio/calculadoras/formula'
import { moverItem } from '@/dominio/prescricoes/editar'
import type { CampoFormula, SaidaFormula } from '@/dominio/tipos'
import EditorFaixasInterpretacao from './EditorFaixasInterpretacao.vue'
import UsoFormula from './UsoFormula.vue'

/** Editor de fórmula: campos (número ou sim/não), saídas (cada uma com faixas) e painel "Testar". */
const campos = defineModel<CampoFormula[]>('campos', { required: true })
const saidas = defineModel<SaidaFormula[]>('saidas', { required: true })

const TIPOS = [
  { valor: 'numero' as const, rotulo: 'Número' },
  { valor: 'sim_nao' as const, rotulo: 'Sim / não' },
]

async function focar(idCampo: string) {
  await nextTick()
  const campo = document.getElementById(idCampo)
  campo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  campo?.focus({ preventScroll: true })
}

// ===== Campos =====
const variaveis = computed(() => campos.value.map((c) => c.variavel))

function adicionarCampo() {
  const novo = campoFormulaVazio('numero')
  campos.value.push(novo)
  focar(`campo-${novo.id}-rotulo`)
}

/** Trocar o tipo recria o campo (mantém texto e variável). */
function trocarTipo(i: number, tipo: CampoFormula['tipo']) {
  const atual = campos.value[i]!
  if (atual.tipo === tipo) return
  campos.value[i] = { ...campoFormulaVazio(tipo), id: atual.id, rotulo: atual.rotulo, variavel: atual.variavel }
}

function moverCampo(i: number, direcao: -1 | 1) {
  campos.value = moverItem(campos.value, i, direcao)
}

// ===== Saídas =====
const analises = computed(() =>
  saidas.value.map((s) => (s.expressao.trim() ? analisarExpressao(s.expressao, variaveis.value) : null)),
)

function erroExpressao(i: number): string | null {
  const a = analises.value[i]
  return a && !a.ok ? a.erro : null
}

/** Variáveis declaradas que nenhuma expressão válida usa. */
const naoUsadas = computed(() => {
  const usadas = new Set<string>()
  for (const a of analises.value) if (a?.ok) a.usadas.forEach((u) => usadas.add(u))
  return variaveis.value.filter((v) => v && !usadas.has(v))
})

function adicionarSaida() {
  const nova = saidaVazia()
  saidas.value.push(nova)
  focar(`saida-${nova.id}-nome`)
}

function moverSaida(i: number, direcao: -1 | 1) {
  saidas.value = moverItem(saidas.value, i, direcao)
}

const CARTAO = 'bg-card flex flex-col gap-4 rounded-lg p-4 shadow-xs md:p-5'
const TITULO = 'text-lg font-extrabold tracking-tight'
const DICA = 'text-muted-foreground -mt-2 text-sm'
const BOTAO_ICONE = 'rounded-full'
</script>

<template>
  <!-- Campos -->
  <section :class="CARTAO" aria-labelledby="titulo-campos">
    <h2 id="titulo-campos" :class="TITULO">Campos *</h2>
    <p :class="DICA">O que é preenchido na tela. A variável é o nome usado nas expressões.</p>

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
          @click="moverCampo(i, -1)"
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
          @click="moverCampo(i, 1)"
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

      <div class="grid gap-2 sm:grid-cols-2">
        <div class="flex flex-col gap-1">
          <Label :for="`campo-${campo.id}-tipo`">Tipo</Label>
          <CampoSelect
            :id="`campo-${campo.id}-tipo`"
            :model-value="campo.tipo"
            :opcoes="TIPOS"
            @update:model-value="(t) => trocarTipo(i, t)"
          />
        </div>
        <div class="flex flex-col gap-1">
          <Label :for="`campo-${campo.id}-variavel`">Variável *</Label>
          <Input
            :id="`campo-${campo.id}-variavel`"
            v-model="campo.variavel"
            class="h-11 font-mono"
            placeholder="ex.: peso"
            autocapitalize="off"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <Label :for="`campo-${campo.id}-rotulo`">Texto na tela *</Label>
        <Input :id="`campo-${campo.id}-rotulo`" v-model="campo.rotulo" class="h-11" autocomplete="off" />
      </div>

      <div v-if="campo.tipo === 'numero'" class="grid grid-cols-3 gap-2">
        <div class="flex flex-col gap-1">
          <Label :for="`campo-${campo.id}-unidade`">Unidade</Label>
          <Input :id="`campo-${campo.id}-unidade`" v-model="campo.unidade" class="h-11" autocomplete="off" />
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
      <div v-else class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-1">
          <Label :for="`campo-${campo.id}-sim`">Valor do Sim *</Label>
          <CampoNumeroObrigatorio :id="`campo-${campo.id}-sim`" v-model="campo.valorSim" />
        </div>
        <div class="flex flex-col gap-1">
          <Label :for="`campo-${campo.id}-nao`">Valor do Não *</Label>
          <CampoNumeroObrigatorio :id="`campo-${campo.id}-nao`" v-model="campo.valorNao" />
        </div>
      </div>
    </div>

    <p v-if="naoUsadas.length" class="flex items-start gap-1.5 text-sm">
      <TriangleAlert class="text-atencao mt-0.5 size-4 shrink-0" aria-hidden="true" />
      Não usada em nenhuma saída: {{ naoUsadas.join(', ') }}.
    </p>
    <p v-if="!campos.length" class="text-muted-foreground text-sm">Nenhum campo. Inclua pelo menos 1.</p>
    <Button type="button" variant="outline" size="touch" class="self-start rounded-full" @click="adicionarCampo">
      <Plus /> Adicionar campo
    </Button>
  </section>

  <!-- Saídas -->
  <section :class="CARTAO" aria-labelledby="titulo-saidas">
    <h2 id="titulo-saidas" :class="TITULO">Saídas *</h2>
    <p :class="DICA">
      Cada saída é um resultado na tela. Variáveis: {{ variaveis.filter(Boolean).join(', ') || '—' }}. Operações: + − * / ^ e
      parênteses. Funções: {{ FUNCOES_PERMITIDAS.join(', ') }}. Decimal com ponto (0.5).
    </p>

    <div v-for="(saida, i) in saidas" :key="saida.id" class="border-border flex flex-col gap-3 rounded-2xl border p-3 md:p-4">
      <div class="flex items-center gap-1">
        <span class="bg-secondary flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums" aria-hidden="true">
          {{ i + 1 }}
        </span>
        <span class="ml-1.5 flex-1 font-semibold">Saída {{ i + 1 }}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          :class="BOTAO_ICONE"
          :disabled="i === 0"
          :aria-label="`Mover saída ${i + 1} para cima`"
          @click="moverSaida(i, -1)"
        >
          <ArrowUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          :class="BOTAO_ICONE"
          :disabled="i === saidas.length - 1"
          :aria-label="`Mover saída ${i + 1} para baixo`"
          @click="moverSaida(i, 1)"
        >
          <ArrowDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          :class="BOTAO_ICONE"
          :aria-label="`Remover saída ${i + 1}`"
          @click="saidas.splice(i, 1)"
        >
          <Trash2 class="text-destructive" />
        </Button>
      </div>

      <div class="flex flex-col gap-1">
        <Label :for="`saida-${saida.id}-nome`">Nome *</Label>
        <Input :id="`saida-${saida.id}-nome`" v-model="saida.nome" class="h-11" autocomplete="off" />
      </div>
      <div class="flex flex-col gap-1">
        <Label :for="`saida-${saida.id}-expressao`">Expressão *</Label>
        <Textarea
          :id="`saida-${saida.id}-expressao`"
          v-model="saida.expressao"
          class="min-h-16 font-mono"
          placeholder="ex.: a / (b * b)"
          autocapitalize="off"
          spellcheck="false"
          :aria-describedby="`saida-${saida.id}-analise`"
        />
        <p :id="`saida-${saida.id}-analise`" aria-live="polite" class="text-sm">
          <span v-if="erroExpressao(i)" class="text-destructive flex items-start gap-1.5">
            <OctagonAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {{ erroExpressao(i) }}
          </span>
          <span v-else-if="analises[i]?.ok" class="text-primary flex items-center gap-1.5">
            <CircleCheck class="size-4 shrink-0" aria-hidden="true" /> Expressão válida
          </span>
        </p>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-1">
          <Label :for="`saida-${saida.id}-unidade`">Unidade</Label>
          <Input :id="`saida-${saida.id}-unidade`" v-model="saida.unidade" class="h-11" autocomplete="off" />
        </div>
        <div class="flex flex-col gap-1">
          <Label :for="`saida-${saida.id}-casas`">Casas decimais</Label>
          <CampoNumeroObrigatorio :id="`saida-${saida.id}-casas`" v-model="saida.casasDecimais" />
        </div>
        <div class="flex flex-col gap-1">
          <Label :for="`saida-${saida.id}-piso`">Piso</Label>
        </div>
        <div class="flex flex-col gap-1">
          <Label :for="`saida-${saida.id}-teto`">Teto</Label>
        </div>
      </div>

      <div class="flex flex-col gap-2 border-t pt-3">
        <h3 class="font-semibold">Interpretação</h3>
        <EditorFaixasInterpretacao
          v-model="saida.faixas"
          :prefixo="`saida-${saida.id}-`"
          :rotulo="`Saída ${i + 1}`"
          :casas-decimais="saida.casasDecimais"
        />
      </div>
    </div>

    <p v-if="!saidas.length" class="text-muted-foreground text-sm">Nenhuma saída. Inclua pelo menos 1.</p>
    <Button type="button" variant="outline" size="touch" class="self-start rounded-full" @click="adicionarSaida">
      <Plus /> Adicionar saída
    </Button>
  </section>

  <!-- Testar -->
  <section :class="CARTAO" aria-labelledby="titulo-testar">
    <h2 id="titulo-testar" :class="TITULO">Testar</h2>
    <p :class="DICA">Preencha valores de teste para conferir os resultados. Nada daqui é salvo.</p>
    <div class="bg-background rounded-2xl p-3 md:p-4">
      <UsoFormula :calculadora="{ campos, saidas }" />
    </div>
  </section>
</template>
