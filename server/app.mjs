import { timingSafeEqual } from 'node:crypto'
import Fastify from 'fastify'

/** Tamanho máximo de um bloco WAV (30 s, 16 kHz, 16 bits, mono ≈ 0,96 MB). */
export const LIMITE_CORPO_BYTES = 2 * 1024 * 1024
export const LIMITE_REQUISICOES_POR_HORA = 60

/** Compara o cabeçalho Authorization com o token em tempo constante. */
export function autorizado(cabecalho, token) {
  if (typeof cabecalho !== 'string') return false
  const recebido = Buffer.from(cabecalho)
  const esperado = Buffer.from(`Bearer ${token}`)
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado)
}

/**
 * Cria a API. `transcrever(wav: Buffer) => Promise<string>` é injetado, para o teste não chamar o provedor.
 * Logs: só método, rota, status e tempo. Nunca o corpo nem o texto transcrito.
 */
export function criarApp({ token, transcrever, agora = () => Date.now(), logar = console.log }) {
  const app = Fastify({ logger: false, bodyLimit: LIMITE_CORPO_BYTES })
  const contagemPorHora = new Map()

  app.addContentTypeParser('audio/wav', { parseAs: 'buffer' }, (_req, corpo, feito) => feito(null, corpo))

  app.addHook('onResponse', async (req, resposta) => {
    logar(JSON.stringify({ metodo: req.method, rota: req.routeOptions?.url ?? req.url, status: resposta.statusCode, ms: Math.round(resposta.elapsedTime) }))
  })

  app.get('/api/saude', async () => ({ ok: true }))

  app.post('/api/transcricao', async (req, resposta) => {
    if (!autorizado(req.headers.authorization, token)) {
      return resposta.code(401).send({ erro: 'Não autorizado.' })
    }
    const hora = Math.floor(agora() / 3_600_000)
    const usadas = (contagemPorHora.get(hora) ?? 0) + 1
    contagemPorHora.set(hora, usadas)
    if (usadas > LIMITE_REQUISICOES_POR_HORA) {
      return resposta.code(429).send({ erro: 'Limite de chamadas por hora atingido.' })
    }
    const corpo = req.body
    if (!Buffer.isBuffer(corpo) || corpo.length === 0) {
      return resposta.code(400).send({ erro: 'Envie o áudio WAV no corpo da requisição.' })
    }
    try {
      const texto = await transcrever(corpo)
      return { texto }
    } catch {
      return resposta.code(502).send({ erro: 'Falha no serviço de transcrição. Tente de novo.' })
    }
  })

  return app
}
