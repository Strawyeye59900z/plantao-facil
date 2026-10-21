<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button'
import { decifrar, exportarChave, gerarChave } from '@/dominio/anamnese/cifra'
import { lerBloco, type Bloco } from '@/dominio/anamnese/bloco'
import { numerosNaoEncontrados, textoLimpo } from '@/dominio/anamnese/textoRevisado'
import { separarProntuario } from '@/dominio/anamnese/separarProntuario'
import { buscarResultado, criarSessao, encerrarSessao } from '@/lib/anamnese/sessao'

/**
 * PC: cria a sessão (QR code com a chave no fragmento) e recebe o bloco do celular.
 * Tudo fica só na memória desta página; ao fechar, some.
 */
const qr = ref<string | null>(null)
const bloco = ref<Bloco | null>(null)
const leitoId = ref<string | null>(null)
const consultaId = ref<string | null>(null)
const status = ref('Gerando QR code…')
const erro = ref<string | null>(null)
const copiado = ref('')

// Evolução de uma consulta: texto do Gemini colado e prontuário separado.
const respostaGemini = ref('')
const prontuario = ref('')
const fora = ref('')
const alertaNumeros = ref<string[]>([])

let sessaoId: string | null = null
let relogio: number | undefined
let ultimaVersao = 0
let chaveAtual: CryptoKey | null = null

const leito = computed(() => bloco.value?.leitos.find((l) => l.id === leitoId.value) ?? null)
const consulta = computed(() => bloco.value?.consultas.find((c) => c.id === consultaId.value) ?? null)

async function iniciarSessao() {
  clearInterval(relogio)
  erro.value = null
  ultimaVersao = 0
  status.value = 'Gerando QR code…'
  try {
    const chave = await gerarChave()
    chaveAtual = chave
    const chaveTexto = await exportarChave(chave)
    const sessao = await criarSessao()
    sessaoId = sessao.id
    const endereco = `${location.origin}/#/anamnese/consulta?s=${sessao.id}&k=${chaveTexto}`
    qr.value = await QRCode.toDataURL(endereco, { width: 220, margin: 2 })
    status.value = 'Aguardando o celular. Leia o QR code com o celular.'
    relogio = window.setInterval(verificar, 3000)
  } catch (falha) {
    erro.value = falha instanceof Error ? falha.message : String(falha)
  }
}

/** Consulta o celular a cada 3 s; a cada envio, o bloco inteiro é atualizado na tela. */
async function verificar() {
  if (!sessaoId || !chaveAtual) return
  try {
    const envelope = await buscarResultado(sessaoId, ultimaVersao)
    if (!envelope) return
    const claro = await decifrar(envelope, chaveAtual)
    const novo = claro === null ? null : lerBloco(JSON.parse(claro))
    if (!novo) {
      erro.value = 'Não consegui ler o bloco recebido. Envie de novo pelo celular.'
      return
    }
    ultimaVersao = envelope.versao
    erro.value = null
    bloco.value = novo
    status.value = `Bloco atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`
  } catch (falha) {
    erro.value = falha instanceof Error ? falha.message : String(falha)
  }
}

function selecionarLeito(id: string) {
  leitoId.value = id
  consultaId.value = null
}

function selecionarConsulta(id: string) {
  consultaId.value = id
  leitoId.value = null
  respostaGemini.value = ''
  prontuario.value = ''
  fora.value = ''
  alertaNumeros.value = []
}

/** Copia o texto da consulta com @nova-consulta e abre o Gemini no PC. */
async function enviarParaGemini() {
  if (!consulta.value) return
  await navigator.clipboard.writeText(`@nova-consulta\n\n${consulta.value.texto}`)
  window.open('https://gemini.google.com/app', '_blank', 'noopener')
  status.value = 'Texto copiado. No Gemini, cole a mensagem, envie e copie a resposta de volta aqui.'
}

