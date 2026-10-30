<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Pill, Stethoscope, Undo2, Volume2, VolumeX, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import DialogoConfirmar from '@/components/comum/DialogoConfirmar.vue'
import { AVISO_ANTES_MS, BPM_METRONOMO, descreverEvento, doseDaProxima, formatarTempo, periodoPiscaMs, type Medicacao } from '@/dominio/pcr/pcr'
import { usePcrStore } from '@/stores/pcr'

/**
 * Parada em andamento, sem poluição: no centro só o cronômetro; em cima, os contadores de choques,
 * epinefrina e amiodarona; embaixo, "Drogas" e "Procedimentos". O choque só aparece no início da parada
 * e quando vence a checagem de ritmo.
 */
const pcr = usePcrStore()

const estado = computed(() => pcr.estado!)
const contagens = computed(() => pcr.contagens!)
const registro = computed(() => pcr.ativa!)

const perguntando = ref(false)
/** Ritmo inicial (ainda sem nenhuma checagem), checagem vencida ou pedida pelo médico. */
const mostrarChoque = computed(() => contagens.value.checagens === 0 || estado.value.checagemPendente || perguntando.value)
const checagemVencida = computed(() => estado.value.checagemPendente)
/** Últimos 15 s antes da checagem de ritmo: a tela pisca em outra cor. */
const checagemProxima = computed(
  () => !estado.value.checagemPendente && estado.value.cicloRestanteMs > 0 && estado.value.cicloRestanteMs <= AVISO_ANTES_MS,
)
/** Só na fase de aviso: a piscada acelera a cada segundo. */
const estiloPisca = computed(() => (checagemProxima.value ? { animationDuration: `${periodoPiscaMs(estado.value.cicloRestanteMs)}ms` } : undefined))
const fundo = computed(() =>
  checagemVencida.value ? 'bg-critico text-critico-foreground' : checagemProxima.value ? 'pcr-pisca' : 'bg-background text-foreground',
)

const painel = ref<'drogas' | 'procedimentos' | null>(null)
const encerrando = ref(false)
const escrevendoOutro = ref(false)
const textoOutro = ref('')

function responder(chocavel: boolean) {
  pcr.responderChecagem(chocavel)
  perguntando.value = false
}

function fechar() {
  painel.value = null
  escrevendoOutro.value = false
}

function dar(tipo: Medicacao) {
  pcr.marcar(tipo)
  fechar()
}

function darViaAerea() {
  pcr.marcar('via_aerea')
  fechar()
}

function marcarOutro() {
  if (!textoOutro.value.trim()) return
  pcr.marcar('outro', textoOutro.value)
  textoOutro.value = ''
  fechar()
}

function checarAgora() {
  perguntando.value = true
  fechar()
}

const medicacoes: { tipo: Medicacao; rotulo: string }[] = [
  { tipo: 'epinefrina', rotulo: 'Epinefrina' },
  { tipo: 'amiodarona', rotulo: 'Amiodarona' },
  { tipo: 'lidocaina', rotulo: 'Lidocaína' },
]

const subtitulo = (tipo: Medicacao) => {
  const dadas = contagens.value[tipo]
  return doseDaProxima(tipo, dadas) ?? `${dadas + 1}ª dose`
}

const ultimo = computed(() => {
  const e = registro.value.eventos.at(-1)
  return e ? descreverEvento(registro.value, e) : null
})

const epiAlerta = computed(() => estado.value.epinefrina === 'repetir' || estado.value.epinefrina === 'atrasada')
const textoEpi = computed(() =>
  estado.value.epinefrina === 'atrasada' ? 'Epinefrina: passou de 5 min' : 'Epinefrina: pode repetir (3–5 min)',
)
</script>

