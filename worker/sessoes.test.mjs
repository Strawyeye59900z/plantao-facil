import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarRotasSessoes, LIMITE_CORPO_BYTES, LIMITE_TENTATIVAS_POR_MINUTO, normalizarCodigo } from './sessoes.js'

/** KV em memória com a mesma interface usada pelo Worker. */
function kvMemoria() {
  const dados = new Map()
  return {
    dados,
    async get(k) { return dados.has(k) ? dados.get(k) : null },
    async put(k, v) { dados.set(k, v) },
    async delete(k) { dados.delete(k) },
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
    const sessao = await criar(criarRotasSessoes(kvMemoria()))
    assert.match(sessao.id, /^[0-9a-f]{32}$/)
    assert.match(sessao.codigo, /^[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/)
    assert.ok(sessao.salt.length > 10)
    assert.equal(sessao.expiraEmSegundos, 43200)
  })

  it('o servidor não guarda o código em claro', async () => {
    const kv = kvMemoria()
    const sessao = await criar(criarRotasSessoes(kv))
    const codigo = sessao.codigo.replace('-', '')
    assert.equal(JSON.stringify([...kv.dados.entries()]).includes(codigo), false)
  })

  it('celular entra com o código (aceita minúsculo e espaço) e recebe id e salt', async () => {
    const tratar = criarRotasSessoes(kvMemoria())
    const sessao = await criar(tratar)
    const r = await tratar(req('POST', '/api/sessoes/entrar', { codigo: sessao.codigo.toLowerCase().replace('-', ' ') }))
    assert.equal(r.status, 200)
    assert.deepEqual(await r.json(), { id: sessao.id, salt: sessao.salt })
  })

  it('código errado responde 404', async () => {
    const tratar = criarRotasSessoes(kvMemoria())
    await criar(tratar)
    const r = await tratar(req('POST', '/api/sessoes/entrar', { codigo: 'ZZZZ-ZZZZ' }))
    assert.equal(r.status, 404)
  })

  it('código com tamanho errado responde 400', async () => {
    const r = await criarRotasSessoes(kvMemoria())(req('POST', '/api/sessoes/entrar', { codigo: 'ABC' }))
    assert.equal(r.status, 400)
  })

  it('limita tentativas por IP por minuto', async () => {
    const tratar = criarRotasSessoes(kvMemoria(), { ipDe: () => '1.2.3.4' })
    let ultimo = 0
    for (let i = 0; i <= LIMITE_TENTATIVAS_POR_MINUTO; i++) {
      ultimo = (await tratar(req('POST', '/api/sessoes/entrar', { codigo: 'ZZZZZZZZ' }))).status
    }
    assert.equal(ultimo, 429)
  })

  it('normalizarCodigo tira espaços e hífen e põe em maiúsculas', () => {
    assert.equal(normalizarCodigo('ab2c-d3ef'), 'AB2CD3EF')
  })
})

describe('sessões de sincronização', () => {
  it('PC consulta antes do envio e recebe 204', async () => {
    const tratar = criarRotasSessoes(kvMemoria())
    const { id } = await criar(tratar)
    assert.equal((await tratar(req('GET', `/api/sessoes/${id}`))).status, 204)
  })

  it('celular envia o texto cifrado e o PC recebe o mesmo conteúdo com a versão', async () => {
    const tratar = criarRotasSessoes(kvMemoria())
    const { id } = await criar(tratar)
    assert.equal((await tratar(req('POST', `/api/sessoes/${id}`, { iv: 'IV123', ciphertext: 'CIFRADO' }))).status, 201)
    const r = await tratar(req('GET', `/api/sessoes/${id}`))
    assert.deepEqual(await r.json(), { iv: 'IV123', ciphertext: 'CIFRADO', versao: 1 })
  })

  it('aceita novos envios e o PC pede só o que é mais novo', async () => {
    const tratar = criarRotasSessoes(kvMemoria())
    const { id } = await criar(tratar)
    await tratar(req('POST', `/api/sessoes/${id}`, { iv: 'a', ciphertext: 'b' }))
    assert.equal((await tratar(req('GET', `/api/sessoes/${id}?depois=1`))).status, 204)
    await tratar(req('POST', `/api/sessoes/${id}`, { iv: 'c', ciphertext: 'd' }))
    const r2 = await tratar(req('GET', `/api/sessoes/${id}?depois=1`))
    assert.equal((await r2.json()).versao, 2)
  })

  it('recusa corpo sem iv e ciphertext', async () => {
    const tratar = criarRotasSessoes(kvMemoria())
    const { id } = await criar(tratar)
    assert.equal((await tratar(req('POST', `/api/sessoes/${id}`, { texto: 'claro' }))).status, 400)
  })

  it('recusa corpo acima do limite', async () => {
    const tratar = criarRotasSessoes(kvMemoria())
    const { id } = await criar(tratar)
    const r = await tratar(req('POST', `/api/sessoes/${id}`, { iv: 'a', ciphertext: 'b' }, { 'content-length': String(LIMITE_CORPO_BYTES + 1) }))
    assert.equal(r.status, 413)
  })

  it('sessão inexistente responde 404 e id inválido responde 400', async () => {
    const tratar = criarRotasSessoes(kvMemoria())
    assert.equal((await tratar(req('GET', '/api/sessoes/00000000000000000000000000000000'))).status, 404)
    assert.equal((await tratar(req('GET', '/api/sessoes/ID-INVALIDO'))).status, 400)
  })

  it('DELETE apaga a sessão', async () => {
    const tratar = criarRotasSessoes(kvMemoria())
    const { id } = await criar(tratar)
    assert.equal((await tratar(req('DELETE', `/api/sessoes/${id}`))).status, 204)
    assert.equal((await tratar(req('GET', `/api/sessoes/${id}`))).status, 404)
  })

  it('o servidor guarda só o texto cifrado, nunca a chave', async () => {
    const kv = kvMemoria()
    const tratar = criarRotasSessoes(kv)
    const { id } = await criar(tratar)
    await tratar(req('POST', `/api/sessoes/${id}`, { iv: 'IV', ciphertext: 'CIFRADO', chave: 'NAO_DEVE_FICAR' }))
    assert.equal(kv.dados.get(`sessao:${id}`).includes('NAO_DEVE_FICAR'), false)
  })

  it('rotas fora de /api/sessoes são devolvidas ao app', async () => {
    assert.equal(await criarRotasSessoes(kvMemoria())(req('GET', '/prescricoes')), null)
  })
})
