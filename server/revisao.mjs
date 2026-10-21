/**
 * Revisão da transcrição pela IA (Groq). A IA corrige só a grafia de palavras mal reconhecidas,
 * marca doses, durações e datas em negrito, e destaca trechos duvidosos.
 * Trava: se a resposta alterar qualquer número, ela é recusada.
 */
export const URL_GROQ_CHAT = 'https://api.groq.com/openai/v1/chat/completions'
export const MODELO_TEXTO_PADRAO = 'openai/gpt-oss-120b'
export const TIMEOUT_REVISAO_MS = 120_000

export const INSTRUCOES = `Você revisa a transcrição de uma consulta médica em português do Brasil. A transcrição veio de reconhecimento de voz e pode ter palavras mal reconhecidas. Sem identificação de quem fala.

Regras obrigatórias:
1. Corrija SOMENTE a grafia de palavras que claramente foram mal reconhecidas, usando o contexto. Não reescreva frases, não resuma e não mude a ordem.
2. NUNCA altere números, doses, unidades, durações ou datas. Copie exatamente como estão.
3. NUNCA acrescente informação, não faça hipóteses diagnósticas e não complete o que não foi dito.
4. Nome de medicamento ou de doença só é corrigido quando houver certeza pelo contexto. Na dúvida, mantenha como foi dito e marque como "duvida".
5. Marque como "destaque" (negrito) o texto exato de: doses (com unidade), durações de sintomas (ex.: "há 3 dias"), e datas importantes.
6. Marque como "duvida" trechos que ficaram incompreensíveis, ambíguos ou com possível erro de reconhecimento, mantendo o texto original neles.

Responda somente com JSON neste formato:
{
  "segmentos": [ { "tipo": "texto" | "destaque" | "duvida", "texto": "..." } ],
  "mudancas": [ { "original": "...", "corrigido": "..." } ]
}
A concatenação de todos os "texto" dos segmentos, na ordem, deve formar a transcrição inteira, já com as correções. Cada "mudanca" deve aparecer também nos segmentos.`

/** Números do texto (inteiros e decimais), normalizados com ponto. Usado na trava. */
export function numerosDoTexto(texto) {
  return (texto.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/\./g, '').replace(',', '.'))
}

/** Verifica o formato da resposta e a trava de números. Devolve { ok, motivo?, resultado? }. */
export function validarRevisao(original, bruto) {
  if (!bruto || !Array.isArray(bruto.segmentos) || bruto.segmentos.length === 0) {
    return { ok: false, motivo: 'A IA não devolveu os segmentos da revisão.' }
  }
  const tipos = new Set(['texto', 'destaque', 'duvida'])
  const segmentos = []
  for (const s of bruto.segmentos) {
    if (!s || !tipos.has(s.tipo) || typeof s.texto !== 'string') {
      return { ok: false, motivo: 'Um segmento da revisão está fora do formato.' }
    }
    segmentos.push({ tipo: s.tipo, texto: s.texto })
  }
  const mudancas = Array.isArray(bruto.mudancas)
    ? bruto.mudancas.filter((m) => m && typeof m.original === 'string' && typeof m.corrigido === 'string')
    : []

  // Trava: a IA não pode criar nem alterar números. Compara como multiconjunto.
  const entrada = numerosDoTexto(original).sort()
  const saida = numerosDoTexto(segmentos.map((s) => s.texto).join('')).sort()
  if (entrada.length !== saida.length || entrada.some((n, i) => n !== saida[i])) {
    return { ok: false, motivo: 'A IA alterou números. A revisão foi descartada; use o texto original.' }
  }
  return { ok: true, resultado: { segmentos, mudancas } }
}

/** Chama o Groq e devolve a revisão validada. Lança erro se o provedor falhar. */
export function criarRevisor({ chave, modelo = MODELO_TEXTO_PADRAO, fetchFn = fetch }) {
  return async function revisar(texto) {
    const resposta = await fetchFn(URL_GROQ_CHAT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelo,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: INSTRUCOES },
          { role: 'user', content: `Transcrição:\n"""\n${texto}\n"""` },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_REVISAO_MS),
    })
    // Erro sem o corpo: o corpo repete o texto clínico.
    if (!resposta.ok) throw new Error(`Groq respondeu ${resposta.status}`)
    const dados = await resposta.json()
    let bruto
    try {
      bruto = JSON.parse(dados.choices?.[0]?.message?.content ?? '')
    } catch {
      return { ok: false, motivo: 'A IA não devolveu um JSON válido.' }
    }
    return validarRevisao(texto, bruto)
  }
}
