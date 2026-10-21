/**
 * Sessões de pareamento entre PC e celular (Cloudflare Workers).
 * O servidor só guarda o texto cifrado (iv + ciphertext). A chave fica no QR code, nunca aqui.
 * Sessões expiram sozinhas (KV com TTL) e nada é registrado em log.
 */
export const TTL_SEGUNDOS = 600
export const LIMITE_CORPO_BYTES = 256 * 1024

const json = (corpo, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

export function gerarId() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Recebe um objeto KV-like ({get, put, delete}). Testável sem a Cloudflare. */
export function criarRotasSessoes(kv) {
  const chave = (id) => `sessao:${id}`

  return async function tratar(req) {
    const url = new URL(req.url)
    const partes = url.pathname.split('/').filter(Boolean) // ['api','sessoes', id?]
    if (partes[0] !== 'api' || partes[1] !== 'sessoes') return null

    if (partes.length === 2 && req.method === 'POST') {
      const id = gerarId()
      await kv.put(chave(id), JSON.stringify({ payload: null }), { expirationTtl: TTL_SEGUNDOS })
      return json({ id, expiraEmSegundos: TTL_SEGUNDOS }, 201)
    }

    if (partes.length !== 3) return json({ erro: 'Rota não encontrada.' }, 404)
    const id = partes[2]
    if (!/^[0-9a-f]{32}$/.test(id)) return json({ erro: 'Sessão inválida.' }, 400)

    if (req.method === 'GET') {
      const guardado = await kv.get(chave(id))
      if (!guardado) return json({ erro: 'Sessão não encontrada ou expirada.' }, 404)
      const { payload } = JSON.parse(guardado)
      if (!payload) return new Response(null, { status: 204 })
      return json(payload)
    }

    if (req.method === 'POST') {
      const tamanho = Number(req.headers.get('content-length') ?? 0)
      if (tamanho > LIMITE_CORPO_BYTES) return json({ erro: 'Conteúdo grande demais.' }, 413)
      const guardado = await kv.get(chave(id))
      if (!guardado) return json({ erro: 'Sessão não encontrada ou expirada.' }, 404)
      if (JSON.parse(guardado).payload) return json({ erro: 'Esta sessão já recebeu um resultado.' }, 409)
      const corpo = await req.json().catch(() => null)
      if (!corpo || typeof corpo.iv !== 'string' || typeof corpo.ciphertext !== 'string') {
        return json({ erro: 'Envie { iv, ciphertext }.' }, 400)
      }
      await kv.put(chave(id), JSON.stringify({ payload: { iv: corpo.iv, ciphertext: corpo.ciphertext } }), {
        expirationTtl: TTL_SEGUNDOS,
      })
      return json({ ok: true }, 201)
    }

    if (req.method === 'DELETE') {
      await kv.delete(chave(id))
      return new Response(null, { status: 204 })
    }

    return json({ erro: 'Método não permitido.' }, 405)
  }
}
