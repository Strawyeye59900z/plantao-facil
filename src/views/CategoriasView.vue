<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
import type { Categoria, UUID } from '@/dominio/tipos'
import { ROTULO_SEM_CATEGORIA, useCategoriasStore } from '@/stores/categorias'

const categorias = useCategoriasStore()

const nova = ref('')
const editandoId = ref<UUID | null>(null)
const nomeEditado = ref('')
const paraExcluir = ref<Categoria | null>(null)

function nomeRepetido(nome: string, ignorarId?: UUID) {
  return categorias.dePrescricoes.some(
    (c) => c.id !== ignorarId && c.nome.localeCompare(nome, 'pt-BR', { sensitivity: 'base' }) === 0,
  )
}

async function criar() {
  const nome = nova.value.trim()
  if (!nome) return
  if (nomeRepetido(nome)) {
    toast.error('Já existe uma categoria com esse nome.')
    return
  }
  // Limpa antes de gravar: evita juntar nomes se o usuário digitar/tocar de novo durante a gravação.
  nova.value = ''
  await categorias.criar(nome, 'prescricao')
}

function editar(c: Categoria) {
  editandoId.value = c.id
  nomeEditado.value = c.nome
}

async function salvarNome() {
  const nome = nomeEditado.value.trim()
  if (!editandoId.value || !nome) return
  if (nomeRepetido(nome, editandoId.value)) {
    toast.error('Já existe uma categoria com esse nome.')
    return
  }
  await categorias.renomear(editandoId.value, nome)
  editandoId.value = null
}

const confirmarExclusao = computed({
  get: () => paraExcluir.value !== null,
  set: (aberto) => {
    if (!aberto) paraExcluir.value = null
  },
})

const descricaoExclusao = computed(() => {
  if (!paraExcluir.value) return ''
  const n = categorias.emUso(paraExcluir.value.id)
  if (n === 0) return 'Nenhuma prescrição usa esta categoria.'
  return `${n} ${n === 1 ? 'prescrição ficará' : 'prescrições ficarão'} como “${ROTULO_SEM_CATEGORIA}”.`
})

async function excluir() {
  if (!paraExcluir.value) return
  await categorias.excluir(paraExcluir.value.id)
  paraExcluir.value = null
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-2xl font-semibold">Categorias de prescrições</h1>

    <form class="flex gap-2" @submit.prevent="criar">
      <Input v-model="nova" class="h-11 flex-1" placeholder="Nova categoria" aria-label="Nome da nova categoria" />
      <Button type="submit" size="touch"><Plus /> Criar</Button>
    </form>

    <p v-if="categorias.dePrescricoes.length === 0" class="text-muted-foreground py-6 text-center">
      Nenhuma categoria cadastrada.
    </p>

    <ul v-else class="bg-card ring-foreground/10 divide-y overflow-hidden rounded-xl ring-1">
      <li v-for="(c, i) in categorias.dePrescricoes" :key="c.id" class="flex min-h-14 items-center gap-1 px-2 py-1">
        <template v-if="editandoId === c.id">
          <Input
            v-model="nomeEditado"
            class="h-11 flex-1"
            :aria-label="`Novo nome para ${c.nome}`"
            @keydown.enter.prevent="salvarNome"
            @keydown.esc="editandoId = null"
          />
          <Button variant="ghost" size="icon-touch" aria-label="Salvar nome" @click="salvarNome"><Check /></Button>
          <Button variant="ghost" size="icon-touch" aria-label="Cancelar" @click="editandoId = null"><X /></Button>
        </template>
        <template v-else>
          <span class="flex-1 px-2">
            {{ c.nome }}
            <span class="text-muted-foreground text-sm">· {{ categorias.emUso(c.id) }}</span>
          </span>
          <Button variant="ghost" size="icon-touch" :disabled="i === 0" aria-label="Mover para cima" @click="categorias.mover(c.id, -1)">
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-touch"
            :disabled="i === categorias.dePrescricoes.length - 1"
            aria-label="Mover para baixo"
            @click="categorias.mover(c.id, 1)"
          >
            <ArrowDown />
          </Button>
          <Button variant="ghost" size="icon-touch" :aria-label="`Renomear ${c.nome}`" @click="editar(c)"><Pencil /></Button>
          <Button variant="ghost" size="icon-touch" :aria-label="`Excluir ${c.nome}`" @click="paraExcluir = c">
            <Trash2 class="text-destructive" />
          </Button>
        </template>
      </li>
    </ul>

    <DialogoConfirmar
      v-model:aberto="confirmarExclusao"
      :titulo="`Excluir “${paraExcluir?.nome}”?`"
      :descricao="descricaoExclusao"
      rotulo-confirmar="Excluir"
      perigoso
      @confirmar="excluir"
    />
  </section>
</template>
