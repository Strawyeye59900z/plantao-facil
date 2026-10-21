import { criarApp } from './app.mjs'
import { criarTranscritorGroq } from './groq.mjs'

// Variáveis de ambiente (arquivo .env fora do repositório, veja .env.example).
const { PORT = '3100', HOST = '127.0.0.1', GROQ_API_KEY, GROQ_MODEL, ANAMNESE_TOKEN } = process.env

if (!GROQ_API_KEY) throw new Error('Defina GROQ_API_KEY no arquivo .env.')
if (!ANAMNESE_TOKEN || ANAMNESE_TOKEN.length < 32) {
  throw new Error('Defina ANAMNESE_TOKEN no .env, com pelo menos 32 caracteres.')
}

const app = criarApp({
  token: ANAMNESE_TOKEN,
  transcrever: criarTranscritorGroq({ chave: GROQ_API_KEY, modelo: GROQ_MODEL }),
})

await app.listen({ port: Number(PORT), host: HOST })
console.log(`API de anamnese em http://${HOST}:${PORT}`)
