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
