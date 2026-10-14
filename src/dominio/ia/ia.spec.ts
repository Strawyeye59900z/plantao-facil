// Testes com rede simulada e dados fictícios — nenhuma chamada real, nenhum conteúdo clínico real.
import { describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { categoriaTeste } from '@/dominio/prescricoes/fixtures.spec-helper'
import { validarPrescricao } from '@/dominio/prescricoes/editar'
import { enviarParaIA } from '@/lib/enviarParaIA'
import { contarPaginas, paraBase64, recortarPaginas } from '@/lib/pdf'
import { INSTRUCOES_SISTEMA, montarPedido } from './prompt'
import { anthropic, gemini, mensagemErroHttp, openai, PROVEDORES } from './provedores'
import { criarRascunhos } from './rascunhos'
import { JSON_SCHEMA_RESPOSTA, lerRespostaIA, paraEsquemaGemini, type RespostaIA } from './resposta'

const respostaValida: RespostaIA = {
  prescricoes: [
    {
      titulo: 'Situação Teste A',
      categoria: 'categoria teste a',
      tags: ['tag teste', 'Tag Teste'],
      itens: [
        { texto: 'Medicamento Teste A', alternativas: [{ motivo: 'Motivo Teste', texto: 'Medicamento Teste B' }] },
        { texto: 'Medicamento Teste C', alternativas: [] },
      ],
      alertas: [
        { tipo: 'atencao', gravidade: 'critico', texto: 'Alerta Teste Geral', item: 0 },
        { tipo: 'interacao', gravidade: 'atencao', texto: 'Alerta Teste Item 2', item: 2 },
        { tipo: 'outro', gravidade: 'informativo', texto: 'Alerta Teste Item Inexistente', item: 7 },
      ],
      observacoes: 'Observação Teste',
      referencia: 'Referência Teste',
      duvidas: ['Dúvida Teste'],
    },
    {
      titulo: 'Situação Teste B',
      categoria: 'Categoria Que Não Existe',
      tags: [],
      itens: [{ texto: 'Medicamento Teste D', alternativas: [] }],
      alertas: [],
      observacoes: '',
      referencia: '',
      duvidas: [],
    },
  ],
  duvidas: ['Dúvida Geral Teste'],
}

const pedido = { pdfBase64: 'QUJD', pedido: 'Pedido Teste', modelo: 'modelo-teste', chave: 'chave-teste' }
const corpo = (init: RequestInit) => JSON.parse(String(init.body))

describe('provedores: montagem da requisição', () => {
  it('Gemini: generateContent com PDF inline, esquema e chave no cabeçalho', () => {
    const { url, init } = gemini.montarRequisicao(pedido)
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/modelo-teste:generateContent')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('chave-teste')
    const b = corpo(init)
    expect(b.contents[0].parts[0].inline_data).toEqual({ mime_type: 'application/pdf', data: 'QUJD' })
    expect(b.contents[0].parts[1].text).toBe('Pedido Teste')
    expect(b.systemInstruction.parts[0].text).toBe(INSTRUCOES_SISTEMA)
    expect(b.generationConfig.responseMimeType).toBe('application/json')
    expect(b.generationConfig.responseSchema.type).toBe('OBJECT')
  })

  it('Claude: documento base64, cabeçalhos de versão/navegador e saída estruturada', () => {
    const { url, init } = anthropic.montarRequisicao(pedido)
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.headers).toMatchObject({
      'x-api-key': 'chave-teste',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    })
    const b = corpo(init)
    expect(b.model).toBe('modelo-teste')
    expect(b.messages[0].content[0]).toEqual({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'QUJD' } })
    expect(b.output_config.format).toEqual({ type: 'json_schema', schema: JSON_SCHEMA_RESPOSTA })
    expect(b.system).toBe(INSTRUCOES_SISTEMA)
  })

  it('ChatGPT: input_file com data URI, Bearer e json_schema strict', () => {
    const { url, init } = openai.montarRequisicao(pedido)
    expect(url).toBe('https://api.openai.com/v1/responses')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer chave-teste')
    const b = corpo(init)
    expect(b.input[0].content[0]).toEqual({ type: 'input_file', filename: 'documento.pdf', file_data: 'data:application/pdf;base64,QUJD' })
    expect(b.text.format).toMatchObject({ type: 'json_schema', strict: true, schema: JSON_SCHEMA_RESPOSTA })
  })

  it('todos têm link para obter a chave e modelo padrão na lista', () => {
    for (const p of Object.values(PROVEDORES)) {
      expect(p.linkChave).toMatch(/^https:\/\//)
      expect(p.modelos.map((m) => m.id)).toContain(p.modeloPadrao)
    }
  })

  it('pedido cita o intervalo de páginas', () => {
    expect(montarPedido({ de: 3, ate: 5 })).toContain('páginas 3 a 5')
    expect(montarPedido(null)).not.toContain('páginas')
  })
})

