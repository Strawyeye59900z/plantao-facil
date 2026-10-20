<script setup lang="ts">
import { computed, ref } from 'vue'
import { Eraser, TriangleAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import CampoNumero from '@/components/comum/CampoNumero.vue'
import { ESTILO_GRAVIDADE } from '@/components/prescricoes/gravidade'
import { calcularSaidas, type ValoresFormula } from '@/dominio/calculadoras/formula'
import { formatarNumero } from '@/dominio/dose/numeros'
import type { CalculadoraFormula, UUID } from '@/dominio/tipos'
import { ROTULO_GRAVIDADE } from '@/dominio/tipos'
import { cn } from '@/lib/utils'

/**
 * Uso de uma fórmula: campos numéricos e sim/não, um cartão por saída.
 * Os valores vivem só na memória deste componente (nenhum dado de paciente é salvo).
 */
const props = defineProps<{ calculadora: Pick<CalculadoraFormula, 'campos' | 'saidas'> }>()

const valores = ref<ValoresFormula>({})

function limpar() {
  valores.value = {}
}

function definirNumero(id: UUID, v: number | null) {
  valores.value = { ...valores.value, [id]: v }
}

/** Tocar de novo na opção marcada desmarca. */
function responder(id: UUID, v: boolean) {
  valores.value = { ...valores.value, [id]: valores.value[id] === v ? null : v }
}

function numero(id: UUID): number | null {
  const v = valores.value[id]
  return typeof v === 'number' ? v : null
}

const cartoes = computed(() => {
  const resultados = calcularSaidas(props.calculadora as CalculadoraFormula, valores.value)
  return props.calculadora.saidas.map((saida) => ({ saida, r: resultados.find((x) => x.saidaId === saida.id) }))
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid gap-2 md:grid-cols-2">
      <div v-for="campo in calculadora.campos" :key="campo.id" class="bg-card flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xs">
        <label :for="`campo-${campo.id}`" class="min-w-0 flex-1 text-sm font-semibold">
          {{ campo.rotulo || campo.variavel }}
          <span v-if="campo.tipo === 'numero' && (campo.min !== null || campo.max !== null)" class="text-muted-foreground block text-xs font-normal">
            <template v-if="campo.min !== null && campo.max !== null">de {{ formatarNumero(campo.min) }} a {{ formatarNumero(campo.max) }} {{ campo.unidade }}</template>
            <template v-else-if="campo.min !== null">a partir de {{ formatarNumero(campo.min) }} {{ campo.unidade }}</template>
            <template v-else>até {{ formatarNumero(campo.max as number) }} {{ campo.unidade }}</template>
          </span>
        </label>

        <div v-if="campo.tipo === 'sim_nao'" :id="`campo-${campo.id}`" class="flex shrink-0 gap-1.5" role="group" :aria-label="campo.rotulo">
          <button
            v-for="opcao in [
              { valor: true, rotulo: 'Sim' },
              { valor: false, rotulo: 'Não' },
            ]"
            :key="String(opcao.valor)"
            type="button"
            :aria-pressed="valores[campo.id] === opcao.valor"
            :class="cn(
              'flex h-11 min-w-16 items-center justify-center rounded-full border px-3 text-sm font-semibold',
              valores[campo.id] === opcao.valor ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent/70',
            )"
            @click="responder(campo.id, opcao.valor)"
          >
            {{ opcao.rotulo }}
          </button>
        </div>
        <CampoNumero
          v-else
          :id="`campo-${campo.id}`"
          :model-value="numero(campo.id)"
          :sufixo="campo.unidade"
          class="w-32 shrink-0"
          @update:model-value="definirNumero(campo.id, $event)"
        />
      </div>
    </div>

    <div class="flex items-center justify-between gap-3">
      <h2 class="text-muted-foreground text-xs font-semibold">{{ calculadora.saidas.length > 1 ? 'Resultados' : 'Resultado' }}</h2>
      <Button variant="outline" size="touch" class="rounded-full" @click="limpar"><Eraser /> Limpar</Button>
    </div>

    <div class="grid gap-2 md:grid-cols-2" aria-live="polite">
      <div v-for="{ saida, r } in cartoes" :key="saida.id" class="bg-card flex flex-col gap-2 rounded-3xl p-4 shadow-xs">
        <p class="text-muted-foreground text-xs font-semibold">{{ saida.nome || 'Resultado' }}</p>
        <template v-if="r?.ok">
          <p class="text-3xl font-extrabold">{{ r.texto }}</p>
          <p
            v-for="aviso in r.avisos"
            :key="aviso"
            class="border-atencao/45 bg-atencao/12 flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-sm font-semibold"
          >
            <TriangleAlert class="text-atencao size-4 shrink-0" /> {{ aviso }}
          </p>
          <div v-if="r.faixa" :class="cn('flex gap-2 rounded-2xl border p-3', ESTILO_GRAVIDADE[r.faixa.gravidade].caixa)">
            <component :is="ESTILO_GRAVIDADE[r.faixa.gravidade].componente" :class="cn('mt-0.5 size-5 shrink-0', ESTILO_GRAVIDADE[r.faixa.gravidade].icone)" />
            <div>
              <p class="text-xs font-semibold">{{ ROTULO_GRAVIDADE[r.faixa.gravidade] }}</p>
              <p class="whitespace-pre-line">{{ r.faixa.texto }}</p>
            </div>
          </div>
          <p v-else-if="saida.faixas.length" class="text-muted-foreground text-sm">Sem interpretação cadastrada para este valor.</p>
        </template>
        <p v-else-if="r" class="text-muted-foreground text-sm">{{ r.erro }}</p>
      </div>
    </div>
  </div>
</template>
