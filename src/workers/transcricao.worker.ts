/// <reference lib="webworker" />
/**
 * Transcrição no próprio aparelho: o Whisper roda aqui, fora da tela principal.
 * O áudio nunca sai do celular; só o texto volta para a página.
 */
import { env, pipeline } from '@huggingface/transformers'

export type MensagemParaWorker =
  | { tipo: 'carregar'; modelo: string; dispositivo: 'webgpu' | 'wasm' }
  | { tipo: 'transcrever'; id: number; audio: Float32Array }

export type MensagemDoWorker =
  | { tipo: 'progresso'; arquivo: string; porcentagem: number }
  | { tipo: 'pronto'; dispositivo: 'webgpu' | 'wasm' }
  | { tipo: 'texto'; id: number; texto: string }
  | { tipo: 'erro'; id: number | null; mensagem: string }

type Transcritor = (audio: Float32Array, opcoes: Record<string, unknown>) => Promise<{ text?: string }>

// Modelos ficam no cache do navegador depois do primeiro download.
env.allowLocalModels = false

let transcritor: Transcritor | null = null
const escopo = self as unknown as DedicatedWorkerGlobalScope

escopo.onmessage = async (evento: MessageEvent<MensagemParaWorker>) => {
  const mensagem = evento.data
  try {
    if (mensagem.tipo === 'carregar') {
      const progresso = (p: { status?: string; file?: string; progress?: number }) => {
        if (p.status === 'progress' && p.file) {
          escopo.postMessage({
            tipo: 'progresso',
            arquivo: p.file,
            porcentagem: Math.round(p.progress ?? 0),
          } satisfies MensagemDoWorker)
        }
      }
      const carregar = (dispositivo: 'webgpu' | 'wasm') =>
        pipeline('automatic-speech-recognition', mensagem.modelo, {
          device: dispositivo,
          dtype: dispositivo === 'webgpu' ? 'fp16' : 'q8',
          progress_callback: progresso,
        })

      // Alguns aparelhos têm WebGPU, mas sem suporte a fp16: nesse caso usa o processador (WASM).
      let dispositivoUsado: 'webgpu' | 'wasm' = mensagem.dispositivo
      let modelo: unknown
      try {
        modelo = await carregar(mensagem.dispositivo)
      } catch (falha) {
        if (mensagem.dispositivo !== 'webgpu') throw falha
        dispositivoUsado = 'wasm'
        modelo = await carregar('wasm')
      }
      transcritor = modelo as Transcritor
      escopo.postMessage({ tipo: 'pronto', dispositivo: dispositivoUsado } satisfies MensagemDoWorker)
      return
    }

    if (!transcritor) {
      escopo.postMessage({ tipo: 'erro', id: mensagem.id, mensagem: 'O modelo ainda não foi carregado.' } satisfies MensagemDoWorker)
      return
    }
    const resultado = await transcritor(mensagem.audio, { language: 'portuguese', task: 'transcribe' })
    escopo.postMessage({ tipo: 'texto', id: mensagem.id, texto: (resultado.text ?? '').trim() } satisfies MensagemDoWorker)
  } catch (erro) {
    const id = mensagem.tipo === 'transcrever' ? mensagem.id : null
    escopo.postMessage({ tipo: 'erro', id, mensagem: erro instanceof Error ? erro.message : String(erro) } satisfies MensagemDoWorker)
  }
}
