<script setup lang="ts">
import { computed } from 'vue'
import type { ItemPlano } from '@/dominio/backup/backup'
import type { Entidade } from '@/dominio/tipos'
import { cn } from '@/lib/utils'

const props = defineProps<{
  item: ItemPlano<Entidade>
  /** Ex.: "Prescrição", "Grupo". */
  tipo: string
  nome: (e: Entidade) => string
}>()

const escolha = defineModel<'local' | 'arquivo'>({ required: true })

const ROTULOS: Record<string, string> = {
  titulo: 'título',
  nome: 'nome',
  categoriaId: 'categoria',
  tags: 'tags',
  itens: 'itens',
  condicoes: 'condições',
  alertas: 'alertas',
  receita: 'receita pronta',
  observacoes: 'observações',
  referencia: 'referência',
  favorito: 'favorito',
  origem: 'origem',
  revisada: 'revisão',
  duvidasImportacao: 'dúvidas da importação',
  excluidoEm: 'lixeira',
  criadoEm: 'data de criação',
  ordem: 'ordem',
  escopo: 'módulo',
  descricao: 'descrição',
  faixas: 'faixas',
  campos: 'campos',
  entradas: 'entradas',
  expressao: 'expressão',
}

const campos = computed(() => props.item.campos.map((c) => ROTULOS[c] ?? c).join(', '))

function data(e: Entidade) {
  return new Date(e.atualizadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const lados = computed(() => [
  { valor: 'local' as const, rotulo: 'Neste aparelho', entidade: props.item.local! },
  { valor: 'arquivo' as const, rotulo: 'No arquivo', entidade: props.item.arquivo },
])
</script>

<template>
  <fieldset class="bg-card border shadow-xs flex flex-col gap-2 rounded-2xl p-3">
    <legend class="sr-only">{{ tipo }}: {{ nome(item.arquivo) }}</legend>
    <p class="text-muted-foreground text-xs">{{ tipo }} · diferenças: {{ campos }}</p>
    <div class="grid grid-cols-2 gap-2">
      <label
        v-for="lado in lados"
        :key="lado.valor"
        :class="cn(
          'flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-2.5 text-sm',
          escolha === lado.valor ? 'border-primary/50 bg-primary/10' : 'border-transparent bg-muted/50',
        )"
      >
        <span class="flex items-center gap-2">
          <input v-model="escolha" type="radio" :value="lado.valor" class="accent-primary size-4" />
          <span class="font-semibold">{{ lado.rotulo }}</span>
        </span>
        <span class="font-medium break-words">{{ nome(lado.entidade) }}</span>
        <span class="text-muted-foreground text-xs">alterada em {{ data(lado.entidade) }}</span>
        <span v-if="lado.entidade.excluidoEm" class="text-destructive text-xs font-medium">na lixeira</span>
        <span v-if="item.maisRecente === lado.valor" class="text-primary text-xs font-medium">mais recente</span>
      </label>
    </div>
  </fieldset>
</template>
