<script setup lang="ts">
import { Plus, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import CampoNumero from '@/components/comum/CampoNumero.vue'
import CampoSelect from '@/components/comum/CampoSelect.vue'
import { faixaInterpretacaoVazia } from '@/dominio/calculadoras/editar'
import { GRAVIDADES, ROTULO_GRAVIDADE, type FaixaInterpretacao, type Gravidade } from '@/dominio/tipos'

const faixas = defineModel<FaixaInterpretacao[]>({ required: true })
const opcoesGravidade = GRAVIDADES.map((g) => ({ valor: g as Gravidade, rotulo: ROTULO_GRAVIDADE[g] }))
</script>

<template>
  <fieldset class="flex flex-col gap-3">
    <legend class="mb-2 text-lg font-semibold">Interpretação</legend>
    <p class="text-muted-foreground text-xs">Faixas do resultado: de ≤ resultado ≤ até (vazio = sem limite).</p>
    <div
      v-for="(faixa, i) in faixas"
      :key="faixa.id"
      class="bg-card ring-foreground/10 flex flex-col gap-2 rounded-xl p-3 ring-1"
    >
      <div class="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
        <CampoNumero v-model="faixa.de" placeholder="de" :aria-label="`Interpretação ${i + 1}: de`" />
        <CampoNumero v-model="faixa.ate" placeholder="até" :aria-label="`Interpretação ${i + 1}: até`" />
        <Button type="button" variant="ghost" size="icon-touch" aria-label="Remover faixa" @click="faixas.splice(i, 1)">
          <Trash2 class="text-destructive" />
        </Button>
      </div>
      <CampoSelect v-model="faixa.gravidade" :opcoes="opcoesGravidade" :aria-label="`Gravidade da interpretação ${i + 1}`" />
      <Textarea v-model="faixa.texto" placeholder="Texto da interpretação" :aria-label="`Texto da interpretação ${i + 1}`" />
    </div>
    <Button type="button" variant="outline" size="touch" @click="faixas.push(faixaInterpretacaoVazia())">
      <Plus /> Adicionar faixa
    </Button>
  </fieldset>
</template>
