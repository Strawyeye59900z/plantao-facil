<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { cifrar, importarChave } from '@/dominio/anamnese/cifra'
import {
  adicionarAnotacao,
  adicionarLeito,
  adicionarProblema,
  adicionarSuspeita,
  blocoVazio,
  removerProblema,
  type Bloco,
} from '@/dominio/anamnese/bloco'
import { enviarResultado } from '@/lib/anamnese/sessao'

/**
 * Celular: bloco de notas beira leito (um leito por vez, problemas com suspeitas acima das anotações)
 * e captura de consultas. Tudo fica só na memória desta página; "Enviar ao PC" manda o bloco cifrado.
 */
const rota = useRoute()
const sessaoId = typeof rota.query.s === 'string' ? rota.query.s : null
const chaveTexto = typeof rota.query.k === 'string' ? rota.query.k : null
const podeEnviar = Boolean(sessaoId && chaveTexto)

const gerarId = () => crypto.randomUUID()
const agora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const bloco = ref<Bloco>(blocoVazio())
const leitoId = ref<string | null>(null)
const novoLeito = ref('')
const novoProblema = ref('')
const suspeitaPorProblema = ref<Record<string, string>>({})
const anotacao = ref('')
const consulta = ref('')
const aviso = ref<string | null>(null)
const erro = ref<string | null>(null)
const enviando = ref(false)

const leitoAtual = computed(() => bloco.value.leitos.find((l) => l.id === leitoId.value) ?? null)

function criarLeito() {
  const antes = bloco.value.leitos.length
  bloco.value = adicionarLeito(bloco.value, novoLeito.value, gerarId)
  if (bloco.value.leitos.length > antes) {
    leitoId.value = bloco.value.leitos[bloco.value.leitos.length - 1]!.id
    novoLeito.value = ''
  }
}

function criarProblema() {
  if (!leitoAtual.value) return
  bloco.value = adicionarProblema(bloco.value, leitoAtual.value.id, novoProblema.value, gerarId)
  novoProblema.value = ''
}

function criarSuspeita(problemaId: string) {
  if (!leitoAtual.value) return
  const texto = suspeitaPorProblema.value[problemaId] ?? ''
  bloco.value = adicionarSuspeita(bloco.value, leitoAtual.value.id, problemaId, texto, gerarId)
  suspeitaPorProblema.value[problemaId] = ''
}

function apagarProblema(problemaId: string) {
  if (!leitoAtual.value) return
  bloco.value = removerProblema(bloco.value, leitoAtual.value.id, problemaId)
}

function criarAnotacao() {
  if (!leitoAtual.value) return
  bloco.value = adicionarAnotacao(bloco.value, leitoAtual.value.id, anotacao.value, agora(), gerarId)
  anotacao.value = ''
}

function criarConsulta() {
  const texto = consulta.value.trim()
  if (!texto) return
  bloco.value = { ...bloco.value, consultas: [...bloco.value.consultas, { id: gerarId(), hora: agora(), texto }] }
  consulta.value = ''
  aviso.value = 'Consulta guardada. Ela segue ao PC no próximo envio.'
}

