<script setup lang="ts">
import { computed } from 'vue'

/**
 * Tela do modo consulta no celular. Apresentacional: recebe o estado por props e emite eventos.
 * A gravação, o timer e a detecção de lembretes ficam fora deste componente.
 */
export interface LembreteConsulta {
  id: string
  label: string
  done: boolean
  via: 'fala' | 'manual' | null
}

const props = withDefaults(
  defineProps<{
    elapsedSeconds: number
    metaMinutes?: number
    paused?: boolean
    items: LembreteConsulta[]
    sessionCode?: string
  }>(),
  { metaMinutes: 25, paused: false, sessionCode: '' },
)

const emit = defineEmits<{
  'toggle-pause': []
  finish: []
  'toggle-item': [id: string]
}>()

const metaSeconds = computed(() => props.metaMinutes * 60)
const progress = computed(() => Math.min(1, props.elapsedSeconds / metaSeconds.value))
const over = computed(() => props.elapsedSeconds > metaSeconds.value)

const pad = (n: number) => String(n).padStart(2, '0')
const clock = computed(() => {
  const s = Math.max(0, Math.floor(props.elapsedSeconds))
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
})

const restante = computed(() => {
  const falta = metaSeconds.value - props.elapsedSeconds
  return over.value ? `+${Math.floor(-falta / 60)} min` : `${Math.ceil(falta / 60)} min restantes`
})

// Geometria da areia (viewBox 0 0 120 180; gargalo em y = 90)
const topoY = computed(() => 34 + progress.value * 56)
const topoH = computed(() => Math.max(0, 90 - topoY.value))
const fundoY = computed(() => 160 - progress.value * 52)
const fundoH = computed(() => 170 - fundoY.value)
const mostraFio = computed(() => !props.paused && progress.value < 1)

const pendentes = computed(() => props.items.filter((i) => !i.done))
const feitos = computed(() => props.items.filter((i) => i.done))

const vidro =
  'M25 18 C25 55 52 72 57 90 C52 108 25 125 25 162 L95 162 C95 125 68 108 63 90 C68 72 95 55 95 18 Z'
</script>

<template>
  <div class="mc" :class="{ 'mc--tarde': over }">
    <header class="mc__topo">
      <p class="mc__gravando">
        <span class="mc__ponto" :class="{ 'mc__ponto--ativo': !paused }" aria-hidden="true" />
        <span>{{ paused ? 'Pausado' : 'Gravando' }}</span>
      </p>
      <p v-if="sessionCode" class="mc__sessao">Sessão {{ sessionCode }}</p>
    </header>

    <section class="mc__tempo" aria-label="Tempo da consulta">
      <svg
        class="mc__ampulheta"
        width="112"
        height="168"
        viewBox="0 0 120 180"
        fill="none"
        role="img"
        aria-label="Ampulheta: a areia mostra o tempo da consulta em relação à meta"
      >
        <defs>
          <clipPath id="mc-vidro">
            <path :d="vidro" />
          </clipPath>
        </defs>
        <g clip-path="url(#mc-vidro)">
          <rect x="0" :y="topoY" width="120" :height="topoH" class="mc__areia" />
          <rect x="0" :y="fundoY" width="120" :height="fundoH" class="mc__areia" />
        </g>
        <line
          v-if="mostraFio"
          class="mc__fio"
          x1="60"
          y1="90"
          x2="60"
          :y2="fundoY"
          stroke-width="2"
          stroke-dasharray="3 3"
          stroke-linecap="round"
        />
        <path :d="vidro" class="mc__vidro" stroke-width="2.5" stroke-linejoin="round" />
        <path d="M14 11 H106 M14 169 H106" class="mc__tampa" stroke-width="5" stroke-linecap="round" />
      </svg>

      <p class="mc__relogio" :aria-label="`Tempo decorrido ${clock}`">{{ clock }}</p>
      <p class="mc__meta">Meta de {{ metaMinutes }} min · {{ restante }}</p>
    </section>

    <section class="mc__lembretes" aria-labelledby="mc-lembretes-titulo">
      <h2 id="mc-lembretes-titulo" class="mc__titulo">
        Perguntar ainda · {{ feitos.length }} de {{ items.length }}
      </h2>

      <div class="mc__pilulas">
        <button
          v-for="item in pendentes"
          :key="item.id"
          type="button"
          class="mc__pilula"
          @click="emit('toggle-item', item.id)"
        >
          <span class="mc__ponto-pendente" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </button>
      </div>

      <p v-if="pendentes.length === 0" class="mc__tudo-feito">
        Tudo perguntado. Pode encerrar quando quiser.
      </p>

      <div v-if="feitos.length" class="mc__feitos">
        <button
          v-for="item in feitos"
          :key="item.id"
          type="button"
          class="mc__feito"
          :aria-label="`Desfazer: ${item.label}`"
          :title="item.via === 'fala' ? 'Detectado na fala' : 'Marcado manualmente'"
          @click="emit('toggle-item', item.id)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          <span>{{ item.label }}</span>
        </button>
      </div>
    </section>

    <footer class="mc__acoes">
      <button type="button" class="mc__botao mc__botao--secundario" @click="emit('toggle-pause')">
        <span>{{ paused ? 'Retomar' : 'Pausar' }}</span>
      </button>
      <button type="button" class="mc__botao mc__botao--principal" @click="emit('finish')">
        Encerrar e organizar
      </button>
    </footer>

    <p class="mc__privacidade">
      <span>Transcrição no aparelho · o áudio não sai do celular</span>
    </p>
  </div>
