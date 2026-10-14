import * as v from 'valibot'
import { descreverProblemas } from '@/dominio/texto/validacao'

/**
 * Formato que a IA deve devolver (pedido no prompt e na saída estruturada de cada provedor)
 * e validado ao chegar. Sem campos opcionais/nulos para funcionar nos três provedores:
 * `item` do alerta = 0 (prescrição inteira) ou número do item (1, 2, …).
 * Dose sempre como texto dentro do item (decisão do usuário: a IA não preenche regra de dose).
 */
const TIPOS_ALERTA = ['contraindicacao', 'ajuste_renal', 'gestacao', 'interacao', 'atencao', 'outro'] as const
const GRAVIDADES = ['informativo', 'atencao', 'critico'] as const

export const esquemaRespostaIA = v.object({
  prescricoes: v.array(
    v.object({
      titulo: v.string(),
      categoria: v.string(),
      tags: v.array(v.string()),
      itens: v.array(
        v.object({
          texto: v.string(),
          alternativas: v.array(v.object({ motivo: v.string(), texto: v.string() })),
        }),
      ),
      alertas: v.array(
        v.object({
          tipo: v.picklist(TIPOS_ALERTA),
          gravidade: v.picklist(GRAVIDADES),
          texto: v.string(),
          item: v.pipe(v.number(), v.integer(), v.minValue(0)),
        }),
      ),
      observacoes: v.string(),
      referencia: v.string(),
      duvidas: v.array(v.string()),
    }),
  ),
  duvidas: v.array(v.string()),
})

export type RespostaIA = v.InferOutput<typeof esquemaRespostaIA>

/** O mesmo formato em JSON Schema padrão (Claude e ChatGPT; o Gemini usa uma conversão). */
const texto = { type: 'string' }
const listaTexto = { type: 'array', items: texto }
const objeto = (propriedades: Record<string, unknown>) => ({
  type: 'object',
  properties: propriedades,
  required: Object.keys(propriedades),
  additionalProperties: false,
})

export const JSON_SCHEMA_RESPOSTA = objeto({
  prescricoes: {
    type: 'array',
    items: objeto({
      titulo: texto,
      categoria: texto,
      tags: listaTexto,
      itens: {
        type: 'array',
        items: objeto({
          texto,
          alternativas: { type: 'array', items: objeto({ motivo: texto, texto }) },
        }),
      },
      alertas: {
        type: 'array',
        items: objeto({
          tipo: { type: 'string', enum: [...TIPOS_ALERTA] },
          gravidade: { type: 'string', enum: [...GRAVIDADES] },
          texto,
          item: { type: 'integer' },
        }),
      },
      observacoes: texto,
      referencia: texto,
      duvidas: listaTexto,
    }),
  },
  duvidas: listaTexto,
})

/**
 * Converte para o `responseSchema` do Gemini (subconjunto OpenAPI): tipos em maiúsculas
 * e sem `additionalProperties` (não aceito pelo Gemini).
 */
export function paraEsquemaGemini(esquema: unknown): unknown {
  if (Array.isArray(esquema)) return esquema.map(paraEsquemaGemini)
  if (!esquema || typeof esquema !== 'object') return esquema
  const saida: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(esquema)) {
    if (chave === 'additionalProperties') continue
    if (chave === 'type' && typeof valor === 'string') saida.type = valor.toUpperCase()
    else saida[chave] = paraEsquemaGemini(valor)
  }
  return saida
}

export type LeituraRespostaIA = { ok: true; resposta: RespostaIA } | { ok: false; erro: string }

/** Lê o texto devolvido pela IA (aceita JSON cercado por ```json … ```) e valida o formato. */
export function lerRespostaIA(textoBruto: string): LeituraRespostaIA {
  const limpo = textoBruto
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  let json: unknown
  try {
    json = JSON.parse(limpo)
  } catch {
    return { ok: false, erro: 'A IA não devolveu um JSON válido.' }
  }
  const r = v.safeParse(esquemaRespostaIA, json)
  if (!r.success) {
    const detalhes = descreverProblemas(r.issues)
    return { ok: false, erro: `A resposta da IA veio fora do formato esperado (${detalhes}).` }
  }
  return { ok: true, resposta: r.output }
}