async function enviarAoPc() {
  if (!sessaoId || !chaveTexto) return
  erro.value = null
  enviando.value = true
  try {
    const chave = await importarChave(chaveTexto)
    const envelope = await cifrar(JSON.stringify(bloco.value), chave)
    await enviarResultado(sessaoId, envelope)
    aviso.value = `Enviado ao PC às ${agora()}. Pode continuar anotando.`
  } catch (falha) {
    erro.value = falha instanceof Error ? falha.message : String(falha)
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <main class="mx-auto flex max-w-xl flex-col gap-4 p-4">
    <header>
      <h1 class="text-2xl font-bold">Bloco de notas</h1>
      <p class="text-muted-foreground text-sm">
        <template v-if="podeEnviar">Conectado ao PC. Nada é salvo: ao fechar o app, o bloco some.</template>
        <template v-else>Sem sessão do PC: abra pelo QR code do PC para poder enviar.</template>
      </p>
    </header>

    <section aria-labelledby="titulo-leito" class="rounded-2xl border bg-card p-4">
      <h2 id="titulo-leito" class="mb-2 text-sm font-semibold">Leito</h2>
      <div class="mb-3 flex flex-wrap gap-2">
        <button
          v-for="l in bloco.leitos"
          :key="l.id"
          type="button"
          class="min-h-11 rounded-full border px-4 text-sm"
          :class="l.id === leitoId ? 'border-primary bg-accent font-semibold' : 'bg-background'"
          :aria-pressed="l.id === leitoId"
          @click="leitoId = l.id"
        >
          {{ l.identificacao }}
        </button>
      </div>
      <div class="flex gap-2">
        <input
          v-model="novoLeito"
          class="border-input min-h-11 flex-1 rounded-xl border px-3 text-base"
          aria-label="Identificação do novo leito"
          placeholder="Ex.: Leito 12"
          spellcheck="false"
        />
        <Button size="touch" variant="outline" :disabled="!novoLeito.trim()" @click="criarLeito">Adicionar leito</Button>
      </div>
    </section>

    <template v-if="leitoAtual">
      <section aria-labelledby="titulo-problemas" class="rounded-2xl border bg-card p-4">
        <h2 id="titulo-problemas" class="mb-2 text-sm font-semibold">Problemas e suspeitas</h2>
        <ul class="flex flex-col gap-3">
          <li v-for="p in leitoAtual.problemas" :key="p.id" class="rounded-xl bg-background p-3">
            <div class="flex items-start justify-between gap-2">
              <p class="font-semibold">{{ p.titulo }}</p>
              <button type="button" class="min-h-11 text-sm text-critico" @click="apagarProblema(p.id)">Remover</button>
            </div>
            <ul class="mt-2 flex flex-col gap-1 pl-3 text-sm">
              <li v-for="s in p.suspeitas" :key="s.id">• {{ s.texto }}</li>
            </ul>
            <div class="mt-2 flex gap-2">
              <input
                v-model="suspeitaPorProblema[p.id]"
                class="border-input min-h-11 flex-1 rounded-xl border px-3 text-base"
                :aria-label="`Suspeita diagnóstica para ${p.titulo}`"
                placeholder="Suspeita diagnóstica"
                spellcheck="false"
              />
              <Button size="touch" variant="outline" @click="criarSuspeita(p.id)">Incluir</Button>
            </div>
          </li>
        </ul>
        <div class="mt-3 flex gap-2">
          <input
            v-model="novoProblema"
            class="border-input min-h-11 flex-1 rounded-xl border px-3 text-base"
            aria-label="Novo problema"
            placeholder="Novo problema (ex.: Dispneia)"
            spellcheck="false"
          />
          <Button size="touch" variant="outline" :disabled="!novoProblema.trim()" @click="criarProblema">Incluir</Button>
        </div>
      </section>

      <section aria-labelledby="titulo-anotacoes" class="rounded-2xl border bg-card p-4">
        <h2 id="titulo-anotacoes" class="mb-2 text-sm font-semibold">Anotações</h2>
        <ul class="mb-3 flex flex-col gap-2">
          <li v-for="a in leitoAtual.anotacoes" :key="a.id" class="rounded-xl bg-background p-3 text-sm">
            <span class="text-muted-foreground">{{ a.hora }}</span> · {{ a.texto }}
          </li>
        </ul>
        <textarea
          v-model="anotacao"
          rows="3"
          class="border-input w-full rounded-xl border p-3 text-base"
          aria-label="Nova anotação do leito"
          placeholder="Dite ou escreva a anotação"
          spellcheck="false"
        />
        <Button size="touch" class="mt-2" :disabled="!anotacao.trim()" @click="criarAnotacao">Adicionar anotação</Button>
      </section>
    </template>

    <section aria-labelledby="titulo-consulta" class="rounded-2xl border bg-card p-4">
      <h2 id="titulo-consulta" class="mb-2 text-sm font-semibold">Transcrição de consulta</h2>
      <textarea
        v-model="consulta"
        rows="4"
        class="border-input w-full rounded-xl border p-3 text-base"
        aria-label="Transcrição da consulta"
        placeholder="Dite a consulta com o Wispr Flow"
        spellcheck="false"
      />
      <Button size="touch" class="mt-2" variant="outline" :disabled="!consulta.trim()" @click="criarConsulta">
        Guardar consulta
      </Button>
      <p class="text-muted-foreground mt-2 text-sm">{{ bloco.consultas.length }} consulta(s) guardada(s).</p>
    </section>

    <div class="sticky bottom-4 flex flex-col gap-2">
      <Button size="touch" :disabled="!podeEnviar || enviando" @click="enviarAoPc">
        {{ enviando ? 'Enviando…' : 'Enviar ao PC' }}
      </Button>
      <p v-if="aviso" class="text-muted-foreground text-sm" role="status">{{ aviso }}</p>
      <p v-if="erro" class="text-critico text-sm" role="alert">{{ erro }}</p>
    </div>
  </main>
</template>
