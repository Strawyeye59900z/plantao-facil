import { criarRotasSessoes } from './sessoes.js'

export { Entrada, Limitador, Sessao } from './objetos.js'

/** Entrada do Worker: API de sessões em /api/sessoes; o resto é o app (arquivos estáticos). */
export default {
  async fetch(req, env) {
    const objeto = (ligacao) => (nome) => ligacao.get(ligacao.idFromName(nome))
    const tratar = criarRotasSessoes(
      { sessao: objeto(env.SESSAO), entrada: objeto(env.ENTRADA), limitador: objeto(env.LIMITADOR) },
      { ipDe: (r) => r.headers.get('CF-Connecting-IP') ?? 'desconhecido' },
    )
    const resposta = await tratar(req)
    if (resposta) return resposta
    return env.ASSETS.fetch(req)
  },
}
