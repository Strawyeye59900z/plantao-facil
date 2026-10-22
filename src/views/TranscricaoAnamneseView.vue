<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ClipboardPaste, Copy, Sparkles, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { adicionarConsulta } from '@/dominio/anamnese/bloco'
import { montarMensagemGemini } from '@/dominio/anamnese/mensagemGemini'
import { destacar, numerosNaoEncontrados, textoLimpo } from '@/dominio/anamnese/textoRevisado'
import { separarProntuario } from '@/dominio/anamnese/separarProntuario'
import { celular, evolucoes, pc } from '@/lib/anamnese/estado'

/**
 * Transcrição de consulta. No celular: colar o texto ditado e guardar (vai para o PC sozinho).
 * No PC: o prontuário ocupa a tela, editável e com destaque do que precisa de conferência; a resposta
 * do Gemini é colada num painel flutuante. O texto da transcrição não aparece na tela do PC.
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
const consultas = computed(() => pc.bloco.value?.consultas ?? [])
const consultaId = ref<string | null>(null)
const consulta = computed(() => consultas.value.find((c) => c.id === consultaId.value) ?? null)
const evolucao = computed(() => (consultaId.value ? (evolucoes[consultaId.value] ?? null) : null))
const trechos = computed(() => destacar(evolucao.value?.prontuario ?? ''))
const painelAberto = ref(true)
const copiado = ref(false)
const aviso = ref<string | null>(null)

function selecionarConsulta(id: string) {
  consultaId.value = id
  evolucoes[id] ??= { resposta: '', prontuario: '', fora: '', alertaNumeros: [] }
  painelAberto.value = !evolucoes[id].prontuario
  aviso.value = null
}

// A primeira consulta recebida já abre sozinha.
watch(
  consultas,
  (lista) => {
    if (!lista.length) consultaId.value = null
    else if (!lista.some((c) => c.id === consultaId.value)) selecionarConsulta(lista[0]!.id)
  },
  { immediate: true },
)

/** Copia a consulta com @nova-consulta e abre o Gemini. O texto não é mostrado na tela. */
async function enviarParaGemini() {
  if (!consulta.value) return
  await navigator.clipboard.writeText(montarMensagemGemini(consulta.value.texto))
  window.open('https://gemini.google.com/app', '_blank', 'noopener')
  aviso.value = 'Mensagem copiada. Cole no Gemini, envie e copie a resposta de volta aqui.'
}

/** Joga a resposta do Gemini no documento (sem os marcadores) e fecha o painel. */
function aplicarResposta() {
  if (!consulta.value || !evolucao.value) return
  const partes = separarProntuario(textoLimpo(evolucao.value.resposta))
  evolucao.value.prontuario = partes.prontuario
  evolucao.value.fora = partes.fora
  evolucao.value.alertaNumeros = numerosNaoEncontrados(consulta.value.texto, evolucao.value.resposta)
  painelAberto.value = false
  aviso.value = null
}

async function copiarProntuario() {
  if (!evolucao.value?.prontuario) return
  await navigator.clipboard.writeText(evolucao.value.prontuario)
  copiado.value = true
  setTimeout(() => (copiado.value = false), 2000)
}
</script>

