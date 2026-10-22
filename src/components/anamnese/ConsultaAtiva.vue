<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, Mic } from '@lucide/vue'

/**
 * Tela da consulta no celular. O app não grava áudio: o texto vem do ditado do teclado (ex.: Wispr Flow)
 * ou colado no campo. As ondas reagem à entrada de texto, só como indicador de atividade.
 */
const texto = defineModel<string>({ required: true })
const emit = defineEmits<{ finalizar: []; cancelar: [] }>()

const inicio = Date.now()
const agora = ref(new Date())
const ativo = ref(false)
const confirmandoCancelar = ref(false)
let relogio: number | undefined
let pausa: number | undefined
let tela: WakeLockSentinel | null = null

const dois = (n: number) => String(n).padStart(2, '0')
const hora = computed(() => `${dois(agora.value.getHours())}:${dois(agora.value.getMinutes())}`)
const segundos = computed(() => dois(agora.value.getSeconds()))
const data = computed(() => agora.value.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }))
const duracao = computed(() => {
  const s = Math.max(0, Math.floor((agora.value.getTime() - inicio) / 1000))
  return `${dois(Math.floor(s / 3600))}:${dois(Math.floor((s % 3600) / 60))}:${dois(s % 60)}`
})

// Barras das ondas: mais altas no meio de cada lado, com atrasos diferentes.
const BARRAS = 14
const barras = Array.from({ length: BARRAS }, (_, i) => ({
  altura: Math.round(14 + 50 * Math.sin(((i + 1) / (BARRAS + 1)) * Math.PI) ** 1.5),
  atraso: `${-((i * 137) % 900) / 1000}s`,
}))

watch(texto, () => {
  ativo.value = true
  clearTimeout(pausa)
  pausa = window.setTimeout(() => (ativo.value = false), 1500)
})

// Evita perder o ditado por um refresh sem querer.
function avisarAoSair(e: BeforeUnloadEvent) {
  if (texto.value.trim()) {
    e.preventDefault()
    e.returnValue = ''
  }
}

// Mantém a tela acesa durante a consulta (se o navegador permitir).
async function manterTelaLigada() {
  try {
    tela = (await navigator.wakeLock?.request('screen')) ?? null
  } catch {
    tela = null
  }
}
function aoVoltar() {
  if (document.visibilityState === 'visible') void manterTelaLigada()
}

// No app instalado, a barra de status e a de navegação do Android usam a cor do tema. Durante a
// consulta ela fica igual ao fundo da tela, sem a faixa clara embaixo, e volta ao normal ao sair.
const COR_DA_CONSULTA = '#080d22'
const metaTema = document.querySelector('meta[name="theme-color"]')
const corAnterior = metaTema?.getAttribute('content') ?? null

onMounted(() => {
  metaTema?.setAttribute('content', COR_DA_CONSULTA)
  relogio = window.setInterval(() => (agora.value = new Date()), 1000)
  window.addEventListener('beforeunload', avisarAoSair)
  document.addEventListener('visibilitychange', aoVoltar)
  void manterTelaLigada()
})
onBeforeUnmount(() => {
  if (corAnterior) metaTema?.setAttribute('content', corAnterior)
  clearInterval(relogio)
  clearTimeout(pausa)
  window.removeEventListener('beforeunload', avisarAoSair)
  document.removeEventListener('visibilitychange', aoVoltar)
  void tela?.release().catch(() => undefined)
})

function cancelar() {
  if (texto.value.trim() && !confirmandoCancelar.value) confirmandoCancelar.value = true
  else emit('cancelar')
}
</script>

