<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { cifrar, importarChave } from '@/dominio/anamnese/cifra'
import { numerosNaoEncontrados, segmentar, textoLimpo } from '@/dominio/anamnese/textoRevisado'
import { enviarResultado } from '@/lib/anamnese/sessao'

/**
 * Celular: a transcrição (ditada com o Wispr Flow) vai para o Gemini com @nova-consulta.
 * A resposta é colada aqui e, se a sessão veio do QR code do PC, é enviada cifrada.
 */
const rota = useRoute()
const sessaoId = typeof rota.query.s === 'string' ? rota.query.s : null
const chaveTexto = typeof rota.query.k === 'string' ? rota.query.k : null
const podeEnviarAoPc = Boolean(sessaoId && chaveTexto)

const transcricao = ref('')
const resposta = ref('')
const aviso = ref<string | null>(null)
const erro = ref<string | null>(null)
const enviado = ref(false)
const enviando = ref(false)

const alertasNumeros = computed(() => numerosNaoEncontrados(transcricao.value, resposta.value))

async function enviarParaGemini() {
  erro.value = null
  const texto = `@nova-consulta\n\n${transcricao.value.trim()}`
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Anamnese', text: texto })
      aviso.value = 'Escolha o Gemini. Depois copie a resposta e cole abaixo.'
      return
    } catch (falha) {
      if (falha instanceof DOMException && falha.name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(texto)
    window.open('https://gemini.google.com/app', '_blank', 'noopener')
    aviso.value = 'Texto copiado. No Gemini, cole a mensagem e copie a resposta de volta aqui.'
  } catch {
    erro.value = 'Não consegui copiar. Selecione a transcrição e copie manualmente.'
  }
}

async function enviarAoPc() {
  if (!sessaoId || !chaveTexto) return
  erro.value = null
  enviando.value = true
  try {
    const chave = await importarChave(chaveTexto)
    const envelope = await cifrar(resposta.value.trim(), chave)
    await enviarResultado(sessaoId, envelope)
    enviado.value = true
  } catch (falha) {
    erro.value = falha instanceof Error ? falha.message : String(falha)
  } finally {
    enviando.value = false
  }
}

async function copiarLimpo() {
  await navigator.clipboard.writeText(textoLimpo(resposta.value))
  aviso.value = 'Texto copiado, sem os marcadores.'
}
</script>

<template>
  <main class="mx-auto flex max-w-xl flex-col gap-4 p-4">
    <header>
      <h1 class="text-2xl font-bold">Anamnese da consulta</h1>
      <p class="text-muted-foreground text-sm">
        <template v-if="podeEnviarAoPc">Sessão do PC conectada. O texto só segue quando você enviar.</template>
        <template v-else>Sem sessão do PC: você pode copiar o texto e colar no prontuário.</template>
      </p>
    </header>

    <section aria-labelledby="titulo-transcricao" class="rounded-2xl border bg-card p-4">
      <h2 id="titulo-transcricao" class="mb-2 text-sm font-semibold">1. Transcrição</h2>
      <textarea
        v-model="transcricao"
        rows="6"
        class="border-input w-full rounded-xl border p-3 text-base"
        aria-label="Transcrição da consulta"
        placeholder="Dite com o Wispr Flow aqui"
      />
      <p class="text-muted-foreground mt-2 text-sm">Antes de enviar ao Gemini, apague os nomes dos pacientes.</p>
      <Button size="touch" class="mt-3" :disabled="!transcricao.trim()" @click="enviarParaGemini">
        Enviar ao Gemini (@nova-consulta)
      </Button>
    </section>

    <section aria-labelledby="titulo-resposta" class="rounded-2xl border bg-card p-4">
      <h2 id="titulo-resposta" class="mb-2 text-sm font-semibold">2. Resposta do Gemini</h2>
      <textarea
        v-model="resposta"
        rows="8"
        class="border-input w-full rounded-xl border p-3 text-base"
        aria-label="Resposta do Gemini"
        placeholder="Cole aqui a resposta copiada do Gemini"
      />

      <p v-if="alertasNumeros.length" class="mt-2 text-sm text-atencao-suave-foreground" role="status">
        Confira estes números, que não estavam na transcrição: {{ alertasNumeros.join(', ') }}
      </p>

      <div v-if="resposta.trim()" class="mt-4 rounded-xl bg-background p-3">
        <p class="whitespace-pre-wrap text-base leading-relaxed">
          <template v-for="(s, i) in segmentar(resposta)" :key="i">
            <strong v-if="s.tipo === 'destaque'">{{ s.texto }}</strong>
            <span v-else>{{ s.texto }}</span>
          </template>
        </p>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <Button size="touch" variant="outline" :disabled="!resposta.trim()" @click="copiarLimpo">Copiar sem marcadores</Button>
        <Button
          v-if="podeEnviarAoPc"
          size="touch"
          :disabled="!resposta.trim() || enviando || enviado"
          @click="enviarAoPc"
        >
          {{ enviado ? 'Enviado ao PC' : enviando ? 'Enviando…' : 'Enviar ao PC' }}
        </Button>
      </div>
      <p v-if="aviso" class="text-muted-foreground mt-2 text-sm" role="status">{{ aviso }}</p>
      <p v-if="erro" class="text-critico mt-2 text-sm" role="alert">{{ erro }}</p>
    </section>
  </main>
</template>
