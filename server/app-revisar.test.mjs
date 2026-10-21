import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarApp } from './app.mjs'

const TOKEN = 'token-de-teste-com-mais-de-32-caracteres-xx'
const AUTH = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }
const SEGMENTOS = { segmentos: [{ tipo: 'texto', texto: 'Teste.' }], mudancas: [] }

function app(revisar) {
  return criarApp({ token: TOKEN, transcrever: async () => '', revisar, logar: () => {} })
}

describe('POST /api/anamnese/revisar', () => {
  it('sem token responde 401', async () => {
    const r = await app(async () => ({ ok: true, resultado: SEGMENTOS })).inject({
      method: 'POST', url: '/api/anamnese/revisar', headers: { 'content-type': 'application/json' }, payload: { texto: 'x' },
    })
    assert.equal(r.statusCode, 401)
  })

  it('devolve os segmentos quando a revisão é válida', async () => {
    const r = await app(async () => ({ ok: true, resultado: SEGMENTOS })).inject({
      method: 'POST', url: '/api/anamnese/revisar', headers: AUTH, payload: { texto: 'Teste.' },
    })
    assert.equal(r.statusCode, 200)
    assert.deepEqual(r.json(), SEGMENTOS)
  })

  it('responde 422 quando a trava de números recusa a revisão', async () => {
    const r = await app(async () => ({ ok: false, motivo: 'A IA alterou números.' })).inject({
      method: 'POST', url: '/api/anamnese/revisar', headers: AUTH, payload: { texto: 'Teste.' },
    })
    assert.equal(r.statusCode, 422)
  })

  it('sem texto responde 400', async () => {
    const r = await app(async () => ({ ok: true, resultado: SEGMENTOS })).inject({
      method: 'POST', url: '/api/anamnese/revisar', headers: AUTH, payload: {},
    })
    assert.equal(r.statusCode, 400)
  })
})
