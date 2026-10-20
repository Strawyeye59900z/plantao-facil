import { ref } from 'vue'
import { AcumuladorBlocos } from '@/dominio/anamnese/blocos'
import { juntarTrechos } from '@/dominio/anamnese/juncao'
import { iniciarCaptura, type Captura } from '@/lib/audio/captura'
import type { MensagemDoWorker, MensagemParaWorker } from '@/workers/transcricao.worker'

/** Modelos de teste: "base" é mais rápido no celular; "small" é mais preciso e mais pesado. */
export const MODELOS = {
  base: 'onnx-community/whisper-base',
  small: 'onnx-community/whisper-small',
} as const

export type ModeloTranscricao = keyof typeof MODELOS

export const MODELO_PADRAO = MODELOS.base

export type StatusTranscricao =
  | 'sem-modelo'
  | 'carregando-modelo'
  | 'pronto'
  | 'gravando'
  | 'pausado'
  | 'encerrado'
  | 'erro'

/**
 * Transcrição durante a consulta: grava, envia blocos de 30 s ao worker e acumula o texto.
 * O áudio fica só em memória e é descartado depois de transcrito.
 */
export function useTranscricao() {
  const status = ref<StatusTranscricao>('sem-modelo')
  const texto = ref('')
  const ultimoTrecho = ref('')
  const filaPendente = ref(0)
  const progresso = ref<{ arquivo: string; porcentagem: number } | null>(null)
  const erro = ref<string | null>(null)
  const dispositivo = ref<'webgpu' | 'wasm' | null>(null)

  let worker: Worker | null = null
  let captura: Captura | null = null
  let proximoId = 1
  let travaTela: WakeLockSentinel | null = null
  const acumulador = new AcumuladorBlocos()

  function enviar(bloco: Float32Array) {
    if (!worker) return
    filaPendente.value += 1
    const mensagem: MensagemParaWorker = { tipo: 'transcrever', id: proximoId++, audio: bloco }
    worker.postMessage(mensagem, [bloco.buffer])
  }

  function aoMensagem(evento: MessageEvent<MensagemDoWorker>) {
    const msg = evento.data
    if (msg.tipo === 'progresso') {
      progresso.value = { arquivo: msg.arquivo, porcentagem: msg.porcentagem }
    } else if (msg.tipo === 'pronto') {
      dispositivo.value = msg.dispositivo
      progresso.value = null
      status.value = 'pronto'
    } else if (msg.tipo === 'texto') {
      filaPendente.value = Math.max(0, filaPendente.value - 1)
      ultimoTrecho.value = msg.texto
      texto.value = juntarTrechos(texto.value, msg.texto)
    } else {
      filaPendente.value = Math.max(0, filaPendente.value - 1)
      erro.value = msg.mensagem
      status.value = 'erro'
    }
  }

  /** Baixa e prepara o modelo; na primeira vez mostra o progresso, depois usa o cache do navegador. */
  function carregarModelo(modelo: string = MODELO_PADRAO) {
    status.value = 'carregando-modelo'
    erro.value = null
    worker ??= new Worker(new URL('../workers/transcricao.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = aoMensagem
    worker.onerror = (evento) => {
      erro.value = evento.message || 'O transcritor parou ao carregar. Feche e abra a página.'
      status.value = 'erro'
    }
    const dispositivoEscolhido = 'gpu' in navigator ? 'webgpu' : 'wasm'
    const mensagem: MensagemParaWorker = { tipo: 'carregar', modelo, dispositivo: dispositivoEscolhido }
    worker.postMessage(mensagem)
  }

  async function travarTela() {
    try {
      travaTela = (await navigator.wakeLock?.request('screen')) ?? null
    } catch {
      travaTela = null
    }
  }

  function liberarTela() {
    void travaTela?.release()
    travaTela = null
  }

  async function iniciar() {
    if (status.value !== 'pronto' && status.value !== 'pausado') return
    try {
      captura = await iniciarCaptura((trecho) => {
        if (status.value !== 'gravando') return
        for (const bloco of acumulador.adicionar(trecho)) enviar(bloco)
      })
    } catch (falha) {
      erro.value = falha instanceof Error ? falha.message : String(falha)
      status.value = 'erro'
      return
    }
    status.value = 'gravando'
    await travarTela()
  }

  function pausar() {
    if (status.value !== 'gravando') return
    status.value = 'pausado'
    liberarTela()
  }

  async function retomar() {
    if (status.value !== 'pausado') return
    status.value = 'gravando'
    await travarTela()
  }

  /** Para a gravação e envia o último trecho, que pode ser menor que 30 s. */
  function encerrar() {
    if (status.value !== 'gravando' && status.value !== 'pausado') return
    status.value = 'encerrado'
    captura?.parar()
    captura = null
    const final = acumulador.encerrar()
    if (final) enviar(final)
    liberarTela()
  }

  /** Apaga o texto e o áudio que ainda não foi enviado. Nada é guardado em disco. */
  function descartar() {
    captura?.parar()
    captura = null
    acumulador.descartar()
    texto.value = ''
    ultimoTrecho.value = ''
    filaPendente.value = 0
    liberarTela()
    status.value = dispositivo.value ? 'pronto' : 'sem-modelo'
  }

  function liberar() {
    captura?.parar()
    captura = null
    liberarTela()
    worker?.terminate()
    worker = null
  }

  return {
    status,
    texto,
    ultimoTrecho,
    filaPendente,
    progresso,
    erro,
    dispositivo,
    carregarModelo,
    iniciar,
    pausar,
    retomar,
    encerrar,
    descartar,
    liberar,
  }
}