<template>
  <main class="mx-auto flex max-w-5xl flex-col gap-4 p-4">
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

      <p v-if="!consultas.length" class="rounded-2xl border border-dashed bg-card p-6 text-muted-foreground">
        Nenhuma consulta recebida. Guarde uma consulta no celular (aba Transcrição) e ela aparece aqui.
        O código de sincronização fica em <RouterLink to="/ajustes" class="underline">Ajustes</RouterLink>.
      </p>

      <template v-else>
        <!-- Consultas como abas, e ações do documento -->
        <div class="flex flex-wrap items-center justify-between gap-2">
          <nav class="flex flex-wrap gap-2" aria-label="Consultas recebidas">
            <button
              v-for="c in consultas"
              :key="c.id"
              type="button"
              class="min-h-10 rounded-full border px-4 text-sm"
              :class="c.id === consultaId ? 'border-primary bg-accent font-semibold' : 'bg-card hover:bg-accent/60'"
              :aria-pressed="c.id === consultaId"
              @click="selecionarConsulta(c.id)"
            >
              Consulta {{ c.hora }}
              <span v-if="evolucoes[c.id]?.prontuario" class="bg-primary ml-1.5 inline-block size-2 rounded-full" title="Prontuário pronto" />
            </button>
          </nav>
          <div class="flex gap-2">
            <Button size="touch" variant="outline" @click="painelAberto = true"><ClipboardPaste /> Colar resposta do Gemini</Button>
            <Button size="touch" :disabled="!evolucao?.prontuario" @click="copiarProntuario"><Copy /> {{ copiado ? 'Copiado' : 'Copiar' }}</Button>
          </div>
        </div>

        <p v-if="evolucao?.alertaNumeros.length" class="text-atencao-suave-foreground bg-atencao-suave rounded-xl px-3 py-2 text-sm" role="status">
          Confira estes números, que não estavam na transcrição: {{ evolucao.alertaNumeros.join(', ') }}
        </p>
        <p v-if="evolucao?.prontuario" class="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span><mark class="bg-critico-suave text-critico-suave-foreground rounded px-1">incompreensível</mark> conferir</span>
          <span><mark class="bg-atencao-suave text-atencao-suave-foreground rounded px-1">datas, doses e durações</mark> conferir</span>
        </p>

        <!-- Documento: editável; o destaque é desenhado por trás e acompanha o que você digita. -->
        <section v-if="evolucao" aria-label="Prontuário" class="bg-card relative min-h-[65vh] rounded-2xl border">
          <div
            class="pointer-events-none min-h-[65vh] rounded-2xl border border-transparent p-6 text-base leading-relaxed break-words whitespace-pre-wrap"
            aria-hidden="true"
          ><template v-for="(t, i) in trechos" :key="i"><mark
                v-if="t.tipo !== 'texto'"
                class="rounded-sm"
                :class="t.tipo === 'incompreensivel' ? 'bg-critico-suave text-critico-suave-foreground' : 'bg-atencao-suave text-atencao-suave-foreground'"
              >{{ t.texto }}</mark><template v-else>{{ t.texto }}</template></template>{{ '\n' }}</div>
          <textarea
            v-model="evolucao.prontuario"
            spellcheck="false"
            placeholder="O prontuário da consulta aparece aqui. Clique em “Colar resposta do Gemini”."
            class="caret-foreground placeholder:text-muted-foreground absolute inset-0 size-full resize-none overflow-hidden rounded-2xl border border-transparent bg-transparent p-6 text-base leading-relaxed text-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Prontuário editável"
          />
        </section>

        <section v-if="evolucao?.fora" class="rounded-2xl border border-dashed p-4">
          <h2 class="mb-2 text-sm font-semibold">Fora do prontuário (não copiar)</h2>
          <p class="text-muted-foreground whitespace-pre-wrap text-sm">{{ evolucao.fora }}</p>
        </section>

        <!-- Painel flutuante: copiar para o Gemini e colar a resposta -->
        <aside
          v-if="painelAberto && evolucao && consulta"
          class="bg-background fixed right-4 bottom-4 z-40 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 rounded-2xl border p-4 shadow-xl"
          aria-label="Painel do Gemini"
          @keydown.esc="painelAberto = false"
        >
          <header class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold">Consulta {{ consulta.hora }} · Gemini</h2>
            <Button size="icon-sm" variant="ghost" aria-label="Fechar painel" @click="painelAberto = false"><X /></Button>
          </header>

          <div>
            <Button size="touch" variant="outline" class="w-full" @click="enviarParaGemini"><Sparkles /> Copiar para o Gemini</Button>
            <p v-if="aviso" class="text-muted-foreground mt-2 text-xs" role="status">{{ aviso }}</p>
          </div>

          <textarea
            v-model="evolucao.resposta"
            rows="7"
            spellcheck="false"
            class="border-input w-full rounded-xl border p-3 text-sm"
            aria-label="Resposta do Gemini"
            placeholder="Cole aqui a resposta copiada do Gemini"
          />
          <Button size="touch" :disabled="!evolucao.resposta.trim()" @click="aplicarResposta">Aplicar ao prontuário</Button>
        </aside>
      </template>
    </template>
  </main>
</template>
