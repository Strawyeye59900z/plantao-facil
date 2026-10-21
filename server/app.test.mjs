import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { autorizado, criarApp, LIMITE_REQUISICOES_POR_HORA } from './app.mjs'

const TOKEN = 'token-de-teste-com-mais-de-32-caracteres-xx'
const AUTH = { authorization: `Bearer ${TOKEN}` }
const WAV = Buffer.from('RIFF0000WAVEfake')

function app(extra = {}) {
  return criarApp({ token: TOKEN, transcrever: async () => 'Paciente refere dor torácica.', logar: () => {}, ...extra })
}

describe('autorizado', () => {
  it('aceita o token certo', () => assert.equal(autorizado(`Bearer ${TOKEN}`, TOKEN), true))
  it('recusa token errado, de tamanho igual ou não', () => {
    assert.equal(autorizado(`Bearer ${'x'.repeat(TOKEN.length)}`, TOKEN), false)
    assert.equal(autorizado('Bearer curto', TOKEN), false)
  })
  it('recusa cabeçalho ausente', () => assert.equal(autorizado(undefined, TOKEN), false))
})

describe('POST /api/transcricao', () => {
  it('sem token responde 401', async () => {
    const resposta = await app().inject({ method: 'POST', url: '/api/transcricao', headers: { 'content-type': 'audio/wav' }, payload: WAV })
    assert.equal(resposta.statusCode, 401)
  })

  it('com token devolve só o texto', async () => {
    const resposta = await app().inject({ method: 'POST', url: '/api/transcricao', headers: { ...AUTH, 'content-type': 'audio/wav' }, payload: WAV })
    assert.equal(resposta.statusCode, 200)
    assert.deepEqual(resposta.json(), { texto: 'Paciente refere dor torácica.' })
  })

  it('corpo vazio responde 400', async () => {
    const resposta = await app().inject({ method: 'POST', url: '/api/transcricao', headers: { ...AUTH, 'content-type': 'audio/wav' }, payload: Buffer.alloc(0) })
    assert.equal(resposta.statusCode, 400)
  })

  it('falha do provedor responde 502 sem detalhes', async () => {
    const api = app({ transcrever: async () => { throw new Error('detalhe interno') } })
    const resposta = await api.inject({ method: 'POST', url: '/api/transcricao', headers: { ...AUTH, 'content-type': 'audio/wav' }, payload: WAV })
    assert.equal(resposta.statusCode, 502)
    assert.equal(resposta.body.includes('detalhe interno'), false)
  })

  it('corpo acima do limite é recusado', async () => {
    const grande = Buffer.alloc(2 * 1024 * 1024 + 1)
    const resposta = await app().inject({ method: 'POST', url: '/api/transcricao', headers: { ...AUTH, 'content-type': 'audio/wav' }, payload: grande })
    assert.equal(resposta.statusCode, 413)
  })

  it('limita chamadas por hora', async () => {
    const api = app({ agora: () => 1_000 })
    let ultimo = 0
    for (let i = 0; i <= LIMITE_REQUISICOES_POR_HORA; i++) {
      ultimo = (await api.inject({ method: 'POST', url: '/api/transcricao', headers: { ...AUTH, 'content-type': 'audio/wav' }, payload: WAV })).statusCode
    }
    assert.equal(ultimo, 429)
  })

  it('o log não contém o texto transcrito', async () => {
    const linhas = []
    const api = app({ logar: (linha) => linhas.push(linha) })
    await api.inject({ method: 'POST', url: '/api/transcricao', headers: { ...AUTH, 'content-type': 'audio/wav' }, payload: WAV })
    assert.ok(linhas.length > 0)
    assert.equal(linhas.join('').includes('dor torácica'), false)
  })
})