</template>

<style scoped>
.mc {
  --mc-fundo: #0f1a1f;
  --mc-superficie: #16242a;
  --mc-borda: #3a4e56;
  --mc-texto: #e8eef0;
  --mc-apoio: #a9bac1;
  --mc-destaque: #5cc8b5;
  --mc-sobre-destaque: #0b1418;
  --mc-alerta: #f2b65c;
  --mc-gravando: #f26b5e;
  --mc-areia: var(--mc-destaque);

  min-height: 100dvh;
  box-sizing: border-box;
  padding: 20px 20px calc(24px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--mc-fundo);
  color: var(--mc-texto);
}
.mc--tarde {
  --mc-areia: var(--mc-alerta);
}

.mc__topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 32px;
}
.mc__gravando {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.mc__ponto {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #6b7f86;
}
.mc__ponto--ativo {
  background: var(--mc-gravando);
  animation: mc-pulsa 1.6s ease-in-out infinite;
}
.mc__sessao {
  margin: 0;
  font-size: 14px;
  color: var(--mc-apoio);
  font-variant-numeric: tabular-nums;
}

.mc__tempo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding-top: 8px;
}
.mc__areia {
  fill: var(--mc-areia);
  transition: y 1s linear, height 1s linear;
}
.mc__fio {
  stroke: var(--mc-areia);
  animation: mc-cai 0.5s linear infinite;
}
.mc__vidro {
  stroke: var(--mc-apoio);
}
.mc__tampa {
  stroke: var(--mc-texto);
}
.mc__relogio {
  margin: 4px 0 0;
  font-size: 56px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -1px;
  font-variant-numeric: tabular-nums;
}
.mc--tarde .mc__relogio {
  color: var(--mc-alerta);
}
.mc__meta {
  margin: 0;
  font-size: 15px;
  color: var(--mc-apoio);
}

.mc__lembretes {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  overflow-y: auto;
}
.mc__titulo {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.mc__pilulas {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
.mc__pilula {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--mc-borda);
  border-radius: 22px;
  background: var(--mc-superficie);
  color: var(--mc-texto);
  font: inherit;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}
.mc__ponto-pendente {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--mc-alerta);
}
.mc__tudo-feito {
  margin: 0;
  font-size: 16px;
  color: var(--mc-destaque);
}
.mc__feitos {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}
.mc__feito {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  border-radius: 22px;
  background: transparent;
  color: var(--mc-apoio);
  font: inherit;
  font-size: 14px;
  text-decoration: line-through;
  cursor: pointer;
}
.mc__feito svg {
  stroke: var(--mc-destaque);
}

.mc__acoes {
  display: flex;
  gap: 10px;
}
.mc__botao {
  min-height: 56px;
  border-radius: 16px;
  font: inherit;
  font-size: 16px;
  cursor: pointer;
}
.mc__botao--secundario {
  flex: 1 1 0;
  border: 1px solid var(--mc-borda);
  background: var(--mc-superficie);
  color: var(--mc-texto);
  font-weight: 600;
}
.mc__botao--principal {
  flex: 1.4 1 0;
  border: 0;
  background: var(--mc-destaque);
  color: var(--mc-sobre-destaque);
  font-weight: 700;
}

.mc__privacidade {
  margin: 0;
  text-align: center;
  font-size: 13px;
  color: var(--mc-apoio);
}

@keyframes mc-pulsa {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
@keyframes mc-cai {
  to {
    stroke-dashoffset: -12;
  }
}
@media (prefers-reduced-motion: reduce) {
  .mc__ponto--ativo,
  .mc__fio {
    animation: none;
  }
  .mc__areia {
    transition: none;
  }
}
</style>
