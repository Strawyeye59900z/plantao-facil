<script setup lang="ts">
import { computed, ref } from 'vue'
import { Eraser } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import CampoNumero from '@/components/comum/CampoNumero.vue'
import { ESTILO_GRAVIDADE } from '@/components/prescricoes/gravidade'
import { interpretar } from '@/dominio/calculadoras/interpretacao'
import { calcularPontos, type Respostas } from '@/dominio/calculadoras/pontos'
import { formatarNumero } from '@/dominio/dose/numeros'
import type { CalculadoraPontos, UUID } from '@/dominio/tipos'
import { ROTULO_GRAVIDADE } from '@/dominio/tipos'
import { cn } from '@/lib/utils'

/**
 * Uso de uma escala por pontos: resultado e interpretação em tempo real.
 * As respostas vivem só na memória deste componente (nenhum dado de paciente é salvo).
 */
const props = defineProps<{ calculadora: Pick<CalculadoraPontos, 'campos' | 'faixas'> }>()

const respostas = ref<Respostas>({})
const valores = ref<Record<UUID, number | null>>({})

function limpar() {
  respostas.value = {}
  valores.value = {}
}

function responder(campoId: UUID, valor: Respostas[string]) {
  respostas.value = { ...respostas.value, [campoId]: respostas.value[campoId] === valor ? null : valor }
}

function numero(id: UUID): number | null {
  return valores.value[id] ?? null
}

function definirNumero(id: UUID, v: number | null) {
  valores.value = { ...valores.value, [id]: v }
}

const pontos = computed(() => calcularPontos(props.calculadora as CalculadoraPontos, { ...respostas.value, ...valores.value }))
const total = computed(() => (pontos.value.respondidos > 0 ? pontos.value.total : null))
const faixa = computed(() => (total.value === null ? undefined : interpretar(total.value, props.calculadora.faixas)))
const parcial = computed(() => !pontos.value.completo)

const textoResultado = computed(() => {
  if (total.value === null) return null
  return `${formatarNumero(total.value)} ${total.value === 1 || total.value === -1 ? 'ponto' : 'pontos'}`
})

const sinal = (x: number) => (x > 0 ? `+${formatarNumero(x)}` : formatarNumero(x))
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Texto do campo e botões na mesma linha; 2 colunas no PC/tablet, 1 no celular -->
    <div class="grid gap-2 md:grid-cols-2">
      <div v-for="campo in calculadora.campos" :key="campo.id" class="bg-card flex flex-col gap-1 rounded-2xl px-4 py-3 shadow-xs">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p class="min-w-[40%] flex-1 text-sm font-semibold">{{ campo.rotulo || 'Campo sem texto' }}</p>

          <div v-if="campo.tipo === 'sim_nao'" class="flex shrink-0 gap-1.5" role="group" :aria-label="campo.rotulo">
            <button
              v-for="opcao in [
                { valor: true, rotulo: 'Sim', pontos: campo.pontosSim },
                { valor: false, rotulo: 'Não', pontos: campo.pontosNao },
              ]"
              :key="String(opcao.valor)"
              type="button"
              :aria-pressed="respostas[campo.id] === opcao.valor"
              :class="cn(
                'flex h-11 min-w-16 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-semibold',
                respostas[campo.id] === opcao.valor ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent/70',
              )"
              @click="responder(campo.id, opcao.valor)"
            >
              {{ opcao.rotulo }} <span class="text-xs font-normal opacity-75">{{ sinal(opcao.pontos) }}</span>
            </button>
          </div>

          <div v-else-if="campo.tipo === 'selecao'" class="flex flex-wrap justify-end gap-1.5" role="radiogroup" :aria-label="campo.rotulo">
            <button
              v-for="opcao in campo.opcoes"
              :key="opcao.id"
              type="button"
              role="radio"
              :aria-checked="respostas[campo.id] === opcao.id"
              :class="cn(
                'flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-left text-sm font-medium',
                respostas[campo.id] === opcao.id ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent/70',
              )"
              @click="responder(campo.id, opcao.id)"
            >
              {{ opcao.rotulo || 'Opção sem texto' }} <span class="text-xs font-normal opacity-75">{{ sinal(opcao.pontos) }}</span>
            </button>
          </div>

          <CampoNumero
            v-else
            :model-value="numero(campo.id)"
            :sufixo="campo.unidade"
            class="w-32 shrink-0"
            :aria-label="campo.rotulo"
            @update:model-value="definirNumero(campo.id, $event)"
          />
        </div>
        <p v-if="campo.tipo === 'numero' && pontos.pontosPorCampo[campo.id] !== undefined" class="text-muted-foreground text-right text-xs">
          {{ sinal(pontos.pontosPorCampo[campo.id]!) }} {{ Math.abs(pontos.pontosPorCampo[campo.id]!) === 1 ? 'ponto' : 'pontos' }}
        </p>
        <p v-if="pontos.erros[campo.id]" class="text-destructive text-right text-xs">{{ pontos.erros[campo.id] }}</p>
      </div>
    </div>

    <!-- Resultado -->
    <div class="bg-card/95 sticky bottom-4 z-10 flex flex-col gap-2 rounded-3xl p-4 shadow-lg backdrop-blur" aria-live="polite">
      <div class="flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <p class="text-muted-foreground text-xs font-semibold">
            Resultado<span v-if="parcial"> · parcial ({{ pontos.respondidos }} de {{ pontos.totalCampos }})</span>
          </p>
          <p v-if="textoResultado" class="text-3xl font-extrabold">{{ textoResultado }}</p>
          <p v-else class="text-muted-foreground text-sm">Responda os campos.</p>
        </div>
        <Button variant="outline" size="touch" class="rounded-full" @click="limpar"><Eraser /> Limpar</Button>
      </div>

      <div v-if="faixa" :class="cn('flex gap-2 rounded-2xl border p-3', ESTILO_GRAVIDADE[faixa.gravidade].caixa)">
        <component :is="ESTILO_GRAVIDADE[faixa.gravidade].componente" :class="cn('mt-0.5 size-5 shrink-0', ESTILO_GRAVIDADE[faixa.gravidade].icone)" />
        <div>
          <p class="text-xs font-semibold">
            {{ ROTULO_GRAVIDADE[faixa.gravidade] }}<span v-if="parcial" class="font-normal"> · resultado parcial</span>
          </p>
          <p class="whitespace-pre-line">{{ faixa.texto }}</p>
        </div>
      </div>
      <p v-else-if="total !== null && calculadora.faixas.length" class="text-muted-foreground text-sm">
        Sem interpretação cadastrada para este valor.
      </p>
    </div>
  </div>
</template>
