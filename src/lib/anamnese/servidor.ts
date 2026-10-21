/**
 * Envia um bloco WAV para a API de transcrição do servidor e recebe só o texto.
 * O token fica salvo só neste aparelho (não é dado clínico).
 */

export const CHAVE_TOKEN = 'anamnese:token'

export function lerToken(): string {
  try {
    return localStorage.getItem(CHAVE_TOKEN) ?? ''
  } catch {
    return ''
  }
}

export function salvarToken(token: string): void {
  try {
    localStorage.setItem(CHAVE_TOKEN, token.trim())
  } catch {
    // sem armazenamento local: o token precisa ser digitado de novo
  }
}

export interface SegmentoRevisao {
  tipo: 'texto' | 'destaque' | 'duvida'
  texto: string
}

export interface RevisaoTranscricao {
  segmentos: SegmentoRevisao[]
  mudancas: { original: string; corrigido: string }[]
}

/** Envia a transcrição completa para a IA revisar. A resposta já vem validada pelo servidor. */
export async function revisarNoServidor(texto: string, token: string): Promise<RevisaoTranscricao> {
  const resposta = await fetch('/api/anamnese/revisar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto }),
  })
  const dados = (await resposta.json().catch(() => ({}))) as { erro?: string } & Partial<RevisaoTranscricao>
  if (!resposta.ok) throw new Error(dados.erro ?? `Falha na revisão (${resposta.status}).`)
  return { segmentos: dados.segmentos ?? [], mudancas: dados.mudancas ?? [] }
}

export async function transcreverNoServidor(wav: ArrayBuffer, token: string): Promise<string> {
  const resposta = await fetch('/api/transcricao', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'audio/wav' },
    body: wav,
  })
  if (resposta.status === 401) throw new Error('Token recusado pelo servidor. Confira o token salvo.')
  if (!resposta.ok) throw new Error(`Falha na transcrição (${resposta.status}). Tente de novo.`)
  const dados = (await resposta.json()) as { texto?: unknown }
  return typeof dados.texto === 'string' ? dados.texto : ''
}
