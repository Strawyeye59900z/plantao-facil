<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button'
import { decifrar, exportarChave, gerarChave } from '@/dominio/anamnese/cifra'
import { separarProntuario } from '@/dominio/anamnese/separarProntuario'
import { textoLimpo } from '@/dominio/anamnese/textoRevisado'
import { buscarResultado, criarSessao, encerrarSessao } from '@/lib/anamnese/sessao'

/**
 * PC: cria uma sessão, mostra o QR code (com a chave no fragmento, que não vai ao servidor)
 * e recebe as consultas do celular. As consultas ficam só na memória desta página:
 * ao recarregar ou fechar, a lista some.
 */
interface ConsultaRecebida {
  id: number
  horario: string
  prontuario: string
  fora: string
}

const qr = ref<string | null>(null)
const consultas = ref<ConsultaRecebida[]>([])
const selecionadaId = ref<number | null>(null)
const status = ref('Gerando QR code…')
const erro = ref<string | null>(null)
const copiado = ref(false)
let sessaoId: string | null = null
let relogio: number | undefined
let ultimaVersao = 0
let chaveAtual: CryptoKey | null = null
let proximoId = 1

const consultaAtual = computed(() => consultas.value.find((c) => c.id === selecionadaId.value) ?? null)

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
    qr.value = await QRCode.toDataURL(endereco, { width: 280, margin: 2 })
    status.value = 'Aguardando o celular. Leia o QR code com o celular.'
    relogio = window.setInterval(verificar, 3000)
  } catch (falha) {
    erro.value = falha instanceof Error ? falha.message : String(falha)
  }
}

/** Consulta o celular a cada 3 s: cada consulta nova entra no topo da lista. */
async function verificar() {
  if (!sessaoId || !chaveAtual) return
  try {
    const envelope = await buscarResultado(sessaoId, ultimaVersao)
    if (!envelope) return
    const claro = await decifrar(envelope, chaveAtual)
    if (claro === null) {
      erro.value = 'Não consegui decifrar um texto recebido. Peça para enviar de novo.'
      return
    }
    ultimaVersao = envelope.versao
    erro.value = null
    const partes = separarProntuario(textoLimpo(claro))
    const nova: ConsultaRecebida = {
      id: proximoId++,
      horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      prontuario: partes.prontuario,
      fora: partes.fora,
    }
    consultas.value.unshift(nova)
    selecionadaId.value = nova.id
    status.value = `Consulta recebida às ${nova.horario}. Confira e edite antes de copiar.`
  } catch (falha) {
    erro.value = falha instanceof Error ? falha.message : String(falha)
  }
}

async function copiarTexto() {
  if (!consultaAtual.value) return
  await navigator.clipboard.writeText(consultaAtual.value.prontuario)
  copiado.value = true
  setTimeout(() => (copiado.value = false), 2000)
}

async function encerrar() {
  clearInterval(relogio)
  if (sessaoId) await encerrarSessao(sessaoId)
  await iniciarSessao()
}

onMounted(iniciarSessao)
onBeforeUnmount(() => clearInterval(relogio))
</script>

<template>
  <main class="mx-auto flex max-w-6xl flex-col gap-4 p-4">
    <header class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 class="text-2xl font-bold">Receber do celular</h1>
        <p class="text-muted-foreground text-sm">{{ status }}</p>
      </div>
      <Button size="touch" variant="outline" @click="encerrar">Encerrar sessão e gerar novo QR</Button>
    </header>

    <p v-if="erro" class="text-critico text-sm" role="alert">{{ erro }}</p>

    <div class="grid gap-4 md:grid-cols-[16rem_1fr]">
      <aside aria-label="Consultas recebidas nesta sessão" class="flex flex-col gap-3">
        <section class="flex flex-col items-center gap-2 rounded-2xl border bg-card p-4">
          <img v-if="qr" :src="qr" alt="QR code para abrir no celular" class="size-44" />
          <p class="text-muted-foreground text-center text-xs">Leia com o celular para conectar.</p>
        </section>

        <h2 class="px-1 text-sm font-semibold">Consultas desta sessão ({{ consultas.length }})</h2>
        <p v-if="!consultas.length" class="text-muted-foreground px-1 text-sm">Nenhuma consulta recebida ainda.</p>
        <ul v-else class="flex flex-col gap-2">
          <li v-for="c in consultas" :key="c.id">
            <button
              type="button"
              class="w-full rounded-xl border px-3 py-3 text-left text-sm min-h-11"
              :class="c.id === selecionadaId ? 'border-primary bg-accent' : 'bg-card'"
              :aria-pressed="c.id === selecionadaId"
              @click="selecionadaId = c.id"
            >
              <span class="font-semibold">Consulta {{ consultas.length - consultas.indexOf(c) }}</span>
              <span class="text-muted-foreground block">{{ c.horario }}</span>
            </button>
          </li>
        </ul>
      </aside>

      <section v-if="consultaAtual" aria-labelledby="titulo-texto" class="rounded-2xl border bg-card p-4">
        <h2 id="titulo-texto" class="mb-2 text-sm font-semibold">Prontuário (editável)</h2>
        <textarea
          v-model="consultaAtual.prontuario"
          rows="20"
          spellcheck="false"
          class="border-input w-full rounded-xl border p-3 text-base leading-relaxed"
          aria-label="Prontuário editável"
        />
        <div class="mt-4 flex flex-wrap gap-2">
          <Button size="touch" :disabled="!consultaAtual.prontuario.trim()" @click="copiarTexto">
            {{ copiado ? 'Copiado' : 'Copiar prontuário' }}
          </Button>
        </div>
        <section
          v-if="consultaAtual.fora"
          aria-labelledby="titulo-fora"
          class="mt-4 rounded-2xl border border-dashed p-4"
        >
          <h2 id="titulo-fora" class="mb-2 text-sm font-semibold">Fora do prontuário (não copiar)</h2>
          <p class="whitespace-pre-wrap text-sm text-muted-foreground">{{ consultaAtual.fora }}</p>
        </section>
      </section>
    </div>
  </main>
</template>
