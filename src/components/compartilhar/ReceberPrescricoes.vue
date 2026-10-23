<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { toast } from 'vue-sonner'
import { Download, GitMerge } from '@lucide/vue'
import CartaoConflito from '@/components/backup/CartaoConflito.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { gravarNaBiblioteca, lerBiblioteca } from '@/db/backup'
import {
  aplicarMesclagem,
  contarSituacoes,
  planejarMesclagem,
  type Escolhas,
  type ItemPlano,
  type PlanoMesclagem,
} from '@/dominio/backup/backup'
import { marcarComoRecebidas } from '@/dominio/compartilhar/pacote'
import type { ArquivoBackup, Entidade } from '@/dominio/tipos'
import { baixarPacote } from '@/lib/compartilhar/compartilhar'
import { cn } from '@/lib/utils'
import { useCalculadorasStore } from '@/stores/calculadoras'
import { useCategoriasStore } from '@/stores/categorias'
import { usePrescricoesStore } from '@/stores/prescricoes'

/**
 * Receber prescrições de um colega: digita o código, vê o que é novo, igual ou conflitante e mescla.
 * O que entra fica marcado "Recebida de colega" e "não revisada".
 */
const prescricoes = usePrescricoesStore()
const categorias = useCategoriasStore()
const calculadoras = useCalculadorasStore()

const codigo = ref('')
const buscando = ref(false)
const importando = ref(false)
const erro = ref<string | null>(null)
const pacote = shallowRef<ArquivoBackup | null>(null)
const plano = shallowRef<PlanoMesclagem | null>(null)
const escolhas = ref<Escolhas>({})

function limpar() {
  pacote.value = null
  plano.value = null
  escolhas.value = {}
  erro.value = null
}

async function buscar() {
  limpar()
  buscando.value = true
  try {
    const leitura = await baixarPacote(codigo.value)
    if (!leitura.ok) {
      erro.value = leitura.erro
      return
    }
    pacote.value = leitura.backup
    plano.value = planejarMesclagem(await lerBiblioteca(), leitura.backup)
    usarMaisRecentes()
  } catch (falha) {
    erro.value = falha instanceof Error ? falha.message : String(falha)
  } finally {
    buscando.value = false
  }
}

function nomeEntidade(e: Entidade) {
  const x = e as Entidade & { titulo?: string; nome?: string }
  return x.titulo ?? x.nome ?? e.id
}

const resumo = computed(() => {
  if (!plano.value) return []
  return [
    { rotulo: 'Prescrições', ...contarSituacoes(plano.value.prescricoes), total: plano.value.prescricoes.length },
    { rotulo: 'Calculadoras e escalas', ...contarSituacoes(plano.value.calculadoras), total: plano.value.calculadoras.length },
    { rotulo: 'Grupos', ...contarSituacoes(plano.value.categorias), total: plano.value.categorias.length },
  ].filter((l) => l.total > 0)
})

const conflitos = computed(() => {
  if (!plano.value) return []
  const lista: { item: ItemPlano<Entidade>; tipo: string }[] = [
    ...plano.value.categorias.map((item) => ({ item, tipo: 'Grupo' })),
    ...plano.value.prescricoes.map((item) => ({ item, tipo: 'Prescrição' })),
    ...plano.value.calculadoras.map((item) => ({ item, tipo: item.arquivo.area === 'escala' ? 'Escala' : 'Calculadora' })),
  ]
  return lista.filter((c) => c.item.situacao === 'conflito')
})

function usarMaisRecentes() {
  const novo: Escolhas = {}
  for (const { item } of conflitos.value) novo[item.id] = item.maisRecente
  escolhas.value = novo
}

const aGravar = computed(() => (plano.value ? aplicarMesclagem(plano.value, escolhas.value) : null))
const total = computed(() =>
  aGravar.value ? aGravar.value.prescricoes.length + aGravar.value.calculadoras.length + aGravar.value.categorias.length : 0,
)

async function importar() {
  if (!aGravar.value) return
  importando.value = true
  try {
    const { prescricoes: novas } = aGravar.value
    await gravarNaBiblioteca({ ...aGravar.value, prescricoes: marcarComoRecebidas(novas) })
    await Promise.all([prescricoes.carregar(), categorias.carregar(), calculadoras.carregar()])
    toast.success(`${novas.length} ${novas.length === 1 ? 'prescrição recebida' : 'prescrições recebidas'}, marcadas para revisar.`)
    limpar()
    codigo.value = ''
  } catch (falha) {
    toast.error(`A importação falhou e nada foi alterado: ${falha instanceof Error ? falha.message : String(falha)}`)
  } finally {
    importando.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2"><Download class="size-5" /> Receber de colega</CardTitle>
      <CardDescription>
        Digite o código que o colega passou. Você vê o que é novo antes de importar. Tudo o que chegar fica marcado como
        “Recebida de colega” e “revisar antes de usar”.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <form class="flex gap-2" @submit.prevent="buscar">
        <Input
          v-model="codigo"
          class="h-11 flex-1 font-mono tracking-widest uppercase"
          aria-label="Código do colega"
          placeholder="XXXX-XXXX"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
        />
        <Button size="touch" type="submit" :disabled="buscando || importando || !codigo.trim()">
          {{ buscando ? 'Buscando…' : 'Buscar' }}
        </Button>
      </form>

      <p v-if="erro" role="alert" class="border-critico/35 bg-critico/10 rounded-xl border p-3 text-sm">{{ erro }}</p>

      <template v-if="plano && pacote">
        <p class="text-muted-foreground text-sm">
          Pacote enviado em {{ new Date(pacote.exportadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) }}.
        </p>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-muted-foreground text-left text-xs">
              <tr>
                <th class="py-1 font-medium"></th>
                <th class="py-1 text-right font-medium">No pacote</th>
                <th class="py-1 text-right font-medium">Novos</th>
                <th class="py-1 text-right font-medium">Iguais</th>
                <th class="py-1 text-right font-medium">Conflitos</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="linha in resumo" :key="linha.rotulo" class="border-t">
                <td class="py-2">{{ linha.rotulo }}</td>
                <td class="py-2 text-right">{{ linha.total }}</td>
                <td class="py-2 text-right">{{ linha.novo }}</td>
                <td class="py-2 text-right">{{ linha.igual }}</td>
                <td :class="cn('py-2 text-right', linha.conflito && 'text-atencao font-semibold')">{{ linha.conflito }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="plano.categoriasUnificadas.length" class="text-muted-foreground text-sm">
          Grupos com o mesmo nome serão juntados: {{ plano.categoriasUnificadas.map((c) => c.nome).join(', ') }}.
        </p>

        <div v-if="conflitos.length" class="flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-semibold">Conflitos ({{ conflitos.length }})</h3>
            <Button size="sm" variant="ghost" @click="usarMaisRecentes">Usar sempre a mais recente</Button>
          </div>
          <CartaoConflito
            v-for="c in conflitos"
            :key="c.item.id"
            v-model="escolhas[c.item.id]!"
            :item="c.item"
            :tipo="c.tipo"
            :nome="nomeEntidade"
            rotulo-arquivo="Do colega"
          />
        </div>

        <p v-if="total === 0" class="text-muted-foreground text-sm">Nada a importar: você já tem tudo o que está no pacote.</p>
        <div class="flex flex-wrap gap-2">
          <Button size="touch" :disabled="importando || total === 0" @click="importar">
            <GitMerge /> Importar ({{ total }} {{ total === 1 ? 'registro' : 'registros' }})
          </Button>
          <Button size="touch" variant="ghost" :disabled="importando" @click="limpar">Cancelar</Button>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
