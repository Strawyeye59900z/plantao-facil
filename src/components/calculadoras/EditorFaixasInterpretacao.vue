<script setup lang="ts">
import { computed, nextTick } from 'vue'
import { OctagonAlert, Plus, Trash2, TriangleAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import CampoNumero from '@/components/comum/CampoNumero.vue'
import CampoSelect from '@/components/comum/CampoSelect.vue'
import { faixaInterpretacaoVazia } from '@/dominio/calculadoras/editar'
import { analisarFaixas } from '@/dominio/calculadoras/interpretacao'
import { GRAVIDADES, ROTULO_GRAVIDADE, type FaixaInterpretacao, type Gravidade } from '@/dominio/tipos'
import { cn } from '@/lib/utils'
import { ESTILO_GRAVIDADE } from '@/components/prescricoes/gravidade'

/**
 * Faixas de interpretação de um resultado (escala ou saída de fórmula).
 * `rotulo` entra nos aria-labels ("Saída 1") e `prefixo` deixa os ids únicos.
 * Com `casasDecimais`, mostra ao vivo os erros e avisos de `analisarFaixas`.
 */
const props = withDefaults(defineProps<{ prefixo: string; rotulo?: string; casasDecimais?: number | null }>(), {
  rotulo: '',
  casasDecimais: null,
})
const faixas = defineModel<FaixaInterpretacao[]>({ required: true })

const opcoesGravidade = GRAVIDADES.map((g) => ({ valor: g as Gravidade, rotulo: ROTULO_GRAVIDADE[g] }))
const nome = (i: number) => `${props.rotulo ? `${props.rotulo}, ` : ''}interpretação ${i + 1}`

const valida = (x: number | null) => x === null || Number.isFinite(x)
const analise = computed(() => {
  const casas = props.casasDecimais
  if (casas === null || !Number.isInteger(casas) || casas < 0 || casas > 6) return null
  return analisarFaixas(faixas.value.filter((f) => valida(f.de) && valida(f.ate)), casas)
})

async function adicionar() {
  const nova = faixaInterpretacaoVazia()
  faixas.value.push(nova)
  await nextTick()
  const campo = document.getElementById(`${props.prefixo}faixa-${nova.id}-de`)
  campo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  campo?.focus({ preventScroll: true })
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="text-muted-foreground text-sm">Faixas do resultado: de ≤ resultado ≤ até (vazio = sem limite).</p>
    <div
      v-for="(faixa, i) in faixas"
      :key="faixa.id"
      :class="cn('flex flex-col gap-2 rounded-2xl border p-3', ESTILO_GRAVIDADE[faixa.gravidade].caixa)"
    >
      <div class="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
        <CampoNumero :id="`${prefixo}faixa-${faixa.id}-de`" v-model="faixa.de" placeholder="de" :aria-label="`${nome(i)}: de`" />
        <CampoNumero v-model="faixa.ate" placeholder="até" :aria-label="`${nome(i)}: até`" />
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          class="rounded-full"
          :aria-label="`Remover ${nome(i)}`"
          @click="faixas.splice(i, 1)"
        >
          <Trash2 class="text-destructive" />
        </Button>
      </div>
      <CampoSelect v-model="faixa.gravidade" :opcoes="opcoesGravidade" :aria-label="`Gravidade: ${nome(i)}`" />
      <Textarea v-model="faixa.texto" placeholder="Texto da interpretação" :aria-label="`Texto: ${nome(i)}`" />
    </div>

    <ul v-if="analise && (analise.erros.length || analise.avisos.length)" class="flex flex-col gap-1 text-sm">
      <li v-for="erro in analise.erros" :key="erro" class="text-destructive flex items-start gap-1.5">
        <OctagonAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {{ erro }}
      </li>
      <li v-for="aviso in analise.avisos" :key="aviso" class="flex items-start gap-1.5">
        <TriangleAlert class="text-atencao mt-0.5 size-4 shrink-0" aria-hidden="true" /> {{ aviso }}
      </li>
    </ul>

    <Button type="button" variant="outline" size="touch" class="self-start rounded-full" @click="adicionar">
      <Plus /> Adicionar faixa
    </Button>
  </div>
</template>
