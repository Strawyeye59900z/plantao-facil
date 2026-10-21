/** Comunicação com a API de sessões (Cloudflare Workers). Só envia e recebe texto cifrado. */
import type { Envelope } from '@/dominio/anamnese/cifra'

export interface SessaoCriada {
  id: string
  codigo: string
  salt: string
  expiraEmSegundos: number
}

export interface ResultadoRecebido extends Envelope {
  versao: number
}

/** A sessão foi encerrada por um dos lados ou expirou (sem uso por 12 h). */
export class SessaoEncerradaError extends Error {}

export async function criarSessao(): Promise<SessaoCriada> {
  const resposta = await fetch('/api/sessoes', { method: 'POST' })
  if (!resposta.ok) throw new Error('Não consegui criar a sincronização. Verifique a conexão.')
  return resposta.json()
}

/** Celular: troca o código digitado pelo id da sessão e pelo salt. */
export async function entrarSessao(codigo: string): Promise<{ id: string; salt: string }> {
  const resposta = await fetch('/api/sessoes/entrar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo }),
  })
  if (resposta.status === 404) throw new Error('Código não encontrado ou expirado. Confira no PC.')
  if (resposta.status === 429) throw new Error('Muitas tentativas. Aguarde um minuto.')
  if (resposta.status === 400) throw new Error('O código tem 8 caracteres.')
  if (!resposta.ok) throw new Error('Não consegui conectar. Verifique a conexão.')
  return resposta.json()
}

/** Devolve o envelope mais novo que `depois`; null quando não há nada novo. */
export async function buscarResultado(id: string, depois = 0): Promise<ResultadoRecebido | null> {
  const resposta = await fetch(`/api/sessoes/${id}?depois=${depois}`)
  if (resposta.status === 204) return null
  if (resposta.status === 404) throw new SessaoEncerradaError('A sincronização foi encerrada.')
  if (!resposta.ok) throw new Error('Falha ao consultar a sincronização.')
  return resposta.json()
}

export async function enviarResultado(id: string, envelope: Envelope): Promise<void> {
  const resposta = await fetch(`/api/sessoes/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
  })
  if (resposta.status === 404) throw new SessaoEncerradaError('A sincronização foi encerrada.')
  if (resposta.status === 413) throw new Error('O bloco está grande demais para enviar.')
  if (!resposta.ok) throw new Error('Não consegui enviar. Verifique a conexão e tente de novo.')
}

export async function encerrarSessao(id: string): Promise<void> {
  await fetch(`/api/sessoes/${id}`, { method: 'DELETE' }).catch(() => undefined)
}
