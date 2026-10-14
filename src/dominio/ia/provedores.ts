import type { IdProvedor } from '@/dominio/tipos'
import { INSTRUCOES_SISTEMA } from './prompt'
import { JSON_SCHEMA_RESPOSTA, paraEsquemaGemini } from './resposta'

/**
 * Cada provedor fica atrás da mesma interface (montar requisição / ler resposta),
 * para trocar sem mexer no resto. Valores conferidos na documentação oficial em 14/10/2026.
 */
export interface ProvedorIA {
  id: IdProvedor
  nome: string
  /** Página onde o usuário gera a chave de API. */
  linkChave: string
  modelos: { id: string; rotulo: string }[]
  modeloPadrao: string
  /** Tamanho máximo do PDF (bytes, já descontado o aumento do base64) e de páginas (null = não informado). */
  limites: { bytesPdf: number; paginas: number | null; descricao: string }
  montarRequisicao(p: { pdfBase64: string; pedido: string; modelo: string; chave: string }): { url: string; init: RequestInit }
  /** Extrai o texto gerado; erro legível se a API recusou/cortou a resposta. */
  lerResposta(json: unknown): { ok: true; texto: string } | { ok: false; erro: string }
}

const MB = 1024 * 1024
/** O base64 aumenta ~33%: limite de requisição × 3/4, com folga para o restante do corpo. */
const pdfCabeEm = (requisicaoBytes: number) => Math.floor(((requisicaoBytes - 0.5 * MB) * 3) / 4)

const MAX_SAIDA_TOKENS = 32000

type Obj = Record<string, unknown>
const obj = (x: unknown): Obj => (x && typeof x === 'object' ? (x as Obj) : {})
const lista = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])

// ===== Gemini (Google) — v1beta generateContent =====
export const gemini: ProvedorIA = {
  id: 'gemini',
  nome: 'Gemini (Google)',
  linkChave: 'https://aistudio.google.com/apikey',
  modelos: [
    { id: 'gemini-3.8-flash', rotulo: 'Gemini 3.8 Flash (equilíbrio)' },
    { id: 'gemini-3.5-flash-lite', rotulo: 'Gemini 3.5 Flash-Lite (mais barato)' },
    { id: 'gemini-4-argon', rotulo: 'Gemini 4 Argon (mais capaz)' },
  ],
  modeloPadrao: 'gemini-3.8-flash',
  limites: { bytesPdf: 50 * MB, paginas: 1000, descricao: 'até 50 MB e 1000 páginas' },
  montarRequisicao({ pdfBase64, pedido, modelo, chave }) {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: INSTRUCOES_SISTEMA }] },
          contents: [
            {
              role: 'user',
              parts: [{ inline_data: { mime_type: 'application/pdf', data: pdfBase64 } }, { text: pedido }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: paraEsquemaGemini(JSON_SCHEMA_RESPOSTA),
            maxOutputTokens: MAX_SAIDA_TOKENS,
            temperature: 0,
          },
        }),
      },
    }
  },
  lerResposta(json) {
    const bloqueio = obj(obj(json).promptFeedback).blockReason
    if (bloqueio) return { ok: false, erro: `O Gemini bloqueou o pedido (${String(bloqueio)}).` }
    const candidato = obj(lista(obj(json).candidates)[0])
    const fim = candidato.finishReason
    if (fim === 'MAX_TOKENS') return { ok: false, erro: 'A resposta do Gemini foi cortada (muito longa). Tente um intervalo menor de páginas.' }
    const texto = lista(obj(candidato.content).parts)
      .map((p) => obj(p).text)
      .filter((t): t is string => typeof t === 'string')
      .join('')
    if (!texto) return { ok: false, erro: `O Gemini não devolveu texto${fim ? ` (${String(fim)})` : ''}.` }
    return { ok: true, texto }
  },
}

