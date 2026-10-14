<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Eye, EyeOff, ExternalLink, Sparkles, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import CampoSelect from '@/components/comum/CampoSelect.vue'
import { PROVEDORES } from '@/dominio/ia/provedores'
import type { IdProvedor } from '@/dominio/tipos'
import { useConfiguracoesStore } from '@/stores/configuracoes'

const configuracoes = useConfiguracoesStore()

const OUTRO = '__outro__'
const opcoesProvedor = (Object.keys(PROVEDORES) as IdProvedor[]).map((id) => ({ valor: id, rotulo: PROVEDORES[id].nome }))

const provedorId = computed({
  get: () => configuracoes.config.ia.provedor,
  set: (id: IdProvedor) => void configuracoes.definirProvedor(id),
})
const provedor = computed(() => PROVEDORES[provedorId.value])
const temChave = computed(() => !!configuracoes.config.ia.chaves[provedorId.value])

// Chave: editada num campo local e salva ao sair do campo (ou Enter).
const chaveDigitada = ref('')
const mostrarChave = ref(false)
watch(
  provedorId,
  (id) => {
    chaveDigitada.value = configuracoes.config.ia.chaves[id] ?? ''
    mostrarChave.value = false
  },
  { immediate: true },
)

async function salvarChave() {
  const atual = configuracoes.config.ia.chaves[provedorId.value] ?? ''
  if (chaveDigitada.value.trim() === atual) return
  await configuracoes.definirChave(provedorId.value, chaveDigitada.value)
  toast.success(chaveDigitada.value.trim() ? 'Chave salva neste aparelho.' : 'Chave apagada.')
}

async function apagarChave() {
  chaveDigitada.value = ''
  await configuracoes.definirChave(provedorId.value, '')
  toast.success('Chave apagada deste aparelho.')
}

// Modelo: lista do provedor + "Outro…" (texto livre).
const modeloAtual = computed(() => configuracoes.modeloDe(provedorId.value))
const naLista = computed(() => provedor.value.modelos.some((m) => m.id === modeloAtual.value))
const opcoesModelo = computed(() => [
  ...provedor.value.modelos.map((m) => ({ valor: m.id, rotulo: m.rotulo })),
  { valor: OUTRO, rotulo: 'Outro (digitar o nome)…' },
])
const escolhaModelo = ref('')
const modeloLivre = ref('')
watch(
  [provedorId, modeloAtual],
  () => {
    escolhaModelo.value = naLista.value ? modeloAtual.value : OUTRO
    modeloLivre.value = naLista.value ? '' : modeloAtual.value
  },
  { immediate: true },
)

async function aoEscolherModelo(valor: string) {
  escolhaModelo.value = valor
  if (valor !== OUTRO) await configuracoes.definirModelo(provedorId.value, valor)
}

async function salvarModeloLivre() {
  if (modeloLivre.value.trim()) await configuracoes.definirModelo(provedorId.value, modeloLivre.value)
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2"><Sparkles class="size-5" /> Importação de PDF por IA</CardTitle>
      <CardDescription>A chave fica só neste aparelho e não entra no backup.</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <Label for="ia-provedor">Provedor</Label>
        <CampoSelect id="ia-provedor" v-model="provedorId" :opcoes="opcoesProvedor" />
      </div>

      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-2">
          <Label for="ia-chave">Chave de API</Label>
          <a
            :href="provedor.linkChave"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary flex items-center gap-1 text-sm font-medium hover:underline"
          >
            Obter chave <ExternalLink class="size-3.5" />
          </a>
        </div>
        <div class="flex gap-2">
          <div class="relative flex-1">
            <Input
              id="ia-chave"
              v-model="chaveDigitada"
              :type="mostrarChave ? 'text' : 'password'"
              class="h-11 pr-11 font-mono"
              autocomplete="off"
              spellcheck="false"
              :placeholder="temChave ? '' : 'Cole aqui a chave'"
              @blur="salvarChave"
              @keydown.enter.prevent="salvarChave"
            />
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg"
              :aria-label="mostrarChave ? 'Ocultar chave' : 'Mostrar chave'"
              @click="mostrarChave = !mostrarChave"
            >
              <EyeOff v-if="mostrarChave" class="size-5" />
              <Eye v-else class="size-5" />
            </button>
          </div>
          <Button v-if="temChave" variant="ghost" size="icon-touch" aria-label="Apagar chave" @click="apagarChave">
            <Trash2 class="text-destructive" />
          </Button>
        </div>
        <p class="text-muted-foreground text-xs">
          {{ temChave ? 'Chave salva.' : 'Sem chave para este provedor.' }} Limite do PDF: {{ provedor.limites.descricao }}.
        </p>
      </div>

      <div class="flex flex-col gap-1.5">
        <Label for="ia-modelo">Modelo</Label>
        <CampoSelect id="ia-modelo" :model-value="escolhaModelo" :opcoes="opcoesModelo" @update:model-value="aoEscolherModelo" />
        <Input
          v-if="escolhaModelo === OUTRO"
          v-model="modeloLivre"
          class="h-11 font-mono"
          placeholder="nome exato do modelo"
          aria-label="Nome do modelo"
          autocapitalize="off"
          spellcheck="false"
          @blur="salvarModeloLivre"
          @keydown.enter.prevent="salvarModeloLivre"
        />
      </div>
    </CardContent>
  </Card>
</template>
