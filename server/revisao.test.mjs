import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarRevisor, numerosDoTexto, validarRevisao } from './revisao.mjs'

const ORIGINAL = 'Paciente toma losartana 50 mg de 12/12h há 3 dias com dor torácica.'

describe('numerosDoTexto', () => {
  it('extrai inteiros e decimais, normalizando vírgula', () => {
    assert.deepEqual(numerosDoTexto('5 mg, 2,5 mL, 12/12h'), ['5', '2.5', '12', '12'])
  })
})

describe('validarRevisao', () => {
  it('aceita revisão com a mesma sequência de números', () => {
    const r = validarRevisao(ORIGINAL, {
      segmentos: [
        { tipo: 'texto', texto: 'Paciente toma ' },
        { tipo: 'destaque', texto: 'losartana 50 mg de 12/12h' },
        { tipo: 'texto', texto: ' há ' },
        { tipo: 'destaque', texto: '3 dias' },
        { tipo: 'texto', texto: ' com dor torácica.' },
      ],
      mudancas: [],
    })
    assert.equal(r.ok, true)
    assert.equal(r.resultado.segmentos.length, 5)
  })

  it('recusa revisão que altera um número', () => {
    const r = validarRevisao(ORIGINAL, {
      segmentos: [{ tipo: 'texto', texto: 'Paciente toma losartana 500 mg de 12/12h há 3 dias com dor torácica.' }],
      mudancas: [],
    })
    assert.equal(r.ok, false)
    assert.match(r.motivo, /alterou números/)
  })

  it('recusa segmento fora do formato', () => {
    const r = validarRevisao(ORIGINAL, { segmentos: [{ tipo: 'html', texto: 'x' }] })
    assert.equal(r.ok, false)
  })

  it('recusa resposta sem segmentos', () => {
    assert.equal(validarRevisao(ORIGINAL, {}).ok, false)
  })
})

describe('criarRevisor', () => {
  const respostaGroq = (conteudo) => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: conteudo } }] }),
  })

  it('devolve a revisão validada quando a IA responde certo', async () => {
    const conteudo = JSON.stringify({
      segmentos: [{ tipo: 'texto', texto: ORIGINAL }],
      mudancas: [],
    })
    const revisar = criarRevisor({ chave: 'x', fetchFn: async () => respostaGroq(conteudo) })
    const r = await revisar(ORIGINAL)
    assert.equal(r.ok, true)
  })

  it('recusa quando a IA não devolve JSON', async () => {
    const revisar = criarRevisor({ chave: 'x', fetchFn: async () => respostaGroq('texto solto') })
    const r = await revisar(ORIGINAL)
    assert.equal(r.ok, false)
  })

  it('envia a chave só no cabeçalho e pede JSON com temperatura zero', async () => {
    let enviado
    const revisar = criarRevisor({
      chave: 'chave-secreta',
      fetchFn: async (url, opcoes) => {
        enviado = { url, opcoes }
        return respostaGroq(JSON.stringify({ segmentos: [{ tipo: 'texto', texto: ORIGINAL }], mudancas: [] }))
      },
    })
    await revisar(ORIGINAL)
    assert.equal(enviado.opcoes.headers.Authorization, 'Bearer chave-secreta')
    const corpo = JSON.parse(enviado.opcoes.body)
    assert.equal(corpo.temperature, 0)
    assert.deepEqual(corpo.response_format, { type: 'json_object' })
    assert.equal(enviado.opcoes.body.includes('chave-secreta'), false)
  })
})
