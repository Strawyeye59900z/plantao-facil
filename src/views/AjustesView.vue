<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChevronRight, FileUp, HardDrive, Moon, Trash2 } from '@lucide/vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { MENU } from '@/components/layout/navegacao'
import {
  consultarArmazenamento,
  pedirArmazenamentoPersistente,
  type StatusArmazenamento,
} from '@/db/armazenamento'
import { useConfiguracoesStore } from '@/stores/configuracoes'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
import ExcluirBiblioteca from '@/components/backup/ExcluirBiblioteca.vue'
import ConfiguracaoIA from '@/components/ia/ConfiguracaoIA.vue'
import SincronizacaoAnamnese from '@/components/anamnese/SincronizacaoAnamnese.vue'
import { apagarDadosDestePc, carregarBibliotecaDoArquivo } from '@/lib/penDrive'
import { armazenamento, MODO_PENDRIVE } from '@/modo'

const configuracoes = useConfiguracoesStore()

const temaEscuro = computed({
  get: () => configuracoes.config.tema === 'escuro',
  set: (escuro: boolean) => configuracoes.definirTema(escuro ? 'escuro' : 'claro'),
})

const status = ref<StatusArmazenamento | null>(null)
const usadoBytes = ref<number | null>(null)

const textoStatus: Record<StatusArmazenamento, string> = {
  persistente: 'Persistente — o navegador não apagará os dados por falta de espaço.',
  nao_persistente:
    'Não persistente — o navegador pode apagar os dados se faltar espaço. Instalar o app costuma resolver.',
  indisponivel: 'Este navegador não informa o tipo de armazenamento.',
}

async function atualizarStatus() {
  const info = await consultarArmazenamento()
  status.value = info.status
  usadoBytes.value = info.usadoBytes
}

async function pedirPersistencia() {
  status.value = await pedirArmazenamentoPersistente()
}

function formatarBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} KB`
  return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

const versao = __APP_VERSION__

onMounted(() => {
  if (!MODO_PENDRIVE) void atualizarStatus()
})

// ===== Modo pen drive =====
const router = useRouter()
/** O menu do topo sem o próprio Ajustes. */
const itensDeDados = MENU.filter((item) => item.rota !== '/ajustes')
const entradaBackup = ref<HTMLInputElement | null>(null)
const confirmarApagar = ref(false)
const dataBiblioteca = computed(() => {
  const de = configuracoes.config.bibliotecaPenDriveDe
  return de ? new Date(de).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null
})

async function atualizarBiblioteca(evento: Event) {
  const arquivo = (evento.target as HTMLInputElement).files?.[0]
  if (!arquivo) return
  const erro = await carregarBibliotecaDoArquivo(arquivo)
  if (entradaBackup.value) entradaBackup.value.value = ''
  if (erro) toast.error(erro)
  else toast.success('Biblioteca atualizada.')
}

async function apagar() {
  await apagarDadosDestePc()
  toast.success('Dados apagados deste PC.')
  router.replace('/carregar')
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-2xl font-semibold md:text-3xl">Ajustes</h1>

    <Card>
      <CardContent class="flex items-center justify-between gap-4">
        <Label for="tema-escuro" class="flex items-center gap-3 text-base font-normal">
          <Moon class="size-5" />
          Tema escuro
        </Label>
        <Switch id="tema-escuro" v-model="temaEscuro" />
      </CardContent>
    </Card>

    <Card v-if="!MODO_PENDRIVE">
      <CardHeader>
        <CardTitle class="flex items-center gap-2"><HardDrive class="size-5" /> Armazenamento</CardTitle>
        <CardDescription>Os dados ficam apenas neste aparelho.</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <p class="text-sm">{{ status ? textoStatus[status] : 'Verificando…' }}</p>
        <p v-if="usadoBytes !== null" class="text-muted-foreground text-sm">
          Em uso: {{ formatarBytes(usadoBytes) }}
        </p>
        <Button
          v-if="status === 'nao_persistente'"
          variant="outline"
          size="touch"
          class="self-start"
          @click="pedirPersistencia"
        >
          Pedir armazenamento persistente
        </Button>
      </CardContent>
    </Card>

    <!-- Importação por IA (desativada no pen drive: a chave nunca fica em PC do hospital) -->
    <ConfiguracaoIA v-if="!MODO_PENDRIVE" />

    <!-- Sincronização do bloco de notas e transcrições com o celular -->
    <SincronizacaoAnamnese v-if="!MODO_PENDRIVE" />

    <!-- Atalhos do menu do topo -->
    <Card v-if="!MODO_PENDRIVE" class="py-1">
      <nav class="flex flex-col" aria-label="Dados">
        <RouterLink
          v-for="item in itensDeDados"
          :key="item.rota"
          :to="item.rota"
          class="hover:bg-accent/70 flex h-14 items-center gap-3 px-4 text-base not-last:border-b"
        >
          <component :is="item.icone" class="size-5" />
          <span class="flex-1">{{ item.rotulo }}</span>
          <ChevronRight class="text-muted-foreground size-5" />
        </RouterLink>
      </nav>
    </Card>

    <ExcluirBiblioteca v-if="!MODO_PENDRIVE" />

    <!-- Modo pen drive: biblioteca deste PC -->
    <Card v-if="MODO_PENDRIVE">
      <CardHeader>
        <CardTitle class="flex items-center gap-2"><HardDrive class="size-5" /> Biblioteca deste PC</CardTitle>
        <CardDescription>
          {{ dataBiblioteca ? `Backup de ${dataBiblioteca}.` : 'Nenhuma biblioteca carregada.' }}
          <template v-if="armazenamento.emMemoria"> Este navegador não salva dados: a biblioteca some ao fechar a aba.</template>
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <input ref="entradaBackup" type="file" accept="application/json,.json" class="hidden" @change="atualizarBiblioteca" />
        <Button size="touch" variant="outline" class="self-start" @click="entradaBackup?.click()">
          <FileUp /> Atualizar biblioteca
        </Button>
        <p class="text-muted-foreground text-xs">Troca toda a biblioteca deste PC pelo backup escolhido.</p>
        <Button size="touch" variant="destructive" class="self-start" @click="confirmarApagar = true">
          <Trash2 /> Apagar dados deste PC
        </Button>
      </CardContent>
    </Card>

    <DialogoConfirmar
      v-model:aberto="confirmarApagar"
      titulo="Apagar dados deste PC?"
      descricao="A biblioteca e as configurações salvas neste navegador serão apagadas. O pen drive não é alterado."
      rotulo-confirmar="Apagar"
      perigoso
      @confirmar="apagar"
    />

    <p class="text-muted-foreground text-center text-xs">Plantão Fácil · versão {{ versao }}</p>
  </section>
</template>
