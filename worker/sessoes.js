/**
 * Sessões de pareamento entre PC e celular (Cloudflare Workers).
 * O servidor só guarda o texto cifrado (iv + ciphertext). A chave fica no QR code, nunca aqui.
 * Sessões expiram sozinhas (KV com TTL) e nada é registrado em log.
 */
export const TTL_SEGUNDOS = 43200 // 12 h sem uso; cada acesso renova o prazo
export const LIMITE_CORPO_BYTES = 1024 * 1024 // bloco de notas com vários leitos

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
      // ?depois=N: o PC pede só o que é mais novo que a versão N que já recebeu.
      const depois = Number(url.searchParams.get('depois') ?? 0)
      if (payload.versao <= depois) {
        await kv.put(chave(id), guardado, { expirationTtl: TTL_SEGUNDOS })
        return new Response(null, { status: 204 })
      }
      await kv.put(chave(id), guardado, { expirationTtl: TTL_SEGUNDOS })
      return json(payload)
    }

    if (req.method === 'POST') {
      const tamanho = Number(req.headers.get('content-length') ?? 0)
      if (tamanho > LIMITE_CORPO_BYTES) return json({ erro: 'Conteúdo grande demais.' }, 413)
      const guardado = await kv.get(chave(id))
      if (!guardado) return json({ erro: 'Sessão não encontrada ou expirada.' }, 404)
      const anterior = JSON.parse(guardado).payload
      const corpo = await req.json().catch(() => null)
      if (!corpo || typeof corpo.iv !== 'string' || typeof corpo.ciphertext !== 'string') {
        return json({ erro: 'Envie { iv, ciphertext }.' }, 400)
      }
      const versao = (anterior?.versao ?? 0) + 1
      await kv.put(chave(id), JSON.stringify({ payload: { iv: corpo.iv, ciphertext: corpo.ciphertext, versao } }), {
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
