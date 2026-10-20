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
      const modelo = await pipeline('automatic-speech-recognition', mensagem.modelo, {
        device: mensagem.dispositivo,
        dtype: mensagem.dispositivo === 'webgpu' ? 'fp16' : 'q8',
        progress_callback: (p: { status?: string; file?: string; progress?: number }) => {
          if (p.status === 'progress' && p.file) {
            escopo.postMessage({
              tipo: 'progresso',
              arquivo: p.file,
              porcentagem: Math.round(p.progress ?? 0),
            } satisfies MensagemDoWorker)
          }
        },
      })
      transcritor = modelo as unknown as Transcritor
      escopo.postMessage({ tipo: 'pronto', dispositivo: mensagem.dispositivo } satisfies MensagemDoWorker)
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