describe('provedores: leitura da resposta', () => {
  it('Gemini', () => {
    expect(gemini.lerResposta({ candidates: [{ content: { parts: [{ text: '{"a":' }, { text: '1}' }] }, finishReason: 'STOP' }] })).toEqual({ ok: true, texto: '{"a":1}' })
    expect(gemini.lerResposta({ promptFeedback: { blockReason: 'SAFETY' } }).ok).toBe(false)
    expect(gemini.lerResposta({ candidates: [{ content: { parts: [] }, finishReason: 'MAX_TOKENS' }] })).toMatchObject({ ok: false, erro: expect.stringMatching(/cortada/) })
  })

  it('Claude', () => {
    expect(anthropic.lerResposta({ content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn' })).toEqual({ ok: true, texto: '{}' })
    expect(anthropic.lerResposta({ content: [], stop_reason: 'refusal' })).toMatchObject({ ok: false })
    expect(anthropic.lerResposta({ content: [{ type: 'text', text: '{' }], stop_reason: 'max_tokens' })).toMatchObject({ ok: false, erro: expect.stringMatching(/cortada/) })
  })

  it('ChatGPT', () => {
    const msg = (content: unknown[]) => ({ status: 'completed', output: [{ type: 'reasoning' }, { type: 'message', content }] })
    expect(openai.lerResposta(msg([{ type: 'output_text', text: '{}' }]))).toEqual({ ok: true, texto: '{}' })
    expect(openai.lerResposta(msg([{ type: 'refusal', refusal: 'não' }]))).toMatchObject({ ok: false })
    expect(openai.lerResposta({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } })).toMatchObject({ ok: false, erro: expect.stringMatching(/cortada/) })
  })

  it('mensagens de erro HTTP legíveis', () => {
    expect(mensagemErroHttp(openai, 401, { error: { message: 'Incorrect API key' } })).toBe(
      'ChatGPT (OpenAI): Chave de API inválida ou sem permissão (Incorrect API key).',
    )
    expect(mensagemErroHttp(gemini, 404, null)).toMatch(/Modelo não encontrado/)
    expect(mensagemErroHttp(anthropic, 429, null)).toMatch(/Limite de uso/)
  })
})

describe('validação da resposta da IA', () => {
  it('aceita resposta válida, inclusive cercada por ```json', () => {
    expect(lerRespostaIA(JSON.stringify(respostaValida)).ok).toBe(true)
    expect(lerRespostaIA('```json\n' + JSON.stringify(respostaValida) + '\n```').ok).toBe(true)
  })

  it('recusa JSON inválido e formato errado com mensagem', () => {
    expect(lerRespostaIA('não é json')).toEqual({ ok: false, erro: 'A IA não devolveu um JSON válido.' })
    const errado = { ...respostaValida, prescricoes: [{ ...respostaValida.prescricoes[0], alertas: [{ tipo: 'inventado', gravidade: 'atencao', texto: 'x', item: 0 }] }] }
    const r = lerRespostaIA(JSON.stringify(errado))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/prescricoes\.0\.alertas\.0\.tipo/)
  })

  it('esquema do Gemini: tipos em maiúsculas e sem additionalProperties', () => {
    const g = JSON.stringify(paraEsquemaGemini(JSON_SCHEMA_RESPOSTA))
    expect(g).not.toContain('additionalProperties')
    expect(g).toContain('"type":"ARRAY"')
    expect(g).not.toContain('"type":"object"')
  })
})

describe('rascunhos a partir da resposta', () => {
  let n = 0
  const id = () => `id-${++n}`
  const rascunhos = criarRascunhos(respostaValida, [categoriaTeste({ id: 'cat-a', nome: 'Categoria Teste A' })], id)

  it('categoria igual (sem maiúsculas/acentos) já vem selecionada; senão fica sem categoria', () => {
    expect(rascunhos[0]!.dados.categoriaId).toBe('cat-a')
    expect(rascunhos[1]!.dados.categoriaId).toBeNull()
    expect(rascunhos[1]!.categoriaSugerida).toBe('Categoria Que Não Existe')
  })

  it('marca como importada e não revisada, sem regra de dose, com dúvidas da prescrição', () => {
    const d = rascunhos[0]!.dados
    expect(d.origem).toBe('importada_ia')
    expect(d.revisada).toBe(false)
    expect(d.itens.every((i) => i.regraDose === null && i.alternativas.every((a) => a.regraDose === null))).toBe(true)
    expect(d.duvidasImportacao[0]).toBe('Dúvida Teste')
    expect(d.tags).toEqual(['tag teste'])
  })

  it('liga alertas aos itens; item inexistente vira alerta geral + dúvida', () => {
    const d = rascunhos[0]!.dados
    expect(d.alertas[0]!.itemId).toBeNull()
    expect(d.alertas[1]!.itemId).toBe(d.itens[1]!.id)
    expect(d.alertas[2]!.itemId).toBeNull()
    expect(d.duvidasImportacao.some((x) => x.includes('item 7'))).toBe(true)
  })

  it('aprovação aceita "Sem categoria" só com a opção da importação', () => {
    const d = rascunhos[1]!.dados
    expect(validarPrescricao(d, () => true)).toContain('Escolha a categoria.')
    expect(validarPrescricao(d, () => true, { aceitarSemCategoria: true })).toEqual([])
  })
})

describe('envio (rede simulada)', () => {
  const pdf = new Uint8Array([1, 2, 3])
  const base = { pdf, intervalo: null, modelo: 'modelo-teste', chave: 'chave-teste', sinal: new AbortController().signal }

  it('sucesso devolve a resposta validada', async () => {
    const falso = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(respostaValida) }] }), { status: 200 }))
    const r = await enviarParaIA(anthropic, base, falso)
    expect(r.ok).toBe(true)
    expect(falso).toHaveBeenCalledOnce()
  })

  it('erro HTTP vira mensagem legível', async () => {
    const falso = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'chave ruim' } }), { status: 401 }))
    expect(await enviarParaIA(openai, base, falso)).toEqual({ ok: false, erro: 'ChatGPT (OpenAI): Chave de API inválida ou sem permissão (chave ruim).' })
  })

  it('cancelamento e falta de rede', async () => {
    const cancelado = vi.fn(async () => {
      throw new DOMException('cancelado', 'AbortError')
    })
    expect(await enviarParaIA(gemini, base, cancelado)).toEqual({ ok: false, erro: 'Envio cancelado.' })
    const semRede = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect((await enviarParaIA(gemini, base, semRede)).ok).toBe(false)
  })
})

describe('PDF no aparelho', () => {
  async function pdfDe(paginas: number) {
    const doc = await PDFDocument.create()
    for (let i = 0; i < paginas; i++) doc.addPage()
    return doc.save()
  }

  it('conta páginas e recorta intervalo', async () => {
    const bytes = await pdfDe(5)
    expect(await contarPaginas(bytes)).toBe(5)
    expect(await contarPaginas(await recortarPaginas(bytes, 2, 4))).toBe(3)
  })

  it('arquivo que não é PDF dá erro legível', async () => {
    await expect(contarPaginas(new Uint8Array([1, 2, 3]))).rejects.toThrow('Não foi possível ler o PDF.')
  })

  it('base64 confere com o padrão', () => {
    // 'Plantão' em UTF-8, conferido com btoa sobre os bytes
    expect(paraBase64(new TextEncoder().encode('Plantão'))).toBe('UGxhbnTDo28=')
  })
})
