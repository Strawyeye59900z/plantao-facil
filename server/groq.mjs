/** Provedor de transcrição: Groq, com o Whisper large-v3 (mais fiel). Só o servidor conhece a chave. */
export const URL_GROQ = 'https://api.groq.com/openai/v1/audio/transcriptions'
export const MODELO_PADRAO = 'whisper-large-v3'
export const TIMEOUT_MS = 45_000

export function criarTranscritorGroq({ chave, modelo = MODELO_PADRAO, fetchFn = fetch }) {
  return async function transcrever(wav) {
    const formulario = new FormData()
    formulario.append('file', new Blob([wav], { type: 'audio/wav' }), 'bloco.wav')
    formulario.append('model', modelo)
    formulario.append('language', 'pt')
    formulario.append('response_format', 'json')
    formulario.append('temperature', '0')

    const resposta = await fetchFn(URL_GROQ, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}` },
      body: formulario,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    // Erro sem o corpo da resposta: o corpo pode repetir trechos do áudio.
    if (!resposta.ok) throw new Error(`Groq respondeu ${resposta.status}`)
    const dados = await resposta.json()
    return String(dados.text ?? '').trim()
  }
}
