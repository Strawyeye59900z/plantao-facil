/** Comunicação com a API de sessões (Cloudflare Workers). Só envia e recebe texto cifrado. */
import type { Envelope } from '@/dominio/anamnese/cifra'

export async function criarSessao(): Promise<{ id: string; expiraEmSegundos: number }> {
  const resposta = await fetch('/api/sessoes', { method: 'POST' })
  if (!resposta.ok) throw new Error('Não consegui criar a sessão. Verifique a conexão.')
  return resposta.json()
}

/** Devolve o envelope quando o celular já enviou; null enquanto espera; lança erro se expirou. */
export async function buscarResultado(id: string): Promise<Envelope | null> {
  const resposta = await fetch(`/api/sessoes/${id}`)
  if (resposta.status === 204) return null
  if (resposta.status === 404) throw new Error('Esta sessão expirou. Gere um novo QR code.')
  if (!resposta.ok) throw new Error('Falha ao consultar a sessão.')
  return resposta.json()
}

export async function enviarResultado(id: string, envelope: Envelope): Promise<void> {
  const resposta = await fetch(`/api/sessoes/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
  })
  if (resposta.status === 404) throw new Error('Esta sessão expirou. Peça um novo QR code no PC.')
  if (resposta.status === 409) throw new Error('Esta sessão já recebeu um resultado.')
  if (resposta.status === 413) throw new Error('O texto é grande demais para enviar.')
  if (!resposta.ok) throw new Error('Não consegui enviar. Verifique a conexão e tente de novo.')
}

export async function encerrarSessao(id: string): Promise<void> {
  await fetch(`/api/sessoes/${id}`, { method: 'DELETE' }).catch(() => undefined)
}