<template>
  <!-- Tela cheia: cobre o topo do app e muda de cor na checagem de ritmo -->
  <div
    class="fixed inset-0 z-40 flex flex-col gap-4 overflow-y-auto p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] transition-colors"
    :class="fundo"
    :style="estiloPisca"
  >
    <!-- Contadores no alto -->
    <div class="flex items-stretch gap-2">
      <ul class="grid flex-1 grid-cols-3 gap-2 text-center" aria-label="Contagens">
        <li class="bg-card text-card-foreground rounded-2xl border p-2">
          <p class="text-3xl leading-none font-bold">{{ contagens.choques }}</p>
          <p class="text-muted-foreground mt-1 text-xs">Choques</p>
        </li>
        <li class="rounded-2xl border p-2" :class="epiAlerta ? 'bg-atencao-suave text-atencao-suave-foreground animate-pulse' : 'bg-card text-card-foreground'">
          <p class="text-3xl leading-none font-bold">{{ contagens.epinefrina }}</p>
          <p class="mt-1 text-xs" :class="!epiAlerta && 'text-muted-foreground'">Epinefrina</p>
        </li>
        <li class="bg-card text-card-foreground rounded-2xl border p-2">
          <p class="text-3xl leading-none font-bold">{{ contagens.amiodarona }}</p>
          <p class="text-muted-foreground mt-1 text-xs">Amiodarona</p>
        </li>
      </ul>
      <Button
        size="icon-touch"
        class="h-auto w-12 rounded-2xl"
        :variant="pcr.metronomo ? 'default' : 'outline'"
        :aria-pressed="pcr.metronomo"
        :aria-label="`Metrônomo ${BPM_METRONOMO} por minuto`"
        @click="pcr.alternarMetronomo"
      >
        <component :is="pcr.metronomo ? Volume2 : VolumeX" />
      </Button>
    </div>

    <Button v-if="!pcr.somLiberado" size="touch" variant="outline" class="bg-card text-foreground" @click="pcr.liberarSom">
      <Volume2 /> Toque para ativar o som e os alertas
    </Button>

    <!-- Centro: o cronômetro -->
    <div class="flex flex-1 flex-col items-center justify-center gap-5">
      <p class="text-8xl font-bold tracking-tight tabular-nums" aria-label="Tempo total da parada">{{ formatarTempo(estado.totalMs) }}</p>

      <p v-if="epiAlerta && !mostrarChoque" class="bg-atencao-suave text-atencao-suave-foreground animate-pulse rounded-full px-4 py-2 text-sm font-semibold" role="status">
        {{ textoEpi }}
      </p>

      <!-- Choque: só no início, na checagem de ritmo vencida ou pedida -->
      <div v-if="mostrarChoque" class="w-full max-w-sm" role="status">
        <p class="mb-2 text-center text-base font-semibold">
          {{ checagemVencida ? 'Checar o ritmo. Houve choque?' : contagens.checagens === 0 ? 'Ritmo inicial: houve choque?' : 'Houve choque?' }}
        </p>
        <div class="grid grid-cols-2 gap-2">
          <Button size="touch" class="h-14 text-base" @click="responder(true)">Choque</Button>
          <Button size="touch" variant="outline" class="bg-card text-foreground h-14 text-base" @click="responder(false)">Sem choque</Button>
        </div>
      </div>
    </div>

    <!-- Embaixo -->
    <div class="grid grid-cols-2 gap-3">
      <Button size="touch" variant="outline" class="bg-card text-foreground h-16 text-base" @click="painel = 'drogas'"><Pill /> Drogas</Button>
      <Button size="touch" variant="outline" class="bg-card text-foreground h-16 text-base" @click="painel = 'procedimentos'"><Stethoscope /> Procedimentos</Button>
    </div>
    <Button size="sm" variant="ghost" class="self-center opacity-70" @click="encerrando = true"><X /> Encerrar PCR</Button>

    <!-- Painel de baixo: drogas ou procedimentos -->
    <div v-if="painel" class="fixed inset-0 z-50" @keydown.esc="fechar">
      <div class="absolute inset-0 bg-black/40" aria-hidden="true" @click="fechar" />
      <div
        class="bg-background absolute inset-x-0 bottom-0 mx-auto flex max-w-3xl flex-col gap-3 rounded-t-3xl border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl"
        role="dialog"
        :aria-label="painel === 'drogas' ? 'Drogas' : 'Procedimentos'"
      >
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold">{{ painel === 'drogas' ? 'Drogas' : 'Procedimentos' }}</h2>
          <Button size="icon-touch" variant="ghost" aria-label="Fechar" @click="fechar"><X /></Button>
        </div>

        <template v-if="painel === 'drogas'">
          <Button
            v-for="m in medicacoes"
            :key="m.tipo"
            size="touch"
            variant="outline"
            class="bg-card h-auto justify-between py-3 text-base"
            @click="dar(m.tipo)"
          >
            <span>{{ m.rotulo }} <span class="text-muted-foreground text-sm font-normal">· {{ contagens[m.tipo] }} dada(s)</span></span>
            <span class="font-normal">{{ subtitulo(m.tipo) }}</span>
          </Button>
        </template>

        <template v-else>
          <Button
            size="touch"
            variant="outline"
            class="bg-card h-14 justify-between text-base"
            :disabled="contagens.viaAerea > 0"
            @click="darViaAerea"
          >
            <span>Via aérea avançada</span>
            <span class="text-muted-foreground text-sm font-normal">{{ contagens.viaAerea ? 'já realizada' : 'marcar como feita' }}</span>
          </Button>
          <Button size="touch" variant="outline" class="bg-card h-14 text-base" @click="escrevendoOutro = !escrevendoOutro">Outro procedimento</Button>
          <form v-if="escrevendoOutro" class="flex gap-2" @submit.prevent="marcarOutro">
            <input
              v-model="textoOutro"
              class="border-input min-h-11 flex-1 rounded-xl border px-3 text-base"
              aria-label="O que foi feito"
              placeholder="O que foi feito (sem dados do paciente)"
              maxlength="200"
              autocomplete="off"
            />
            <Button size="touch" type="submit" :disabled="!textoOutro.trim()"><Check /> Registrar</Button>
          </form>
          <Button size="touch" variant="ghost" class="justify-start" @click="checarAgora">Checar o ritmo agora</Button>
        </template>

        <div class="text-muted-foreground flex items-center justify-between gap-2 border-t pt-3 text-sm">
          <span class="truncate">{{ ultimo ? `Último: ${ultimo}` : 'Nenhuma marcação ainda.' }}</span>
          <Button size="sm" variant="ghost" :disabled="!registro.eventos.length" @click="pcr.desfazer"><Undo2 /> Desfazer</Button>
        </div>
      </div>
    </div>

    <DialogoConfirmar
      v-model:aberto="encerrando"
      titulo="Encerrar a PCR?"
      descricao="O registro fica salvo neste aparelho por 2 dias e os alertas são desligados."
      rotulo-confirmar="Encerrar"
      perigoso
      @confirmar="pcr.encerrarParada"
    />
  </div>
</template>

<style scoped>
/* Aviso de checagem próxima: alterna entre o amarelo de atenção e o fundo normal. */
.pcr-pisca {
  color: var(--atencao-foreground);
  animation: pcr-pisca 1s steps(1, end) infinite;
}
@keyframes pcr-pisca {
  0%,
  100% {
    background-color: var(--atencao);
  }
  50% {
    background-color: var(--background);
    color: var(--foreground);
  }
}
@media (prefers-reduced-motion: reduce) {
  .pcr-pisca {
    animation: none;
    background-color: var(--atencao);
  }
}
</style>
