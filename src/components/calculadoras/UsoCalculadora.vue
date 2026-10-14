<script setup lang="ts">
import { computed, ref } from 'vue'
import { Eraser, TriangleAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import CampoNumero from '@/components/comum/CampoNumero.vue'
import { ESTILO_GRAVIDADE } from '@/components/prescricoes/gravidade'
import { calcularFormula } from '@/dominio/calculadoras/formula'
import { interpretar } from '@/dominio/calculadoras/interpretacao'
import { calcularPontos, type Respostas } from '@/dominio/calculadoras/pontos'
import { formatarNumero } from '@/dominio/dose/numeros'
import type { CalculadoraFormula, CalculadoraPontos, UUID } from '@/dominio/tipos'
import { ROTULO_GRAVIDADE } from '@/dominio/tipos'
import { cn } from '@/lib/utils'

/**
 * Tela de uso: entradas grandes, resultado e interpretação em tempo real.
 * As respostas vivem só na memória deste componente (nenhum dado de paciente é salvo).
 */
const props = defineProps<{
  calculadora: Pick<CalculadoraPontos, 'tipo' | 'campos' | 'faixas'> | Pick<CalculadoraFormula, 'tipo' | 'entradas' | 'expressao' | 'casasDecimais' | 'teto' | 'piso' | 'unidadeResultado' | 'faixas'>
}>()

const respostas = ref<Respostas>({})
const valores = ref<Record<UUID, number | null>>({})

function limpar() {
  respostas.value = {}
  valores.value = {}
}

function responder(campoId: UUID, valor: Respostas[string]) {
  respostas.value = { ...respostas.value, [campoId]: respostas.value[campoId] === valor ? null : valor }
}

function valorNumerico(id: UUID) {
  return computed<number | null>({
    get: () => (valores.value[id] ?? null) as number | null,
    set: (v) => (valores.value = { ...valores.value, [id]: v }),
  })
}
const camposNumericos = new Map<UUID, ReturnType<typeof valorNumerico>>()
function modeloNumero(id: UUID) {
  if (!camposNumericos.has(id)) camposNumericos.set(id, valorNumerico(id))
  return camposNumericos.get(id)!
}

const pontos = computed(() =>
  props.calculadora.tipo === 'pontos'
    ? calcularPontos(props.calculadora as CalculadoraPontos, { ...respostas.value, ...valores.value })
    : null,
)
const formula = computed(() =>
  props.calculadora.tipo === 'formula' ? calcularFormula(props.calculadora as CalculadoraFormula, valores.value) : null,
)

/** Valor que vai para a interpretação (null = ainda não há resultado). */
const valorFinal = computed(() => {
  if (pontos.value) return pontos.value.respondidos > 0 ? pontos.value.total : null
  return formula.value?.estado === 'ok' ? formula.value.valor : null
})
const faixa = computed(() => (valorFinal.value === null ? undefined : interpretar(valorFinal.value, props.calculadora.faixas)))
const parcial = computed(() => !!pontos.value && !pontos.value.completo)

const textoResultado = computed(() => {
  if (valorFinal.value === null) return null
  const n = formatarNumero(valorFinal.value)
  if (pontos.value) return `${n} ${valorFinal.value === 1 || valorFinal.value === -1 ? 'ponto' : 'pontos'}`
  const unidade = (props.calculadora as CalculadoraFormula).unidadeResultado
  return unidade ? `${n} ${unidade}` : n
})

const sinal = (x: number) => (x > 0 ? `+${formatarNumero(x)}` : formatarNumero(x))
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Escore por pontos -->
    <template v-if="calculadora.tipo === 'pontos'">
      <div
        v-for="campo in (calculadora as CalculadoraPontos).campos"
        :key="campo.id"
        class="bg-card ring-foreground/10 flex flex-col gap-2 rounded-xl p-3 ring-1"
      >
        <p class="font-medium">{{ campo.rotulo || 'Campo sem texto' }}</p>

        <div v-if="campo.tipo === 'sim_nao'" class="grid grid-cols-2 gap-2" role="group" :aria-label="campo.rotulo">
          <button
            v-for="opcao in [
              { valor: true, rotulo: 'Sim', pontos: campo.pontosSim },
              { valor: false, rotulo: 'Não', pontos: campo.pontosNao },
            ]"
            :key="String(opcao.valor)"
            type="button"
            :aria-pressed="respostas[campo.id] === opcao.valor"
            :class="cn(
              'flex h-12 items-center justify-center gap-2 rounded-lg border text-base font-medium',
              respostas[campo.id] === opcao.valor ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted',
            )"
            @click="responder(campo.id, opcao.valor)"
          >
            {{ opcao.rotulo }} <span class="text-sm opacity-75">{{ sinal(opcao.pontos) }}</span>
          </button>
        </div>

        <div v-else-if="campo.tipo === 'selecao'" class="flex flex-col gap-1.5" role="radiogroup" :aria-label="campo.rotulo">
          <button
            v-for="opcao in campo.opcoes"
            :key="opcao.id"
            type="button"
            role="radio"
            :aria-checked="respostas[campo.id] === opcao.id"
            :class="cn(
              'flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3 text-left text-base',
              respostas[campo.id] === opcao.id ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted',
            )"
            @click="responder(campo.id, opcao.id)"
          >
            <span>{{ opcao.rotulo || 'Opção sem texto' }}</span>
            <span class="text-sm opacity-75">{{ sinal(opcao.pontos) }}</span>
          </button>
        </div>

        <template v-else>
          <CampoNumero
            v-model="modeloNumero(campo.id).value"
            :sufixo="campo.unidade"
            class="max-w-48"
            :aria-label="campo.rotulo"
          />
          <p v-if="pontos?.pontosPorCampo[campo.id] !== undefined" class="text-muted-foreground text-sm">
            {{ sinal(pontos!.pontosPorCampo[campo.id]!) }} {{ Math.abs(pontos!.pontosPorCampo[campo.id]!) === 1 ? 'ponto' : 'pontos' }}
          </p>
        </template>
        <p v-if="pontos?.erros[campo.id]" class="text-destructive text-sm">{{ pontos.erros[campo.id] }}</p>
      </div>
    </template>

    <!-- Fórmula -->
    <template v-else>
      <div
        v-for="entrada in (calculadora as CalculadoraFormula).entradas"
        :key="entrada.id"
        class="bg-card ring-foreground/10 flex flex-col gap-1.5 rounded-xl p-3 ring-1"
      >
        <label :for="`entrada-${entrada.id}`" class="font-medium">{{ entrada.rotulo || entrada.variavel }}</label>
        <CampoNumero
          :id="`entrada-${entrada.id}`"
          v-model="modeloNumero(entrada.id).value"
          :sufixo="entrada.unidade"
          class="max-w-48"
        />
        <p class="text-muted-foreground text-xs">
          de {{ formatarNumero(entrada.min) }} a {{ formatarNumero(entrada.max) }} {{ entrada.unidade }}
        </p>
      </div>
    </template>

    <!-- Resultado -->
    <div
      class="bg-background/95 ring-foreground/10 sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex flex-col gap-2 rounded-xl p-3 ring-1 backdrop-blur md:bottom-4"
      aria-live="polite"
    >
      <div class="flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Resultado<span v-if="parcial && pontos"> · parcial ({{ pontos.respondidos }} de {{ pontos.totalCampos }})</span>
          </p>
          <p v-if="textoResultado" class="text-3xl font-bold">{{ textoResultado }}</p>
          <p v-else-if="formula?.estado === 'incompleto'" class="text-muted-foreground text-sm">
            Preencha: {{ formula.faltam.join(', ') }}
          </p>
          <p v-else-if="formula?.estado === 'erro'" class="text-destructive text-sm">{{ formula.erro }}</p>
          <p v-else class="text-muted-foreground text-sm">Responda os campos.</p>
        </div>
        <Button variant="outline" size="touch" @click="limpar"><Eraser /> Limpar</Button>
      </div>

      <p
        v-if="formula?.estado === 'ok' && formula.aviso"
        class="border-atencao bg-atencao/12 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold"
      >
        <TriangleAlert class="text-atencao size-4" />
        {{ formula.aviso === 'teto' ? 'Valor máximo (teto) aplicado' : 'Valor mínimo (piso) aplicado' }}
        — calculado: {{ formatarNumero(formula.bruto) }}
      </p>

      <div
        v-if="faixa"
        :class="cn('flex gap-2 rounded-lg border-l-4 p-2.5', ESTILO_GRAVIDADE[faixa.gravidade].caixa)"
      >
        <component :is="ESTILO_GRAVIDADE[faixa.gravidade].componente" :class="cn('mt-0.5 size-5 shrink-0', ESTILO_GRAVIDADE[faixa.gravidade].icone)" />
        <div>
          <p class="text-xs font-semibold tracking-wide uppercase">
            {{ ROTULO_GRAVIDADE[faixa.gravidade] }}<span v-if="parcial" class="font-normal normal-case"> · resultado parcial</span>
          </p>
          <p class="whitespace-pre-line">{{ faixa.texto }}</p>
        </div>
      </div>
      <p v-else-if="valorFinal !== null && calculadora.faixas.length" class="text-muted-foreground text-sm">
        Sem interpretação cadastrada para este valor.
      </p>
    </div>
  </div>
</template>
