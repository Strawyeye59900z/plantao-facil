import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarRotasSessoes, LIMITE_CORPO_BYTES, LIMITE_TENTATIVAS_POR_MINUTO, normalizarCodigo } from './sessoes.js'
import { Entrada, Limitador, RENOVA_A_CADA_MS, Sessao } from './objetos.js'

/** Storage de um Durable Object em memória, com a interface usada pelos objetos. */
function ctxFalso() {
  const dados = new Map()
  const ctx = {
    dados,
    alarme: null,
    gravacoes: 0,
    blockConcurrencyWhile: (fn) => fn(),
    storage: {
      async get(k) { return dados.get(k) },
      async put(k, v) { ctx.gravacoes++; dados.set(k, structuredClone(v)) },
      async deleteAll() { dados.clear() },
      async setAlarm(t) { ctx.alarme = t },
      async deleteAlarm() { ctx.alarme = null },
    },
  }
  return ctx
}

/** Ambiente com os três tipos de objeto, relógio controlável e acesso ao que foi gravado. */
function ambiente() {
  const relogio = { agora: 1_700_000_000_000 }
  const opcoes = { agora: () => relogio.agora }
  const instancias = new Map()
  const obter = (tipo, Classe) => (nome) => {
    const chave = `${tipo}:${nome}`
    if (!instancias.has(chave)) {
      const ctx = ctxFalso()
      instancias.set(chave, { ctx, objeto: new Classe(ctx, {}, opcoes) })
    }
    return instancias.get(chave).objeto
  }
  return {
    relogio,
    instancias,
    ns: { sessao: obter('sessao', Sessao), entrada: obter('entrada', Entrada), limitador: obter('limitador', Limitador) },
    gravacoes: (prefixo) => [...instancias].filter(([k]) => k.startsWith(prefixo)).reduce((t, [, v]) => t + v.ctx.gravacoes, 0),
    tudoGravado: () => JSON.stringify([...instancias].map(([k, v]) => [k, [...v.ctx.dados]])),
  }
}

const url = (caminho) => `https://prescricao.mhvl.com.br${caminho}`
const req = (metodo, caminho, corpo, cabecalhos = {}) =>
  new Request(url(caminho), {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...cabecalhos },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })

async function criar(tratar) {
  return (await (await tratar(req('POST', '/api/sessoes'))).json())
}

