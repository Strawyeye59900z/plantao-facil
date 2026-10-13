<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChevronRight, HardDrive, Moon } from '@lucide/vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { NAVEGACAO_SECUNDARIA } from '@/components/layout/navegacao'
import {
  consultarArmazenamento,
  pedirArmazenamentoPersistente,
  type StatusArmazenamento,
} from '@/db/armazenamento'
import { useConfiguracoesStore } from '@/stores/configuracoes'

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

onMounted(atualizarStatus)
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-2xl font-semibold">Ajustes</h1>

    <Card>
      <CardContent class="flex items-center justify-between gap-4">
        <Label for="tema-escuro" class="flex items-center gap-3 text-base font-normal">
          <Moon class="size-5" />
          Tema escuro
        </Label>
        <Switch id="tema-escuro" v-model="temaEscuro" />
      </CardContent>
    </Card>

    <Card>
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

    <!-- No PC estes itens também estão no menu lateral -->
    <Card class="py-1">
      <nav class="flex flex-col" aria-label="Dados">
        <RouterLink
          v-for="item in NAVEGACAO_SECUNDARIA"
          :key="item.rota"
          :to="item.rota"
          class="hover:bg-muted flex h-14 items-center gap-3 px-4 text-base not-last:border-b"
        >
          <component :is="item.icone" class="size-5" />
          <span class="flex-1">{{ item.rotulo }}</span>
          <ChevronRight class="text-muted-foreground size-5" />
        </RouterLink>
      </nav>
    </Card>

    <p class="text-muted-foreground text-center text-xs">Plantão Fácil · versão {{ versao }}</p>
  </section>
</template>
