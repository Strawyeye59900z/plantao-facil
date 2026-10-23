/**
 * Biblioteca de prescrições entre o PC e o celular do mesmo médico, pela sessão do código de sincronização
 * da transcrição (canal "biblioteca"). Funciona nos dois sentidos: quem toca em "Enviar" deixa o pacote na
 * sessão; o outro aparelho toca em "Receber", vê a pré-visualização e mescla. Comprimido e cifrado como o resto.
 */
import { cifrarBytes, decifrarBytes } from '@/dominio/anamnese/cifra'
import { lerBackup, montarBackup, type LeituraBackup } from '@/dominio/backup/backup'
import { lerBiblioteca } from '@/db/backup'
import { buscarResultado, enviarResultado, SessaoEncerradaError } from '@/lib/anamnese/sessao'
import { comprimirTexto, descomprimirTexto } from './compressao'

export interface SessaoSincronizacao {
  id: string
  chave: CryptoKey
}

/** Limite do servidor para o corpo enviado (ver worker/sessoes.js). */
const LIMITE_ENVELOPE_BYTES = 1024 * 1024

/** Envia a biblioteca inteira deste aparelho (inclusive a lixeira, para exclusões também chegarem). */
export async function enviarBiblioteca(sessao: SessaoSincronizacao): Promise<void> {
  const pacote = montarBackup(await lerBiblioteca(), new Date().toISOString(), __APP_VERSION__)
  const comprimido = await comprimirTexto(JSON.stringify(pacote))
  if (Math.ceil((comprimido.length + 16) * (4 / 3)) + 100 > LIMITE_ENVELOPE_BYTES) {
    throw new Error('A biblioteca ficou grande demais para enviar de uma vez. Use o backup em arquivo.')
  }
  try {
    await enviarResultado(sessao.id, await cifrarBytes(comprimido, sessao.chave), 'biblioteca')
  } catch (erro) {
    if (erro instanceof SessaoEncerradaError) throw new Error('A sincronização foi encerrada. Gere ou digite o código de novo.')
    throw erro
  }
}

/** Busca o último pacote deixado pelo outro aparelho; null se ele ainda não enviou. */
export async function receberBiblioteca(sessao: SessaoSincronizacao): Promise<LeituraBackup | null> {
  let envelope
  try {
    envelope = await buscarResultado(sessao.id, 0, 'biblioteca')
  } catch (erro) {
    if (erro instanceof SessaoEncerradaError) throw new Error('A sincronização foi encerrada. Gere ou digite o código de novo.')
    throw erro
  }
  if (!envelope) return null
  const bytes = await decifrarBytes(envelope, sessao.chave)
  if (!bytes) throw new Error('Não consegui abrir o pacote. Confira se os dois aparelhos usam o mesmo código.')
  try {
    return lerBackup(await descomprimirTexto(bytes))
  } catch {
    return { ok: false, erro: 'O pacote recebido está corrompido.' }
  }
}
