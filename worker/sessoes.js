/**
 * Sessões de sincronização entre PC e celular (Cloudflare Workers + Durable Objects).
 * O PC gera um código de 8 caracteres. O celular digita o código e recebe um "salt" para derivar a
 * chave de cifragem. O servidor só guarda o resumo do código e o texto cifrado (ver objetos.js). Nada é registrado em log.
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

/**
 * Rotas da API. `ns` fornece os Durable Objects: { sessao(id), entrada(resumo), limitador(ip) },
 * cada um devolvendo algo com `fetch(Request)`. Testável sem a Cloudflare.
 */
export function criarRotasSessoes(ns, { ipDe = () => 'local' } = {}) {
  const chamar = (alvo, metodo, caminho, corpo) =>
    alvo.fetch(
      new Request(`https://objeto${caminho}`, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: corpo === undefined ? undefined : typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
      }),
    )

  return async function tratar(req) {
    const url = new URL(req.url)
    const partes = url.pathname.split('/').filter(Boolean) // ['api','sessoes', id?]
    if (partes[0] !== 'api' || partes[1] !== 'sessoes') return null

    // Criar sessão (PC): devolve o código para mostrar e o salt para derivar a chave.
    if (partes.length === 2 && req.method === 'POST') {
      const id = gerarId()
      const salt = base64(crypto.getRandomValues(new Uint8Array(16)))
      for (let tentativa = 0; tentativa < 5; tentativa++) {
        const codigo = gerarCodigo()
        const resumo = await resumoCodigo(codigo)
        const entrada = await chamar(ns.entrada(resumo), 'POST', '/', { id })
        if (entrada.status === 409) continue // código já em uso: sorteia outro
        await chamar(ns.sessao(id), 'POST', '/iniciar', { salt, codigoResumo: resumo })
        return json({ id, codigo: `${codigo.slice(0, 4)}-${codigo.slice(4)}`, salt, expiraEmSegundos: TTL_SEGUNDOS }, 201)
      }
      return json({ erro: 'Não consegui gerar um código. Tente de novo.' }, 503)
    }

    // Entrar com o código (celular): devolve id e salt. Limite de tentativas por IP.
    if (partes.length === 3 && partes[2] === 'entrar' && req.method === 'POST') {
      const { limitado } = await (await chamar(ns.limitador(ipDe(req)), 'POST', '/')).json()
      if (limitado) return json({ erro: 'Muitas tentativas. Aguarde um minuto.' }, 429)
      const corpo = await req.json().catch(() => null)
      const codigo = normalizarCodigo(corpo?.codigo)
      if (codigo.length !== TAMANHO_CODIGO) return json({ erro: 'Código inválido.' }, 400)
      const entrada = await chamar(ns.entrada(await resumoCodigo(codigo)), 'GET', '/')
      if (!entrada.ok) return json({ erro: 'Código não encontrado ou expirado.' }, 404)
      const { id } = await entrada.json()
      const salt = await chamar(ns.sessao(id), 'GET', '/salt')
      if (!salt.ok) return json({ erro: 'Código não encontrado ou expirado.' }, 404)
      return json({ id, salt: (await salt.json()).salt })
    }

    if (partes.length !== 3) return json({ erro: 'Rota não encontrada.' }, 404)
    const id = partes[2]
    if (!/^[0-9a-f]{32}$/.test(id)) return json({ erro: 'Sessão inválida.' }, 400)

    if (req.method === 'GET') {
      const depois = Number(url.searchParams.get('depois') ?? 0) || 0
      return chamar(ns.sessao(id), 'GET', `/resultado?depois=${depois}`)
    }

    if (req.method === 'POST') {
      const tamanho = Number(req.headers.get('content-length') ?? 0)
      if (tamanho > LIMITE_CORPO_BYTES) return json({ erro: 'Conteúdo grande demais.' }, 413)
      return chamar(ns.sessao(id), 'POST', '/resultado', await req.text())
    }

    if (req.method === 'DELETE') {
      const resposta = await chamar(ns.sessao(id), 'DELETE', '/')
      if (resposta.ok) {
        const { codigoResumo } = await resposta.json()
        if (codigoResumo) await chamar(ns.entrada(codigoResumo), 'DELETE', '/')
      }
      return new Response(null, { status: 204 })
    }

    return json({ erro: 'Método não permitido.' }, 405)
  }
}
