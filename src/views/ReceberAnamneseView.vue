<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button'
import { decifrar, exportarChave, gerarChave } from '@/dominio/anamnese/cifra'
import { segmentar, textoLimpo } from '@/dominio/anamnese/textoRevisado'
import { buscarResultado, criarSessao, encerrarSessao } from '@/lib/anamnese/sessao'

/**
 * PC: cria uma sessão, mostra o QR code (com a chave no fragmento, que não vai ao servidor)
 * e recebe o texto revisado do celular.
 */
const qr = ref<string | null>(null)
const texto = ref<string | null>(null)
const status = ref('Gerando QR code…')
const erro = ref<string | null>(null)
const copiado = ref(false)
let sessaoId: string | null = null
let relogio: number | undefined

async function iniciarSessao() {
  clearInterval(relogio)
  texto.value = null
  erro.value = null
  status.value = 'Gerando QR code…'
  try {
    const chave = await gerarChave()
    const chaveTexto = await exportarChave(chave)
    const sessao = await criarSessao()
    sessaoId = sessao.id
    const endereco = `${location.origin}/#/anamnese/consulta?s=${sessao.id}&k=${chaveTexto}`
    qr.value = await QRCode.toDataURL(endereco, { width: 280, margin: 2 })
    status.value = 'Aguardando o celular. Leia o QR code com o celular.'
    relogio = window.setInterval(() => verificar(chave), 3000)
  } catch (falha) {
    erro.value = falha instanceof Error ? falha.message : String(falha)
  }
}

async function verificar(chave: CryptoKey) {
  if (!sessaoId) return
  try {
    const envelope = await buscarResultado(sessaoId)
    if (!envelope) return
    clearInterval(relogio)
    const claro = await decifrar(envelope, chave)
    if (claro === null) {
      erro.value = 'Não consegui decifrar o texto recebido. Gere um novo QR code.'
      return
    }
    texto.value = claro
    status.value = 'Texto recebido.'
  } catch (falha) {
    clearInterval(relogio)
    erro.value = falha instanceof Error ? falha.message : String(falha)
  }
}

async function copiarTexto() {
  if (!texto.value) return
  await navigator.clipboard.writeText(textoLimpo(texto.value))
  copiado.value = true
  setTimeout(() => (copiado.value = false), 2000)
}

onMounted(iniciarSessao)
onBeforeUnmount(() => {
  clearInterval(relogio)
  if (sessaoId) void encerrarSessao(sessaoId)
})
</script>

<template>
  <main class="mx-auto flex max-w-xl flex-col gap-4 p-4">
    <header>
      <h1 class="text-2xl font-bold">Receber do celular</h1>
      <p class="text-muted-foreground text-sm">{{ status }}</p>
    </header>

    <p v-if="erro" class="text-critico text-sm" role="alert">{{ erro }}</p>

    <section v-if="qr && !texto" class="flex flex-col items-center gap-3 rounded-2xl border bg-card p-4">
      <img :src="qr" alt="QR code para abrir no celular" class="size-72" />
      <Button size="touch" variant="outline" @click="iniciarSessao">Gerar novo QR code</Button>
    </section>

    <section v-if="texto" aria-labelledby="titulo-texto" class="rounded-2xl border bg-card p-4">
      <h2 id="titulo-texto" class="mb-2 text-sm font-semibold">Anamnese recebida</h2>
      <p class="whitespace-pre-wrap text-base leading-relaxed">
        <template v-for="(s, i) in segmentar(texto)" :key="i">
          <strong v-if="s.tipo === 'destaque'">{{ s.texto }}</strong>
          <span v-else>{{ s.texto }}</span>
        </template>
      </p>
      <div class="mt-4 flex flex-wrap gap-2">
        <Button size="touch" @click="copiarTexto">{{ copiado ? 'Copiado' : 'Copiar anamnese' }}</Button>
        <Button size="touch" variant="outline" @click="iniciarSessao">Nova consulta</Button>
      </div>
    </section>
  </main>
</template>