<template>
  <div class="consulta" role="dialog" aria-modal="true" aria-label="Consulta ativa">
    <header class="text-center">
      <h2 class="titulo">Consulta ativa</h2>
      <p class="estado">
        Em andamento
        <span class="pontos" aria-hidden="true"><i /><i /><i /></span>
      </p>
    </header>

    <div class="ondas" :class="{ ativo }" aria-hidden="true">
      <div class="lado">
        <span v-for="(b, i) in barras" :key="`e${i}`" class="barra" :style="{ height: `${b.altura}px`, animationDelay: b.atraso }" />
      </div>
      <div class="microfone"><Mic class="size-8" /></div>
      <div class="lado">
        <span v-for="(b, i) in [...barras].reverse()" :key="`d${i}`" class="barra" :style="{ height: `${b.altura}px`, animationDelay: b.atraso }" />
      </div>
    </div>

    <div class="area" :class="{ ativo }">
      <!-- Ondulações como pedra na água: anéis que nascem atrás do relógio, crescem e somem. -->
      <span class="ondulacao" aria-hidden="true" />
      <span class="ondulacao" aria-hidden="true" />
      <span class="ondulacao" aria-hidden="true" />
      <div class="relogio">
        <span class="hoje">Hoje</span>
        <time class="hora" :datetime="agora.toISOString()">{{ hora }}<small aria-hidden="true">:{{ segundos }}</small></time>
        <span class="data">{{ data }}</span>
      </div>
    </div>
    <p class="duracao">Duração <strong>{{ duracao }}</strong></p>

    <section class="rodape">
      <textarea
        v-model="texto"
        rows="3"
        class="campo"
        aria-label="Texto da consulta"
        placeholder="Dite ou cole a transcrição aqui"
        spellcheck="false"
      />

      <template v-if="!confirmandoCancelar">
        <button type="button" class="finalizar" :disabled="!texto.trim()" @click="emit('finalizar')">
          <Check class="size-5" /> Finalizar consulta
        </button>
        <button type="button" class="cancelar" @click="cancelar">Cancelar consulta</button>
      </template>
      <template v-else>
        <p class="aviso">Descartar o texto desta consulta?</p>
        <div class="confirmar">
          <button type="button" class="cancelar" @click="confirmandoCancelar = false">Voltar</button>
          <button type="button" class="descartar" @click="emit('cancelar')">Descartar</button>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.consulta {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  overflow: hidden;
  padding: max(1.25rem, env(safe-area-inset-top)) 1.25rem max(1rem, env(safe-area-inset-bottom));
  color: #e8eefb;
  background: radial-gradient(120% 70% at 50% 35%, #16264f 0%, #0b1330 60%, #080d22 100%);
}
.titulo {
  font-size: 1.875rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}
.estado {
  margin-top: 0.25rem;
  color: #5eead4;
  font-size: 0.95rem;
}
.pontos {
  display: inline-flex;
  gap: 0.25rem;
  margin-left: 0.35rem;
}
.pontos i {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 9999px;
  background: #5eead4;
  animation: pisca 1.2s ease-in-out infinite;
}
.pontos i:nth-child(2) { animation-delay: 0.2s; }
.pontos i:nth-child(3) { animation-delay: 0.4s; }

.ondas {
  position: relative;
  z-index: 2;
  --amp: 0.4;
  --dur: 2.4s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  width: 100%;
}
.ondas.ativo {
  --amp: 1;
  --dur: 0.8s;
}
.lado {
  display: flex;
  align-items: center;
  gap: 3px;
}
.barra {
  width: 4px;
  border-radius: 9999px;
  background: linear-gradient(to top, #5eead4, #a78bfa);
  transform: scaleY(0.3);
  animation: onda var(--dur) ease-in-out infinite;
}
.microfone {
  display: grid;
  place-items: center;
  width: 4rem;
  height: 4rem;
  border-radius: 9999px;
  color: #5eead4;
  background: #151b2e;
  box-shadow: 0 0 0 1px #2dd4bf55, 0 6px 18px #00000066;
}
.ativo .microfone {
  animation: pulso 1.2s ease-out infinite;
}

.area {
  --dur-ondulacao: 4.5s;
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
}
.area.ativo {
  --dur-ondulacao: 2.6s;
}
.ondulacao {
  position: absolute;
  width: min(15rem, 62vw);
  aspect-ratio: 1;
  border-radius: 9999px;
  border: 2px solid #5eead4;
  box-shadow: 0 0 18px #2dd4bf66, inset 0 0 18px #2dd4bf33;
  opacity: 0;
  pointer-events: none;
  animation: ondulacao var(--dur-ondulacao) cubic-bezier(0.2, 0.6, 0.35, 1) infinite;
}
.ondulacao:nth-child(2) { animation-delay: calc(var(--dur-ondulacao) / 3); }
.ondulacao:nth-child(3) { animation-delay: calc(var(--dur-ondulacao) * 2 / 3); }
.relogio {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  width: min(15rem, 62vw);
  aspect-ratio: 1;
  border-radius: 9999px;
  background: radial-gradient(circle at 35% 30%, #1a6b62, #0e3d3a 70%);
  border: 0.45rem solid #134e4a;
  box-shadow: inset 0 0 0 0.3rem #2dd4bf, 0 0 28px #2dd4bf55, 0 14px 30px #00000066;
}
.hoje { color: #5eead4; font-size: 1rem; }
.hora {
  font-variant-numeric: tabular-nums;
  font-size: clamp(2.6rem, 14vw, 3.4rem);
  font-weight: 700;
  line-height: 1;
}
.hora small { font-size: 0.45em; opacity: 0.7; }
.data { color: #99f6e4; font-size: 0.8rem; }
.duracao { position: relative; z-index: 2; color: #9fb0d0; font-size: 0.85rem; }
.duracao strong { color: #e8eefb; font-variant-numeric: tabular-nums; }

.rodape {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: 100%;
  max-width: 28rem;
}
.campo {
  width: 100%;
  resize: none;
  padding: 0.7rem 0.9rem;
  border-radius: 1rem;
  border: 1px solid #3b6f6b;
  background: #1b2030;
  color: #e8eefb;
  font-size: 1rem; /* 16px evita o zoom automático no iPhone */
  line-height: 1.4;
}
.campo::placeholder { color: #8b97b3; }
.campo:focus-visible { outline: 2px solid #5eead4; outline-offset: 2px; }
.finalizar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 3.25rem;
  border-radius: 1rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: #06231f;
  background: linear-gradient(#6ee7b7, #34d399);
  box-shadow: 0 6px 20px #34d39955;
}
.finalizar:disabled { opacity: 0.45; box-shadow: none; }
.cancelar, .descartar {
  min-height: 2.75rem;
  border-radius: 0.9rem;
  font-size: 0.95rem;
  color: #9fb0d0;
}
.confirmar { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.descartar { color: #fecaca; border: 1px solid #f8717166; }
.confirmar .cancelar { border: 1px solid #3b4a6b; }
.aviso { text-align: center; color: #e8eefb; }

@keyframes onda {
  0%, 100% { transform: scaleY(0.2); }
  50% { transform: scaleY(var(--amp)); }
}
@keyframes ondulacao {
  0% { transform: scale(1); opacity: 0.65; }
  100% { transform: scale(2.1); opacity: 0; border-width: 1px; }
}
@keyframes pisca {
  0%, 100% { opacity: 0.25; }
  50% { opacity: 1; }
}
@keyframes pulso {
  0% { box-shadow: 0 0 0 1px #2dd4bf55, 0 0 0 0 #2dd4bf66; }
  100% { box-shadow: 0 0 0 1px #2dd4bf55, 0 0 0 14px #2dd4bf00; }
}
@media (prefers-reduced-motion: reduce) {
  .barra, .pontos i, .ativo .microfone, .ondulacao { animation: none; }
  .ondulacao:nth-child(1) { opacity: 0.3; transform: scale(1.25); }
  .ondulacao:nth-child(2) { opacity: 0.18; transform: scale(1.5); }
  .ondulacao:nth-child(3) { opacity: 0.1; transform: scale(1.75); }
  .barra { transform: scaleY(0.5); }
}
</style>
