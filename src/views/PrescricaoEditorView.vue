<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
import FormularioPrescricao from '@/components/prescricoes/FormularioPrescricao.vue'
import { useAvisoSaida } from '@/composables/useAvisoSaida'
import { paraDados, prescricaoVazia, validarPrescricao, type DadosPrescricao } from '@/dominio/prescricoes/editar'
import { useCategoriasStore } from '@/stores/categorias'
import { usePrescricoesStore } from '@/stores/prescricoes'

const route = useRoute()
const router = useRouter()
const prescricoes = usePrescricoesStore()
const categorias = useCategoriasStore()

const idEdicao = computed(() => (route.params.id ? String(route.params.id) : null))
const original = idEdicao.value ? prescricoes.obter(idEdicao.value) : undefined
const naoEncontrada = idEdicao.value !== null && !original

const dados = ref<DadosPrescricao>(original ? paraDados(original) : prescricaoVazia())
const inicial = ref(JSON.stringify(dados.value))
const alterado = computed(() => JSON.stringify(dados.value) !== inicial.value)

const erros = ref<string[]>([])
const caixaErros = ref<HTMLElement | null>(null)

// ===== Salvar / sair =====
let salvando = false

async function salvar() {
  if (salvando) return
  erros.value = validarPrescricao(dados.value, (id) => !!categorias.obter(id))
  if (erros.value.length) {
    await nextTick()
    caixaErros.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  salvando = true
  try {
    const salva = idEdicao.value
      ? await prescricoes.atualizar(idEdicao.value, dados.value)
      : await prescricoes.criar(dados.value)
    inicial.value = JSON.stringify(dados.value)
    toast.success('Prescrição salva.')
    await router.replace(`/prescricoes/${salva.id}`)
  } catch (erro) {
    toast.error(`Não foi possível salvar: ${erro instanceof Error ? erro.message : String(erro)}`)
  } finally {
    salvando = false
  }
}

// Aviso ao sair com alterações não salvas (depois de salvar, `inicial` é atualizado e libera a saída).
const { confirmarSaida, responderSaida } = useAvisoSaida(alterado)
</script>

<template>
  <section v-if="naoEncontrada" class="flex flex-col items-start gap-4">
    <h1 class="text-2xl font-semibold md:text-3xl">Prescrição não encontrada</h1>
    <Button size="touch" as-child><RouterLink to="/prescricoes">Voltar para a lista</RouterLink></Button>
  </section>

  <form v-else class="flex flex-col gap-6 pb-24" novalidate @submit.prevent="salvar">
    <div v-if="erros.length" ref="caixaErros" role="alert" class="border-critico/35 bg-critico/10 rounded-xl border p-3">
      <p class="font-semibold">Corrija antes de salvar:</p>
      <ul class="list-disc pl-5 text-sm">
        <li v-for="erro in erros" :key="erro">{{ erro }}</li>
      </ul>
    </div>

    <FormularioPrescricao v-model="dados" />

    <!-- Barra de ações fixa -->
    <div
      class="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 px-3 md:px-8"
    >
      <div class="bg-card/95 pointer-events-auto mx-auto flex max-w-[44rem] items-center gap-2 rounded-2xl border p-2 shadow-lg backdrop-blur-md">
        <Button type="button" variant="outline" size="touch" class="flex-1" @click="router.back()">Cancelar</Button>
        <Button type="submit" size="touch" class="flex-1">Salvar</Button>
      </div>
    </div>

    <DialogoConfirmar
      v-model:aberto="confirmarSaida"
      titulo="Descartar alterações?"
      descricao="As alterações feitas nesta prescrição não foram salvas."
      rotulo-confirmar="Descartar"
      perigoso
      @confirmar="responderSaida(true)"
      @cancelar="responderSaida(false)"
    />
  </form>
</template>