function conferirResposta() {
  if (!consulta.value) return
  const partes = separarProntuario(textoLimpo(respostaGemini.value))
  prontuario.value = partes.prontuario
  fora.value = partes.fora
  alertaNumeros.value = numerosNaoEncontrados(consulta.value.texto, respostaGemini.value)
}

async function copiar(texto: string, chave: string) {
  await navigator.clipboard.writeText(texto)
  copiado.value = chave
  setTimeout(() => (copiado.value = ''), 2000)
}

function textoDoLeito(): string {
  if (!leito.value) return ''
  const problemas = leito.value.problemas
    .map((p) => [p.titulo, ...p.suspeitas.map((s) => `  - ${s.texto}`)].join('\n'))
    .join('\n')
  const anotacoes = leito.value.anotacoes.map((a) => `${a.hora} ${a.texto}`).join('\n')
  return `${leito.value.identificacao}\n\nPROBLEMAS\n${problemas || 'Nenhum'}\n\nANOTAÇÕES\n${anotacoes || 'Nenhuma'}`
}

async function encerrar() {
  clearInterval(relogio)
  if (sessaoId) await encerrarSessao(sessaoId)
  bloco.value = null
  await iniciarSessao()
}

onMounted(iniciarSessao)
onBeforeUnmount(() => clearInterval(relogio))
</script>