describe('código de sincronização', () => {
  it('PC recebe id, código de 8 caracteres e salt', async () => {
    const sessao = await criar(criarRotasSessoes(ambiente().ns))
    assert.match(sessao.id, /^[0-9a-f]{32}$/)
    assert.match(sessao.codigo, /^[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/)
    assert.ok(sessao.salt.length > 10)
    assert.equal(sessao.expiraEmSegundos, 43200)
  })

  it('o servidor não guarda o código em claro', async () => {
    const amb = ambiente()
    const sessao = await criar(criarRotasSessoes(amb.ns))
    const codigo = sessao.codigo.replace('-', '')
    assert.equal(amb.tudoGravado().includes(codigo), false)
    assert.equal([...amb.instancias.keys()].join().includes(codigo), false)
  })

  it('celular entra com o código (aceita minúsculo e espaço) e recebe id e salt', async () => {
    const tratar = criarRotasSessoes(ambiente().ns)
    const sessao = await criar(tratar)
    const r = await tratar(req('POST', '/api/sessoes/entrar', { codigo: sessao.codigo.toLowerCase().replace('-', ' ') }))
    assert.equal(r.status, 200)
    assert.deepEqual(await r.json(), { id: sessao.id, salt: sessao.salt })
  })

  it('código errado responde 404', async () => {
    const tratar = criarRotasSessoes(ambiente().ns)
    await criar(tratar)
    const r = await tratar(req('POST', '/api/sessoes/entrar', { codigo: 'ZZZZ-ZZZZ' }))
    assert.equal(r.status, 404)
  })

  it('código com tamanho errado responde 400', async () => {
    const r = await criarRotasSessoes(ambiente().ns)(req('POST', '/api/sessoes/entrar', { codigo: 'ABC' }))
    assert.equal(r.status, 400)
  })

  it('limita tentativas por IP por minuto e libera no minuto seguinte', async () => {
    const amb = ambiente()
    const tratar = criarRotasSessoes(amb.ns, { ipDe: () => '1.2.3.4' })
    let ultimo = 0
    for (let i = 0; i <= LIMITE_TENTATIVAS_POR_MINUTO; i++) {
      ultimo = (await tratar(req('POST', '/api/sessoes/entrar', { codigo: 'ZZZZZZZZ' }))).status
    }
    assert.equal(ultimo, 429)
    amb.relogio.agora += 61_000
    assert.equal((await tratar(req('POST', '/api/sessoes/entrar', { codigo: 'ZZZZZZZZ' }))).status, 404)
  })

  it('o limite de tentativas é separado por IP', async () => {
    const amb = ambiente()
    let ip = 'a'
    const tratar = criarRotasSessoes(amb.ns, { ipDe: () => ip })
    for (let i = 0; i <= LIMITE_TENTATIVAS_POR_MINUTO; i++) await tratar(req('POST', '/api/sessoes/entrar', { codigo: 'ZZZZZZZZ' }))
    ip = 'b'
    assert.equal((await tratar(req('POST', '/api/sessoes/entrar', { codigo: 'ZZZZZZZZ' }))).status, 404)
  })

  it('normalizarCodigo tira espaços e hífen e põe em maiúsculas', () => {
    assert.equal(normalizarCodigo('ab2c-d3ef'), 'AB2CD3EF')
  })
})

describe('sessões de sincronização', () => {
  it('PC consulta antes do envio e recebe 204', async () => {
    const tratar = criarRotasSessoes(ambiente().ns)
    const { id } = await criar(tratar)
    assert.equal((await tratar(req('GET', `/api/sessoes/${id}`))).status, 204)
  })

  it('celular envia o texto cifrado e o PC recebe o mesmo conteúdo com a versão', async () => {
    const tratar = criarRotasSessoes(ambiente().ns)
    const { id } = await criar(tratar)
    assert.equal((await tratar(req('POST', `/api/sessoes/${id}`, { iv: 'IV123', ciphertext: 'CIFRADO' }))).status, 201)
    const r = await tratar(req('GET', `/api/sessoes/${id}`))
    assert.deepEqual(await r.json(), { iv: 'IV123', ciphertext: 'CIFRADO', versao: 1 })
  })

  it('aceita novos envios e o PC pede só o que é mais novo', async () => {
    const tratar = criarRotasSessoes(ambiente().ns)
    const { id } = await criar(tratar)
    await tratar(req('POST', `/api/sessoes/${id}`, { iv: 'a', ciphertext: 'b' }))
    assert.equal((await tratar(req('GET', `/api/sessoes/${id}?depois=1`))).status, 204)
    await tratar(req('POST', `/api/sessoes/${id}`, { iv: 'c', ciphertext: 'd' }))
    const r2 = await tratar(req('GET', `/api/sessoes/${id}?depois=1`))
    assert.equal((await r2.json()).versao, 2)
  })

  it('recusa corpo sem iv e ciphertext', async () => {
    const tratar = criarRotasSessoes(ambiente().ns)
    const { id } = await criar(tratar)
    assert.equal((await tratar(req('POST', `/api/sessoes/${id}`, { texto: 'claro' }))).status, 400)
  })

  it('recusa corpo acima do limite', async () => {
    const tratar = criarRotasSessoes(ambiente().ns)
    const { id } = await criar(tratar)
    const r = await tratar(req('POST', `/api/sessoes/${id}`, { iv: 'a', ciphertext: 'b' }, { 'content-length': String(LIMITE_CORPO_BYTES + 1) }))
    assert.equal(r.status, 413)
  })

  it('recusa corpo acima do limite mesmo sem content-length', async () => {
    const tratar = criarRotasSessoes(ambiente().ns)
    const { id } = await criar(tratar)
    const r = await tratar(req('POST', `/api/sessoes/${id}`, { iv: 'a', ciphertext: 'x'.repeat(LIMITE_CORPO_BYTES) }))
    assert.equal(r.status, 413)
  })

  it('sessão inexistente responde 404 e id inválido responde 400', async () => {
    const tratar = criarRotasSessoes(ambiente().ns)
    assert.equal((await tratar(req('GET', '/api/sessoes/00000000000000000000000000000000'))).status, 404)
    assert.equal((await tratar(req('GET', '/api/sessoes/ID-INVALIDO'))).status, 400)
  })

  it('DELETE apaga a sessão e o código deixa de valer', async () => {
    const tratar = criarRotasSessoes(ambiente().ns)
    const { id, codigo } = await criar(tratar)
    assert.equal((await tratar(req('DELETE', `/api/sessoes/${id}`))).status, 204)
    assert.equal((await tratar(req('GET', `/api/sessoes/${id}`))).status, 404)
    assert.equal((await tratar(req('POST', '/api/sessoes/entrar', { codigo }))).status, 404)
  })

  it('o servidor guarda só o texto cifrado, nunca a chave', async () => {
    const amb = ambiente()
    const tratar = criarRotasSessoes(amb.ns)
    const { id } = await criar(tratar)
    await tratar(req('POST', `/api/sessoes/${id}`, { iv: 'IV', ciphertext: 'CIFRADO', chave: 'NAO_DEVE_FICAR' }))
    assert.equal(amb.tudoGravado().includes('NAO_DEVE_FICAR'), false)
    assert.equal(amb.tudoGravado().includes('CIFRADO'), true)
  })

  it('rotas fora de /api/sessoes são devolvidas ao app', async () => {
    assert.equal(await criarRotasSessoes(ambiente().ns)(req('GET', '/prescricoes')), null)
  })
})

describe('prazo e gravações', () => {
  it('consultar repetidamente não grava de novo (só renova após 30 min)', async () => {
    const amb = ambiente()
    const tratar = criarRotasSessoes(amb.ns)
    const { id } = await criar(tratar)
    const antes = amb.gravacoes('sessao:')
    for (let i = 0; i < 200; i++) await tratar(req('GET', `/api/sessoes/${id}`))
    assert.equal(amb.gravacoes('sessao:'), antes)
    amb.relogio.agora += RENOVA_A_CADA_MS + 1
    await tratar(req('GET', `/api/sessoes/${id}`))
    assert.equal(amb.gravacoes('sessao:'), antes + 1)
  })

  it('o alarme apaga a sessão e o código depois de 12 h sem uso', async () => {
    const amb = ambiente()
    const tratar = criarRotasSessoes(amb.ns)
    const { id, codigo } = await criar(tratar)
    const { ctx, objeto } = amb.instancias.get(`sessao:${id}`)
    amb.relogio.agora += 43200 * 1000 + RENOVA_A_CADA_MS + 1
    await objeto.alarm()
    assert.equal(ctx.dados.size, 0)
    assert.equal((await tratar(req('GET', `/api/sessoes/${id}`))).status, 404)
    for (const [k, v] of amb.instancias) if (k.startsWith('entrada:')) await v.objeto.alarm()
    assert.equal((await tratar(req('POST', '/api/sessoes/entrar', { codigo }))).status, 404)
  })

  it('o alarme reagenda se a sessão foi usada depois', async () => {
    const amb = ambiente()
    const tratar = criarRotasSessoes(amb.ns)
    const { id } = await criar(tratar)
    const { ctx, objeto } = amb.instancias.get(`sessao:${id}`)
    amb.relogio.agora += 43200 * 1000 // 12 h depois, ainda dentro da folga de renovação
    await tratar(req('GET', `/api/sessoes/${id}`)) // renova
    await objeto.alarm()
    assert.ok(ctx.dados.size > 0)
    assert.equal((await tratar(req('GET', `/api/sessoes/${id}`))).status, 204)
  })
})

describe('compartilhamento de prescrições (7 dias)', () => {
  const DIAS_7 = 7 * 86400
  const criarCompartilhamento = async (tratar) =>
    (await (await tratar(req('POST', '/api/sessoes', { tipo: 'compartilhamento' }))).json())

  it('informa o prazo de 7 dias; sem corpo continua 12 h', async () => {
    const tratar = criarRotasSessoes(ambiente().ns)
    assert.equal((await criarCompartilhamento(tratar)).expiraEmSegundos, DIAS_7)
    assert.equal((await criar(tratar)).expiraEmSegundos, 43200)
  })

  it('vários colegas entram com o mesmo código e baixam o mesmo pacote', async () => {
    const tratar = criarRotasSessoes(ambiente().ns)
    const { id, codigo } = await criarCompartilhamento(tratar)
    await tratar(req('POST', `/api/sessoes/${id}`, { iv: 'IV', ciphertext: 'PACOTE' }))
    for (const ip of ['colega1', 'colega2', 'colega3']) {
      const entrada = await tratar(req('POST', '/api/sessoes/entrar', { codigo }, { 'x-ip': ip }))
      assert.equal(entrada.status, 200)
      const baixado = await tratar(req('GET', `/api/sessoes/${(await entrada.json()).id}`))
      assert.deepEqual(await baixado.json(), { iv: 'IV', ciphertext: 'PACOTE', versao: 1 })
    }
  })

  it('o prazo é fixo: consultar e reenviar não o estendem, e aos 7 dias tudo é apagado', async () => {
    const amb = ambiente()
    const tratar = criarRotasSessoes(amb.ns)
    const { id, codigo } = await criarCompartilhamento(tratar)
    const { ctx, objeto } = amb.instancias.get(`sessao:${id}`)
    const alarmeInicial = ctx.alarme
    assert.equal(alarmeInicial, amb.relogio.agora + DIAS_7 * 1000)

    amb.relogio.agora += 3 * 86400 * 1000
    await tratar(req('GET', `/api/sessoes/${id}`))
    await tratar(req('POST', `/api/sessoes/${id}`, { iv: 'a', ciphertext: 'b' }))
    assert.equal(ctx.alarme, alarmeInicial)

    amb.relogio.agora = alarmeInicial - 1000
    await objeto.alarm()
    assert.equal((await tratar(req('GET', `/api/sessoes/${id}`))).status, 200)

    amb.relogio.agora = alarmeInicial
    await objeto.alarm()
    assert.equal((await tratar(req('GET', `/api/sessoes/${id}`))).status, 404)
    for (const [k, v] of amb.instancias) if (k.startsWith('entrada:')) await v.objeto.alarm()
    assert.equal((await tratar(req('POST', '/api/sessoes/entrar', { codigo }))).status, 404)
  })

  it('quem enviou pode cancelar: o código deixa de valer', async () => {
    const tratar = criarRotasSessoes(ambiente().ns)
    const { id, codigo } = await criarCompartilhamento(tratar)
    assert.equal((await tratar(req('DELETE', `/api/sessoes/${id}`))).status, 204)
    assert.equal((await tratar(req('POST', '/api/sessoes/entrar', { codigo }))).status, 404)
  })
})
