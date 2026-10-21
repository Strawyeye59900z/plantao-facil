import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarRotasSessoes, LIMITE_CORPO_BYTES } from './sessoes.js'

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

describe('sessões de pareamento', () => {
  it('cria sessão com id de 32 hex e expiração', async () => {
    const kv = kvMemoria()
    const tratar = criarRotasSessoes(kv)
    const r = await tratar(req('POST', '/api/sessoes'))
    assert.equal(r.status, 201)
    const { id, expiraEmSegundos } = await r.json()
    assert.match(id, /^[0-9a-f]{32}$/)
    assert.equal(expiraEmSegundos, 600)
    assert.ok(kv.dados.has(`sessao:${id}`))
  })

  it('PC consulta antes do envio e recebe 204', async () => {
    const tratar = criarRotasSessoes(kvMemoria())
    const { id } = await (await tratar(req('POST', '/api/sessoes'))).json()
    const r = await tratar(req('GET', `/api/sessoes/${id}`))
    assert.equal(r.status, 204)
  })

  it('celular envia o texto cifrado e o PC recebe o mesmo conteúdo', async () => {
    const tratar = criarRotasSessoes(kvMemoria())
    const { id } = await (await tratar(req('POST', '/api/sessoes'))).json()
    const envio = await tratar(req('POST', `/api/sessoes/${id}`, { iv: 'IV123', ciphertext: 'CIFRADO' }))
    assert.equal(envio.status, 201)
    const r = await tratar(req('GET', `/api/sessoes/${id}`))
    assert.equal(r.status, 200)
    assert.deepEqual(await r.json(), { iv: 'IV123', ciphertext: 'CIFRADO' })
  })

  it('aceita só um envio por sessão', async () => {
    const tratar = criarRotasSessoes(kvMemoria())
    const { id } = await (await tratar(req('POST', '/api/sessoes'))).json()
    await tratar(req('POST', `/api/sessoes/${id}`, { iv: 'a', ciphertext: 'b' }))
    const segundo = await tratar(req('POST', `/api/sessoes/${id}`, { iv: 'c', ciphertext: 'd' }))
    assert.equal(segundo.status, 409)
  })

  it('recusa corpo sem iv e ciphertext', async () => {
    const tratar = criarRotasSessoes(kvMemoria())
    const { id } = await (await tratar(req('POST', '/api/sessoes'))).json()
    const r = await tratar(req('POST', `/api/sessoes/${id}`, { texto: 'claro' }))
    assert.equal(r.status, 400)
  })

  it('recusa corpo acima do limite', async () => {
    const tratar = criarRotasSessoes(kvMemoria())
    const { id } = await (await tratar(req('POST', '/api/sessoes'))).json()
    const r = await tratar(req('POST', `/api/sessoes/${id}`, { iv: 'a', ciphertext: 'b' }, { 'content-length': String(LIMITE_CORPO_BYTES + 1) }))
    assert.equal(r.status, 413)
  })

  it('sessão inexistente ou expirada responde 404', async () => {
    const tratar = criarRotasSessoes(kvMemoria())
    const r = await tratar(req('GET', '/api/sessoes/00000000000000000000000000000000'))
    assert.equal(r.status, 404)
  })

  it('id com formato inválido responde 400', async () => {
    const tratar = criarRotasSessoes(kvMemoria())
    const r = await tratar(req('GET', '/api/sessoes/ID-INVALIDO'))
    assert.equal(r.status, 400)
  })

  it('DELETE apaga a sessão e o PC não recebe mais nada', async () => {
    const tratar = criarRotasSessoes(kvMemoria())
    const { id } = await (await tratar(req('POST', '/api/sessoes'))).json()
    assert.equal((await tratar(req('DELETE', `/api/sessoes/${id}`))).status, 204)
    assert.equal((await tratar(req('GET', `/api/sessoes/${id}`))).status, 404)
  })

  it('o servidor guarda só o texto cifrado, nunca a chave', async () => {
    const kv = kvMemoria()
    const tratar = criarRotasSessoes(kv)
    const { id } = await (await tratar(req('POST', '/api/sessoes'))).json()
    await tratar(req('POST', `/api/sessoes/${id}`, { iv: 'IV', ciphertext: 'CIFRADO', chave: 'NAO_DEVE_FICAR' }))
    const guardado = kv.dados.get(`sessao:${id}`)
    assert.equal(guardado.includes('NAO_DEVE_FICAR'), false)
  })

  it('rotas fora de /api/sessoes são devolvidas ao app (retorna null)', async () => {
    const tratar = criarRotasSessoes(kvMemoria())
    assert.equal(await tratar(req('GET', '/prescricoes')), null)
  })
})
