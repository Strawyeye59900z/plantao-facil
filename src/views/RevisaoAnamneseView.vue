<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { extrairJson, montarPromptRevisao, validarRevisao, type RevisaoTranscricao } from '@/dominio/anamnese/revisao'

/**
 * Revisão da anamnese com o Gemini (chat). O app monta o prompt e manda o texto para o Gemini
 * pelo menu de compartilhar; a resposta é colada de volta aqui e conferida antes de aparecer.
 */
const transcricao = ref('')
const resposta = ref('')
const revisao = ref<RevisaoTranscricao | null>(null)
const aviso = ref<string | null>(null)
const erro = ref<string | null>(null)

const podeEnviar = computed(() => transcricao.value.trim().length > 0)

async function enviarParaGemini() {
  erro.value = null
  aviso.value = null
  const prompt = montarPromptRevisao(transcricao.value.trim())
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Revisão da anamnese', text: prompt })
      aviso.value = 'Escolha o Gemini na lista. Depois copie a resposta e cole abaixo.'
      return
    } catch (falha) {
      // Cancelar o menu não é erro.
      if (falha instanceof DOMException && falha.name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(prompt)
    window.open('https://gemini.google.com/app', '_blank', 'noopener')
    aviso.value = 'Texto copiado. No Gemini, cole a mensagem, envie e copie a resposta de volta aqui.'
  } catch {
    erro.value = 'Não consegui copiar o texto. Selecione a transcrição e copie manualmente.'
  }
}

function conferirResposta() {
  erro.value = null
  const json = extrairJson(resposta.value)
  if (json === null) {
    revisao.value = null
    erro.value = 'Não encontrei o JSON na resposta. Cole a resposta inteira, sem alterar.'
    return
  }
  const resultado = validarRevisao(transcricao.value.trim(), json)
  if (!resultado.ok) {
    revisao.value = null
    erro.value = resultado.motivo
    return
  }
  revisao.value = resultado.revisao
}
</script>

<template>
  <main class="mx-auto flex max-w-xl flex-col gap-4 p-4">
    <header>
      <h1 class="text-2xl font-bold">Revisar anamnese</h1>
      <p class="text-muted-foreground text-sm">
        Dite no campo abaixo (ex.: Wispr Flow). Antes de revisar, apague os nomes dos pacientes.
      </p>
    </header>

    <section aria-labelledby="titulo-texto" class="rounded-2xl border bg-card p-4">
      <h2 id="titulo-texto" class="mb-2 text-sm font-semibold">1. Transcrição</h2>
      <textarea
        v-model="transcricao"
        rows="8"
        class="border-input w-full rounded-xl border p-3 text-base"
        aria-label="Transcrição da consulta"
        placeholder="Dite ou cole a transcrição aqui"
      />
      <Button size="touch" class="mt-3" :disabled="!podeEnviar" @click="enviarParaGemini">
        Revisar no Gemini
      </Button>
      <p v-if="aviso" class="text-muted-foreground mt-2 text-sm" role="status">{{ aviso }}</p>
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
      <Button size="touch" class="mt-3" :disabled="!resposta.trim()" @click="conferirResposta">Conferir resposta</Button>
      <p v-if="erro" class="text-critico mt-2 text-sm" role="alert">{{ erro }}</p>
    </section>

    <section v-if="revisao" aria-labelledby="titulo-revisao" class="rounded-2xl border bg-card p-4">
      <h2 id="titulo-revisao" class="mb-2 text-sm font-semibold">Texto revisado</h2>
      <p class="text-muted-foreground mb-3 text-sm">
        <strong>Negrito:</strong> doses, durações e datas para conferir.
        <mark class="rounded bg-yellow-200 px-1 text-slate-900">Amarelo</mark>: trechos duvidosos.
      </p>
      <p class="whitespace-pre-wrap text-base leading-relaxed">
        <template v-for="(s, i) in revisao.segmentos" :key="i">
          <strong v-if="s.tipo === 'destaque'">{{ s.texto }}</strong>
          <mark v-else-if="s.tipo === 'duvida'" class="rounded bg-yellow-200 px-0.5 text-slate-900">{{ s.texto }}</mark>
          <span v-else>{{ s.texto }}</span>
        </template>
      </p>
      <div v-if="revisao.mudancas.length" class="mt-4">
        <h3 class="mb-1 text-sm font-semibold">Correções feitas pela IA</h3>
        <ul class="text-sm">
          <li v-for="(m, i) in revisao.mudancas" :key="i">{{ m.original }} → <strong>{{ m.corrigido }}</strong></li>
        </ul>
      </div>
    </section>
  </main>
</template>
