<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { HeartPulse, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
import PcrAtiva from '@/components/pcr/PcrAtiva.vue'
import PcrHistorico from '@/components/pcr/PcrHistorico.vue'
import { VALIDADE_MS } from '@/dominio/pcr/pcr'
import { garantirCodigoPc, pc } from '@/lib/anamnese/estado'
import { consultarRegistrosNoPc, erroPcr, registrosNoPc } from '@/lib/pcr/sincronizar'
import { usePcrStore } from '@/stores/pcr'

/**
 * PCR. No celular: cronômetro da parada, registro do que foi feito e histórico (2 dias).
 * No PC: só mostra o que o celular enviou nesta sessão de sincronização, sem salvar nada.
 */
const ehCelular = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
const pcr = usePcrStore()

const encerradas = computed(() => pcr.registros.filter((r) => r.encerradoEm !== null))
const confirmarTudo = ref(false)
const dias = VALIDADE_MS / (24 * 60 * 60 * 1000)

let relogioPc: ReturnType<typeof setInterval> | undefined
onMounted(async () => {
  if (ehCelular) return
  await garantirCodigoPc()
  void consultarRegistrosNoPc()
  relogioPc = setInterval(consultarRegistrosNoPc, 3000)
})
onBeforeUnmount(() => clearInterval(relogioPc))
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 v-if="!(ehCelular && pcr.ativa)" class="text-2xl font-semibold md:text-3xl">PCR</h1>

    <!-- CELULAR -->
    <template v-if="ehCelular">
      <PcrAtiva v-if="pcr.ativa" />
      <template v-else>
        <div class="bg-card flex flex-col gap-3 rounded-2xl border p-4">
          <p class="text-muted-foreground text-sm">
            Cronômetro da parada com ciclos de 2 min, lembrete de epinefrina, metrônomo de compressões e registro do que foi feito.
            Alertas e metrônomo seguem, com a tela ligada, mesmo se você sair desta tela.
          </p>
          <Button size="touch" class="h-14 text-lg" @click="pcr.iniciar"><HeartPulse /> Iniciar PCR</Button>
        </div>

        <section v-if="encerradas.length" class="flex flex-col gap-3" aria-label="Registros salvos">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold">Registros salvos</h2>
            <Button size="sm" variant="ghost" @click="confirmarTudo = true"><Trash2 /> Excluir todos</Button>
          </div>
          <PcrHistorico :registros="encerradas" pode-excluir @excluir="pcr.excluirRegistro" />
        </section>

        <p class="text-muted-foreground text-xs">
          Só tempos e marcações são salvos, sem dados do paciente, por {{ dias }} dias neste aparelho. Depois disso são apagados sozinhos.
          Não escreva nome, registro ou outro identificador em "Outro procedimento".
        </p>
      </template>

      <DialogoConfirmar
        v-model:aberto="confirmarTudo"
        titulo="Excluir todos os registros de PCR?"
        descricao="Todos os registros salvos neste aparelho serão apagados. Isso não pode ser desfeito."
        rotulo-confirmar="Excluir todos"
        perigoso
        @confirmar="pcr.excluirTudo"
      />
    </template>

    <!-- PC -->
    <template v-else>
      <p v-if="erroPcr" class="text-critico text-sm" role="alert">{{ erroPcr }}</p>
      <p v-if="!registrosNoPc.length" class="bg-card text-muted-foreground rounded-2xl border border-dashed p-6">
        Nenhum registro recebido. Registre a parada no celular (tela PCR) com o celular conectado ao código em
        <RouterLink to="/ajustes" class="underline">Ajustes</RouterLink>{{ pc.sessao.value ? '' : ' (gerando o código…)' }}. Os registros aparecem aqui só nesta sessão.
      </p>
      <PcrHistorico v-else :registros="registrosNoPc" />
    </template>
  </section>
</template>
