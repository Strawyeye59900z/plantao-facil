<script setup lang="ts">
import { computed, ref } from 'vue'
import { X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { adicionarConsulta } from '@/dominio/anamnese/bloco'
import { numerosNaoEncontrados, textoLimpo } from '@/dominio/anamnese/textoRevisado'
import { separarProntuario } from '@/dominio/anamnese/separarProntuario'
import { celular, evolucoes, pc } from '@/lib/anamnese/estado'

/**
 * Transcrição de consulta. No celular: colar o texto ditado e guardar (vai para o PC sozinho).
 * No PC: só a lista de consultas, o botão para o Gemini e o resultado em tela cheia. O texto da
 * transcrição não aparece na tela do PC. A revisão de cada consulta fica guardada em memória.
 */
const ehCelular = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
const gerarId = () => crypto.randomUUID()
const agora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

// ----- celular -----
const texto = ref('')
const guardada = ref<string | null>(null)

function guardarConsulta() {
  const antes = celular.bloco.value.consultas.length
  celular.bloco.value = adicionarConsulta(celular.bloco.value, texto.value, agora(), gerarId)
  if (celular.bloco.value.consultas.length > antes) {
    guardada.value = `Consulta guardada às ${agora()}.`
    texto.value = ''
  }
}

// ----- PC -----
const consultaId = ref<string | null>(null)
const consulta = computed(() => pc.bloco.value?.consultas.find((c) => c.id === consultaId.value) ?? null)
const evolucao = computed(() => (consultaId.value ? (evolucoes[consultaId.value] ?? null) : null))
const modalAberto = ref(false)
const copiado = ref(false)
const aviso = ref<string | null>(null)

function selecionarConsulta(id: string) {
  consultaId.value = id
  evolucoes[id] ??= { resposta: '', prontuario: '', fora: '', alertaNumeros: [] }
  modalAberto.value = false
  aviso.value = null
}

/** Copia a consulta com @nova-consulta e abre o Gemini. O texto não é mostrado na tela. */
async function enviarParaGemini() {
  if (!consulta.value) return
  await navigator.clipboard.writeText(`@nova-consulta\n\n${consulta.value.texto}`)
  window.open('https://gemini.google.com/app', '_blank', 'noopener')
  aviso.value = 'Mensagem copiada. Cole no Gemini, envie e copie a resposta de volta aqui.'
}

function conferirResposta() {
  if (!consulta.value || !evolucao.value) return
  const partes = separarProntuario(textoLimpo(evolucao.value.resposta))
  evolucao.value.prontuario = partes.prontuario
  evolucao.value.fora = partes.fora
  evolucao.value.alertaNumeros = numerosNaoEncontrados(consulta.value.texto, evolucao.value.resposta)
  modalAberto.value = true
}

async function copiarProntuario() {
  if (!evolucao.value) return
  await navigator.clipboard.writeText(evolucao.value.prontuario)
  copiado.value = true
  setTimeout(() => (copiado.value = false), 2000)
}
</script>

<template>
  <main class="mx-auto flex max-w-4xl flex-col gap-4 p-4">
    <header>
      <h1 class="text-2xl font-bold">Transcrição</h1>
    </header>

    <!-- CELULAR -->
    <template v-if="ehCelular">
      <p v-if="!celular.conectado.value" class="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
        Para enviar ao PC, digite o código do PC em <RouterLink to="/ajustes" class="underline">Ajustes</RouterLink>.
      </p>

      <section aria-labelledby="titulo-consulta" class="rounded-2xl border bg-card p-4">
        <h2 id="titulo-consulta" class="mb-2 text-sm font-semibold">Texto da consulta</h2>
        <textarea
          v-model="texto"
          rows="10"
          class="border-input w-full rounded-xl border p-3 text-base"
          aria-label="Texto da consulta"
          placeholder="Cole aqui a transcrição da consulta"
          spellcheck="false"
        />
        <Button size="touch" class="mt-2" :disabled="!texto.trim()" @click="guardarConsulta">Guardar consulta</Button>
        <p v-if="guardada" class="text-muted-foreground mt-2 text-sm" role="status">{{ guardada }}</p>
        <p v-if="celular.erro.value" class="text-critico mt-2 text-sm" role="alert">{{ celular.erro.value }}</p>
      </section>
    </template>

    <!-- PC -->
    <template v-else>
      <p v-if="pc.erro.value" class="text-critico text-sm" role="alert">{{ pc.erro.value }}</p>

      <div class="grid gap-4 md:grid-cols-[14rem_1fr]">
        <aside aria-label="Consultas recebidas" class="flex flex-col gap-2">
          <h2 class="px-1 text-sm font-semibold">Consultas</h2>
          <p v-if="!pc.bloco.value?.consultas.length" class="text-muted-foreground px-1 text-sm">Nenhuma consulta recebida.</p>
          <button
            v-for="c in pc.bloco.value?.consultas ?? []"
            :key="c.id"
            type="button"
            class="min-h-11 rounded-xl border px-3 py-2 text-left text-sm"
            :class="c.id === consultaId ? 'border-primary bg-accent font-semibold' : 'bg-card'"
            :aria-pressed="c.id === consultaId"
            @click="selecionarConsulta(c.id)"
          >
            Consulta às {{ c.hora }}
            <span v-if="evolucoes[c.id]?.prontuario" class="text-muted-foreground block text-xs font-normal">Prontuário pronto</span>
          </button>
        </aside>

        <section v-if="consulta && evolucao" aria-labelledby="titulo-revisao" class="flex flex-col gap-4">
          <h2 id="titulo-revisao" class="text-xl font-bold">Consulta às {{ consulta.hora }}</h2>
          <div>
            <Button size="touch" @click="enviarParaGemini">Copiar para o Gemini (@nova-consulta)</Button>
            <p v-if="aviso" class="text-muted-foreground mt-2 text-sm" role="status">{{ aviso }}</p>
          </div>

          <section class="rounded-2xl border bg-card p-4">
            <h3 class="mb-2 text-sm font-semibold">Resposta do Gemini</h3>
            <textarea
              v-model="evolucao.resposta"
              rows="6"
              spellcheck="false"
              class="border-input w-full rounded-xl border p-3 text-base"
              aria-label="Resposta do Gemini"
              placeholder="Cole aqui a resposta copiada do Gemini"
            />
            <div class="mt-2 flex flex-wrap gap-2">
              <Button size="touch" :disabled="!evolucao.resposta.trim()" @click="conferirResposta">Conferir e abrir resultado</Button>
              <Button v-if="evolucao.prontuario" size="touch" variant="outline" @click="modalAberto = true">Abrir resultado</Button>
            </div>
          </section>
        </section>

        <section v-else class="rounded-2xl border border-dashed bg-card p-6 text-muted-foreground">
          Escolha uma consulta na lista ao lado.
        </section>
      </div>

      <!-- Resultado em tela cheia: editável e pronto para copiar -->
      <div
        v-if="modalAberto && evolucao && consulta"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="modalAberto = false"
        @keydown.esc="modalAberto = false"
      >
      <div
        class="bg-background flex max-h-[85vh] w-full max-w-3xl flex-col gap-3 overflow-y-auto rounded-2xl border p-4 shadow-xl md:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Resultado da consulta"
      >
        <header class="flex items-center justify-between gap-2">
          <h2 class="text-xl font-bold">Consulta às {{ consulta.hora }}</h2>
          <Button size="icon-touch" variant="ghost" aria-label="Fechar" @click="modalAberto = false"><X /></Button>
        </header>

        <p v-if="evolucao.alertaNumeros.length" class="text-atencao-suave-foreground text-sm" role="status">
          Confira estes números, que não estavam na transcrição: {{ evolucao.alertaNumeros.join(', ') }}
        </p>

        <textarea
          v-model="evolucao.prontuario"
          spellcheck="false"
          class="border-input min-h-[40vh] w-full flex-1 rounded-xl border p-4 text-base leading-relaxed"
          aria-label="Prontuário editável"
        />

        <section v-if="evolucao.fora" class="rounded-2xl border border-dashed p-4">
          <h3 class="mb-2 text-sm font-semibold">Fora do prontuário (não copiar)</h3>
          <p class="text-muted-foreground whitespace-pre-wrap text-sm">{{ evolucao.fora }}</p>
        </section>

        <div class="flex flex-wrap gap-2">
          <Button size="touch" @click="copiarProntuario">{{ copiado ? 'Copiado' : 'Copiar prontuário' }}</Button>
          <Button size="touch" variant="outline" @click="modalAberto = false">Fechar</Button>
        </div>
      </div>
      </div>
    </template>
  </main>
</template>
