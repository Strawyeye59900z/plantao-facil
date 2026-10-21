/**
 * Sessões de sincronização entre PC e celular (Cloudflare Workers).
 * O PC gera um código de 8 caracteres. O celular digita o código e recebe um "salt" para derivar a
 * chave de cifragem. O servidor só guarda o resumo do código e o texto cifrado. Nada é registrado em log.
 */
export const TTL_SEGUNDOS = 43200 // 12 h sem uso; cada acesso renova o prazo
export const LIMITE_CORPO_BYTES = 1024 * 1024 // bloco de notas com vários leitos
export const LIMITE_TENTATIVAS_POR_MINUTO = 20
export const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sem 0, O, 1, I, L
export const TAMANHO_CODIGO = 8

const json = (corpo, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
const base64 = (bytes) => btoa(String.fromCharCode(...bytes))

export function gerarId() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return hex(bytes)
}

/** Código com rejeição de bytes para não enviesar a escolha de caracteres. */
export function gerarCodigo() {
  const limite = 256 - (256 % ALFABETO_CODIGO.length)
  let codigo = ''
  while (codigo.length < TAMANHO_CODIGO) {
    const b = new Uint8Array(1)
    crypto.getRandomValues(b)
    if (b[0] < limite) codigo += ALFABETO_CODIGO[b[0] % ALFABETO_CODIGO.length]
  }
  return codigo
}

export function normalizarCodigo(bruto) {
  return String(bruto ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export async function resumoCodigo(codigo) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codigo))
  return hex(new Uint8Array(digest))
}

/** Recebe um objeto KV-like ({get, put, delete}). Testável sem a Cloudflare. */
export function criarRotasSessoes(kv, { ipDe = () => 'local' } = {}) {
  const chave = (id) => `sessao:${id}`
  const chaveCodigo = (resumo) => `codigo:${resumo}`

  async function limitarTentativas(req) {
    const minuto = Math.floor(Date.now() / 60000)
    const k = `tentativas:${ipDe(req)}:${minuto}`
    const usadas = Number((await kv.get(k)) ?? 0) + 1
    await kv.put(k, String(usadas), { expirationTtl: 120 })
    return usadas > LIMITE_TENTATIVAS_POR_MINUTO
  }

  return async function tratar(req) {
    const url = new URL(req.url)
    const partes = url.pathname.split('/').filter(Boolean) // ['api','sessoes', id?]
    if (partes[0] !== 'api' || partes[1] !== 'sessoes') return null

    // Criar sessão (PC): devolve o código para mostrar e o salt para derivar a chave.
    if (partes.length === 2 && req.method === 'POST') {
      const id = gerarId()
      const codigo = gerarCodigo()
      const salt = base64(crypto.getRandomValues(new Uint8Array(16)))
      await kv.put(chave(id), JSON.stringify({ salt, payload: null }), { expirationTtl: TTL_SEGUNDOS })
      await kv.put(chaveCodigo(await resumoCodigo(codigo)), id, { expirationTtl: TTL_SEGUNDOS })
      return json({ id, codigo: `${codigo.slice(0, 4)}-${codigo.slice(4)}`, salt, expiraEmSegundos: TTL_SEGUNDOS }, 201)
    }

    // Entrar com o código (celular): devolve id e salt. Limite de tentativas por IP.
    if (partes.length === 3 && partes[2] === 'entrar' && req.method === 'POST') {
      if (await limitarTentativas(req)) return json({ erro: 'Muitas tentativas. Aguarde um minuto.' }, 429)
      const corpo = await req.json().catch(() => null)
      const codigo = normalizarCodigo(corpo?.codigo)
      if (codigo.length !== TAMANHO_CODIGO) return json({ erro: 'Código inválido.' }, 400)
      const id = await kv.get(chaveCodigo(await resumoCodigo(codigo)))
      if (!id) return json({ erro: 'Código não encontrado ou expirado.' }, 404)
      const guardado = await kv.get(chave(id))
      if (!guardado) return json({ erro: 'Código não encontrado ou expirado.' }, 404)
      return json({ id, salt: JSON.parse(guardado).salt })
    }

    if (partes.length !== 3) return json({ erro: 'Rota não encontrada.' }, 404)
    const id = partes[2]
    if (!/^[0-9a-f]{32}$/.test(id)) return json({ erro: 'Sessão inválida.' }, 400)

    if (req.method === 'GET') {
      const guardado = await kv.get(chave(id))
      if (!guardado) return json({ erro: 'Sessão não encontrada ou expirada.' }, 404)
      const { payload } = JSON.parse(guardado)
      await kv.put(chave(id), guardado, { expirationTtl: TTL_SEGUNDOS })
      if (!payload) return new Response(null, { status: 204 })
      // ?depois=N: o PC pede só o que é mais novo que a versão N que já recebeu.
      const depois = Number(url.searchParams.get('depois') ?? 0)
      if (payload.versao <= depois) return new Response(null, { status: 204 })
      return json(payload)
    }

    if (req.method === 'POST') {
      const tamanho = Number(req.headers.get('content-length') ?? 0)
      if (tamanho > LIMITE_CORPO_BYTES) return json({ erro: 'Conteúdo grande demais.' }, 413)
      const guardado = await kv.get(chave(id))
      if (!guardado) return json({ erro: 'Sessão não encontrada ou expirada.' }, 404)
      const estado = JSON.parse(guardado)
      const corpo = await req.json().catch(() => null)
      if (!corpo || typeof corpo.iv !== 'string' || typeof corpo.ciphertext !== 'string') {
        return json({ erro: 'Envie { iv, ciphertext }.' }, 400)
      }
      const versao = (estado.payload?.versao ?? 0) + 1
      await kv.put(
        chave(id),
        JSON.stringify({ salt: estado.salt, payload: { iv: corpo.iv, ciphertext: corpo.ciphertext, versao } }),
        { expirationTtl: TTL_SEGUNDOS },
      )
      return json({ ok: true, versao }, 201)
    }

    if (req.method === 'DELETE') {
      await kv.delete(chave(id))
      return new Response(null, { status: 204 })
    }

    return json({ erro: 'Método não permitido.' }, 405)
  }
}
