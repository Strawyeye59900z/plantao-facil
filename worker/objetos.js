/**
 * Durable Objects (SQLite) do Plantão Fácil. Cada sessão de sincronização é um objeto próprio:
 *  - Sessao:     guarda o salt e o último texto cifrado (nome do objeto = id aleatório da sessão);
 *  - Entrada:    liga o resumo do código digitado ao id da sessão (nome = resumo SHA-256 do código);
 *  - Limitador:  conta tentativas de entrada por IP, só em memória (nome = IP).
 * O prazo de 12 h é renovado no máximo a cada 30 min: consultar não grava nada na maior parte das vezes.
 * Cada sessão tem dois "canais" de texto cifrado: o padrão (bloco de notas e transcrições, do celular para o PC)
 * e `biblioteca` (prescrições entre os aparelhos do mesmo médico, nos dois sentidos).
 * Compartilhamento de prescrições (`fixo`): prazo de 7 dias contado da criação, que nada renova.
 */
import { LIMITE_CORPO_BYTES, LIMITE_TENTATIVAS_POR_MINUTO, TTL_SEGUNDOS } from './sessoes.js'

export const RENOVA_A_CADA_MS = 30 * 60 * 1000

const json = (corpo, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

const naoEncontrada = () => json({ erro: 'Sessão não encontrada ou expirada.' }, 404)

/** Estado com prazo: apagado pelo alarme quando passa o tempo sem uso. */
class ComPrazo {
  constructor(ctx, _env, { agora = Date.now } = {}) {
    this.ctx = ctx
    this.agora = agora
    this.estado = null
    this.pronto = ctx.blockConcurrencyWhile(async () => {
      this.estado = (await ctx.storage.get('estado')) ?? null
    })
  }

  fim(estado) {
    const ttl = (estado.ttl ?? TTL_SEGUNDOS) * 1000
    return estado.fixo ? estado.iniciadoEm + ttl : estado.renovadoEm + ttl + RENOVA_A_CADA_MS
  }

  async salvar(estado) {
    estado.renovadoEm = this.agora()
    estado.iniciadoEm ??= estado.renovadoEm
    this.estado = estado
    await this.ctx.storage.put('estado', estado)
    await this.ctx.storage.setAlarm(this.fim(estado))
  }

  /** Estende o prazo só se a última renovação for antiga; evita uma gravação a cada consulta. */
  async tocar() {
    if (this.estado && !this.estado.fixo && this.agora() - this.estado.renovadoEm > RENOVA_A_CADA_MS) await this.salvar(this.estado)
  }

  async apagar() {
    this.estado = null
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
  }

  async alarm() {
    await this.pronto
    if (!this.estado) return
    const fim = this.fim(this.estado)
    if (this.agora() >= fim) await this.apagar()
    else await this.ctx.storage.setAlarm(fim)
  }
}

export class Sessao extends ComPrazo {
  async fetch(req) {
    await this.pronto
    const { pathname, searchParams } = new URL(req.url)
    const campo = searchParams.get('canal') === 'biblioteca' ? 'biblioteca' : 'payload'

    if (req.method === 'POST' && pathname === '/iniciar') {
      if (this.estado) return json({ erro: 'Sessão já existe.' }, 409)
      const { salt, codigoResumo, ttl, fixo } = await req.json()
      await this.salvar({ salt, codigoResumo, payload: null, ttl, fixo: fixo === true })
      return json({ ok: true }, 201)
    }

    if (!this.estado) return naoEncontrada()

    if (req.method === 'GET' && pathname === '/salt') return json({ salt: this.estado.salt })

    if (req.method === 'GET' && pathname === '/resultado') {
      await this.tocar()
      const payload = this.estado[campo]
      if (!payload) return new Response(null, { status: 204 })
      // ?depois=N: o PC pede só o que é mais novo que a versão N que já recebeu.
      const depois = Number(searchParams.get('depois') ?? 0)
      if (payload.versao <= depois) return new Response(null, { status: 204 })
      return json(payload)
    }

    if (req.method === 'POST' && pathname === '/resultado') {
      const texto = await req.text()
      if (texto.length > LIMITE_CORPO_BYTES) return json({ erro: 'Conteúdo grande demais.' }, 413)
      let corpo = null
      try {
        corpo = JSON.parse(texto)
      } catch {
        corpo = null
      }
      if (!corpo || typeof corpo.iv !== 'string' || typeof corpo.ciphertext !== 'string') {
        return json({ erro: 'Envie { iv, ciphertext }.' }, 400)
      }
      const versao = (this.estado[campo]?.versao ?? 0) + 1
      await this.salvar({ ...this.estado, [campo]: { iv: corpo.iv, ciphertext: corpo.ciphertext, versao } })
      return json({ ok: true, versao }, 201)
    }

    if (req.method === 'DELETE') {
      const { codigoResumo } = this.estado
      await this.apagar()
      return json({ codigoResumo })
    }

    return json({ erro: 'Rota não encontrada.' }, 404)
  }
}

export class Entrada extends ComPrazo {
  async fetch(req) {
    await this.pronto
    if (req.method === 'POST') {
      if (this.estado) return json({ erro: 'Código já existe.' }, 409)
      const { id, ttl, fixo } = await req.json()
      await this.salvar({ id, ttl, fixo: fixo === true })
      return json({ ok: true }, 201)
    }
    if (!this.estado) return naoEncontrada()
    if (req.method === 'GET') return json({ id: this.estado.id })
    if (req.method === 'DELETE') {
      await this.apagar()
      return new Response(null, { status: 204 })
    }
    return json({ erro: 'Rota não encontrada.' }, 404)
  }
}

/** Só em memória: se o objeto for descarregado por inatividade, a contagem recomeça (janela é de 1 min). */
export class Limitador {
  constructor(_ctx, _env, { agora = Date.now } = {}) {
    this.agora = agora
    this.minuto = 0
    this.usadas = 0
  }

  async fetch() {
    const minuto = Math.floor(this.agora() / 60000)
    if (minuto !== this.minuto) {
      this.minuto = minuto
      this.usadas = 0
    }
    this.usadas += 1
    return json({ limitado: this.usadas > LIMITE_TENTATIVAS_POR_MINUTO })
  }
}
