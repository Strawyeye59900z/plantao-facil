/** Tela mostrada quando o banco do aparelho não abre (ex.: a atualização do Dexie falhou). */
export const MENSAGEM_FALHA_ABERTURA =
  'Não foi possível atualizar os dados deste aparelho. Seus dados continuam guardados como estavam. Tente recarregar; se continuar, procure ajuda antes de apagar dados do navegador.'

export type ResultadoAbertura = { ok: true } | { ok: false; erro: unknown }

/**
 * Roda os carregamentos da abertura (stores) juntos. Nunca lança: se algum for recusado
 * (banco não abriu, atualização desfeita), devolve `ok: false` para o app mostrar a tela de falha.
 */
export async function carregarAoAbrir(carregamentos: (() => Promise<unknown>)[]): Promise<ResultadoAbertura> {
  try {
    await Promise.all(carregamentos.map((carregar) => carregar()))
    return { ok: true }
  } catch (erro) {
    return { ok: false, erro }
  }
}
