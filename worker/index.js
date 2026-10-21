import { criarRotasSessoes } from './sessoes.js'

/** Entrada do Worker: API de sessões em /api/sessoes; o resto é o app (arquivos estáticos). */
export default {
  async fetch(req, env) {
    const tratar = criarRotasSessoes(env.SESSOES)
    const resposta = await tratar(req)
    if (resposta) return resposta
    return env.ASSETS.fetch(req)
  },
}