// ===== Claude (Anthropic) — Messages API =====
export const anthropic: ProvedorIA = {
  id: 'anthropic',
  nome: 'Claude (Anthropic)',
  linkChave: 'https://platform.claude.com/settings/keys',
  modelos: [
    { id: 'claude-sonnet-5-5', rotulo: 'Claude Sonnet 5.5 (equilíbrio)' },
    { id: 'claude-haiku-5-5', rotulo: 'Claude Haiku 5.5 (mais barato)' },
    { id: 'claude-opus-5-5', rotulo: 'Claude Opus 5.5 (mais capaz)' },
  ],
  modeloPadrao: 'claude-sonnet-5-5',
  // 32 MB por requisição; 600 páginas nos modelos atuais (contexto de 1M; 100 em contexto menor).
  limites: { bytesPdf: pdfCabeEm(32 * MB), paginas: 600, descricao: 'PDF até ~23 MB (requisição de 32 MB) e 600 páginas' },
  montarRequisicao({ pdfBase64, pedido, modelo, chave }) {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': chave,
          'anthropic-version': '2023-06-01',
          // Chamada direta do navegador (chave do próprio usuário, só no aparelho dele).
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: modelo,
          max_tokens: MAX_SAIDA_TOKENS,
          system: INSTRUCOES_SISTEMA,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
                { type: 'text', text: pedido },
              ],
            },
          ],
          output_config: { format: { type: 'json_schema', schema: JSON_SCHEMA_RESPOSTA } },
        }),
      },
    }
  },
  lerResposta(json) {
    const r = obj(json)
    if (r.stop_reason === 'refusal') return { ok: false, erro: 'O Claude recusou o pedido.' }
    if (r.stop_reason === 'max_tokens') return { ok: false, erro: 'A resposta do Claude foi cortada (muito longa). Tente um intervalo menor de páginas.' }
    const texto = lista(r.content)
      .filter((b) => obj(b).type === 'text')
      .map((b) => String(obj(b).text ?? ''))
      .join('')
    return texto ? { ok: true, texto } : { ok: false, erro: 'O Claude não devolveu texto.' }
  },
}

// ===== ChatGPT (OpenAI) — Responses API =====
export const openai: ProvedorIA = {
  id: 'openai',
  nome: 'ChatGPT (OpenAI)',
  linkChave: 'https://platform.openai.com/api-keys',
  modelos: [
    { id: 'gpt-6.1-sol', rotulo: 'GPT-6.1 Sol (equilíbrio)' },
    { id: 'gpt-6-luna', rotulo: 'GPT-6 Luna (mais barato)' },
    { id: 'gpt-6-astra', rotulo: 'GPT-6 Astra (mais capaz)' },
  ],
  modeloPadrao: 'gpt-6.1-sol',
  // 50 MB por arquivo e por requisição; a documentação não informa limite de páginas.
  limites: { bytesPdf: pdfCabeEm(50 * MB), paginas: null, descricao: 'PDF até ~37 MB (requisição de 50 MB)' },
  montarRequisicao({ pdfBase64, pedido, modelo, chave }) {
    return {
      url: 'https://api.openai.com/v1/responses',
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
        body: JSON.stringify({
          model: modelo,
          instructions: INSTRUCOES_SISTEMA,
          max_output_tokens: MAX_SAIDA_TOKENS,
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_file', filename: 'documento.pdf', file_data: `data:application/pdf;base64,${pdfBase64}` },
                { type: 'input_text', text: pedido },
              ],
            },
          ],
          text: { format: { type: 'json_schema', name: 'prescricoes', schema: JSON_SCHEMA_RESPOSTA, strict: true } },
        }),
      },
    }
  },
  lerResposta(json) {
    const r = obj(json)
    if (r.status === 'incomplete') {
      const motivo = obj(r.incomplete_details).reason
      return {
        ok: false,
        erro: motivo === 'max_output_tokens'
          ? 'A resposta do ChatGPT foi cortada (muito longa). Tente um intervalo menor de páginas.'
          : `A resposta do ChatGPT ficou incompleta${motivo ? ` (${String(motivo)})` : ''}.`,
      }
    }
    const partes = lista(r.output)
      .filter((i) => obj(i).type === 'message')
      .flatMap((i) => lista(obj(i).content))
    const recusa = partes.find((p) => obj(p).type === 'refusal')
    if (recusa) return { ok: false, erro: `O ChatGPT recusou o pedido: ${String(obj(recusa).refusal ?? '')}` }
    const texto = partes
      .filter((p) => obj(p).type === 'output_text')
      .map((p) => String(obj(p).text ?? ''))
      .join('')
    return texto ? { ok: true, texto } : { ok: false, erro: 'O ChatGPT não devolveu texto.' }
  },
}

export const PROVEDORES: Record<IdProvedor, ProvedorIA> = { gemini, anthropic, openai }

/** Mensagem legível para erros HTTP comuns das três APIs. */
export function mensagemErroHttp(provedor: ProvedorIA, status: number, corpo: unknown): string {
  const detalhe = obj(obj(corpo).error).message
  const base =
    status === 400
      ? 'Pedido recusado pela API'
      : status === 401 || status === 403
        ? 'Chave de API inválida ou sem permissão'
        : status === 404
          ? 'Modelo não encontrado — confira o nome do modelo em Ajustes'
          : status === 413
            ? 'PDF grande demais para a API — use um intervalo menor de páginas'
            : status === 429
              ? 'Limite de uso da API atingido — aguarde e tente de novo'
              : status >= 500
                ? 'O serviço da IA está com problema — tente de novo mais tarde'
                : `Erro ${status}`
  return `${provedor.nome}: ${base}${typeof detalhe === 'string' && detalhe ? ` (${detalhe})` : ''}.`
}
