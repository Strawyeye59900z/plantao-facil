<script setup lang="ts">
import { condicaoDoItem } from '@/dominio/prescricoes/condicoes'
import type { EscolhasOu } from '@/dominio/prescricoes/copia'
import { ROTULO_TIPO_ALERTA, type Alerta, type Condicao, type ItemPrescricao, type UUID } from '@/dominio/tipos'
import { cn } from '@/lib/utils'
import ItemOu from './ItemOu.vue'
import { TINTA_GRAVIDADE } from './tintaGravidade'

/**
 * Lista numerada dos itens visíveis ("Sempre" + condições marcadas), já na ordem de exibição.
 * O número é a posição na lista — o mesmo que vai para a cópia.
 */
const props = defineProps<{
  itens: ItemPrescricao[]
  /** Para marcar (número na cor de destaque) os itens que entraram por uma condição. */
  condicoes: Condicao[]
  alertas: Alerta[]
  /** Item "OU" que falta escolher (destacado depois de um Copiar com erro). */
  destacado?: UUID | null
}>()
const escolhas = defineModel<EscolhasOu>('escolhas', { required: true })

function alertasDoItem(itemId: UUID) {
  return props.alertas.filter((a) => a.itemId === itemId)
}

function escolher(itemId: UUID, opcaoId: UUID) {
  escolhas.value = { ...escolhas.value, [itemId]: opcaoId }
}

const ETIQUETA = 'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap'
</script>

<template>
  <ol class="flex flex-col">
    <li
      v-for="(item, i) in itens"
      :id="`item-${item.id}`"
      :key="item.id"
      class="border-border flex gap-3 border-b py-3 first:pt-0 md:gap-2.5 md:py-2 last:border-b-0 last:pb-0"
    >
      <span
        :class="cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums md:size-6 md:text-xs',
          condicaoDoItem(item, condicoes) ? 'bg-primary text-primary-foreground' : 'bg-secondary',
        )"
      >
        {{ i + 1 }}
      </span>

      <div class="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5 md:gap-1 md:pt-px">
        <ItemOu
          v-if="item.opcoes.length >= 2"
          :item="item"
          :numero="i + 1"
          :escolhida="escolhas[item.id]"
          :destacado="destacado === item.id"
          @escolher="(opcaoId) => escolher(item.id, opcaoId)"
        >
          <template #etiquetas>
            <span
              v-for="alerta in alertasDoItem(item.id)"
              :key="alerta.id"
              :class="cn(ETIQUETA, TINTA_GRAVIDADE[alerta.gravidade])"
            >
              ⚠ {{ ROTULO_TIPO_ALERTA[alerta.tipo] }}
            </span>
          </template>
        </ItemOu>
        <p v-else class="text-[15px] leading-relaxed md:text-sm md:leading-normal">
          <span class="whitespace-pre-line">{{ item.opcoes[0]?.texto }}</span>
          <span
            v-for="alerta in alertasDoItem(item.id)"
            :key="alerta.id"
            :class="cn(ETIQUETA, 'ml-1.5 align-[1px]', TINTA_GRAVIDADE[alerta.gravidade])"
          >
            ⚠ {{ ROTULO_TIPO_ALERTA[alerta.tipo] }}
          </span>
        </p>

        <!-- Texto completo do alerta do item, sempre visível -->
        <p
          v-for="alerta in alertasDoItem(item.id)"
          :key="alerta.id"
          role="note"
          :class="cn('rounded-xl border px-3 py-1.5 text-sm leading-snug whitespace-pre-line', TINTA_GRAVIDADE[alerta.gravidade])"
        >
          <span class="sr-only">{{ ROTULO_TIPO_ALERTA[alerta.tipo] }}: </span>{{ alerta.texto }}
        </p>
      </div>
    </li>
  </ol>
</template>