<template>
  <main class="mx-auto flex max-w-6xl flex-col gap-4 p-4">
    <header class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 class="text-2xl font-bold">Bloco de notas do PC</h1>
        <p class="text-muted-foreground text-sm">{{ status }}</p>
      </div>
      <Button size="touch" variant="outline" @click="encerrar">Encerrar sessão e gerar novo QR</Button>
    </header>

    <p v-if="erro" class="text-critico text-sm" role="alert">{{ erro }}</p>

    <div class="grid gap-4 md:grid-cols-[16rem_1fr]">
      <aside class="flex flex-col gap-3" aria-label="Leitos e consultas recebidos">
        <section class="flex flex-col items-center gap-2 rounded-2xl border bg-card p-3">
          <img v-if="qr && !bloco" :src="qr" alt="QR code para abrir no celular" class="size-40" />
          <p v-else class="text-muted-foreground text-xs">Conectado. Sincronize pelo celular quando quiser.</p>
        </section>

        <h2 class="px-1 text-sm font-semibold">Leitos</h2>
        <p v-if="!bloco?.leitos.length" class="text-muted-foreground px-1 text-sm">Nenhum leito recebido.</p>
        <ul class="flex flex-col gap-2">
          <li v-for="l in bloco?.leitos ?? []" :key="l.id">
            <button
              type="button"
              class="min-h-11 w-full rounded-xl border px-3 py-2 text-left text-sm"
              :class="l.id === leitoId ? 'border-primary bg-accent font-semibold' : 'bg-card'"
              :aria-pressed="l.id === leitoId"
              @click="selecionarLeito(l.id)"
            >
              {{ l.identificacao }}
            </button>
          </li>
        </ul>

        <h2 class="px-1 pt-2 text-sm font-semibold">Consultas</h2>
        <p v-if="!bloco?.consultas.length" class="text-muted-foreground px-1 text-sm">Nenhuma consulta recebida.</p>
        <ul class="flex flex-col gap-2">
          <li v-for="c in bloco?.consultas ?? []" :key="c.id">
            <button
              type="button"
              class="min-h-11 w-full rounded-xl border px-3 py-2 text-left text-sm"
              :class="c.id === consultaId ? 'border-primary bg-accent font-semibold' : 'bg-card'"
              :aria-pressed="c.id === consultaId"
              @click="selecionarConsulta(c.id)"
            >
              Consulta às {{ c.hora }}
            </button>
          </li>
        </ul>
      </aside>

      <section v-if="leito" aria-labelledby="titulo-leito" class="flex flex-col gap-4">
        <div class="flex items-center justify-between gap-2">
          <h2 id="titulo-leito" class="text-xl font-bold">{{ leito.identificacao }}</h2>
          <Button size="touch" variant="outline" @click="copiar(textoDoLeito(), 'leito')">
            {{ copiado === 'leito' ? 'Copiado' : 'Copiar leito' }}
          </Button>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <section aria-labelledby="titulo-anotacoes" class="rounded-2xl border bg-card p-4">
            <h3 id="titulo-anotacoes" class="mb-2 text-sm font-semibold">Anotações</h3>
            <p v-if="!leito.anotacoes.length" class="text-muted-foreground text-sm">Nenhuma anotação.</p>
            <ul class="flex flex-col gap-2">
              <li v-for="a in leito.anotacoes" :key="a.id" class="text-sm">
                <span class="text-muted-foreground">{{ a.hora }}</span> · {{ a.texto }}
              </li>
            </ul>
          </section>

          <section aria-labelledby="titulo-problemas" class="rounded-2xl border bg-card p-4">
            <h3 id="titulo-problemas" class="mb-2 text-sm font-semibold">Problemas e suspeitas</h3>
            <p v-if="!leito.problemas.length" class="text-muted-foreground text-sm">Nenhum problema cadastrado.</p>
            <ol class="flex list-decimal flex-col gap-3 pl-5">
              <li v-for="p in leito.problemas" :key="p.id">
                <span class="font-semibold">{{ p.titulo }}</span>
                <ol v-if="p.suspeitas.length" class="mt-1 list-[lower-alpha] pl-5 text-sm">
                  <li v-for="s in p.suspeitas" :key="s.id">{{ s.texto }}</li>
                </ol>
              </li>
            </ol>
          </section>
        </div>
      </section>

      <section v-else-if="consulta" aria-labelledby="titulo-consulta" class="flex flex-col gap-4">
        <div class="flex flex-wrap gap-2">
          <Button size="touch" @click="enviarParaGemini">Revisar no Gemini (@nova-consulta)</Button>
        </div>

        <section aria-labelledby="titulo-resposta" class="rounded-2xl border bg-card p-4">
          <h2 id="titulo-resposta" class="mb-2 text-sm font-semibold">Resposta do Gemini</h2>
          <textarea
            v-model="respostaGemini"
            rows="6"
            spellcheck="false"
            class="border-input w-full rounded-xl border p-3 text-base"
            aria-label="Resposta do Gemini"
            placeholder="Cole aqui a resposta copiada do Gemini"
          />
          <Button size="touch" class="mt-2" :disabled="!respostaGemini.trim()" @click="conferirResposta">Conferir</Button>
          <p v-if="alertaNumeros.length" class="mt-2 text-sm text-atencao-suave-foreground" role="status">
            Confira estes números, que não estavam na transcrição: {{ alertaNumeros.join(', ') }}
          </p>
        </section>

        <section v-if="prontuario" aria-labelledby="titulo-prontuario" class="rounded-2xl border bg-card p-4">
          <h2 id="titulo-prontuario" class="mb-2 text-sm font-semibold">Prontuário (editável)</h2>
          <textarea
            v-model="prontuario"
            rows="16"
            spellcheck="false"
            class="border-input w-full rounded-xl border p-3 text-base leading-relaxed"
            aria-label="Prontuário editável"
          />
          <Button size="touch" class="mt-2" @click="copiar(prontuario, 'prontuario')">
            {{ copiado === 'prontuario' ? 'Copiado' : 'Copiar prontuário' }}
          </Button>
          <section v-if="fora" class="mt-4 rounded-2xl border border-dashed p-4">
            <h3 class="mb-2 text-sm font-semibold">Fora do prontuário (não copiar)</h3>
            <p class="whitespace-pre-wrap text-sm text-muted-foreground">{{ fora }}</p>
          </section>
        </section>
      </section>

      <section v-else class="rounded-2xl border border-dashed bg-card p-6 text-muted-foreground">
        Escolha um leito ou uma consulta na lista ao lado.
      </section>
    </div>
  </main>
</template>
