/**
 * Compartilhar prescrições com colegas. O pacote (um backup só com o que foi escolhido) é comprimido e
 * cifrado no aparelho com uma chave derivada do código; o servidor guarda só o texto cifrado, por 7 dias.
 * Quem tem o código baixa o pacote, vê o que mudaria e mescla.
 */
import { cifrarBytes, decifrarBytes, derivarChave } from '@/dominio/anamnese/cifra'
import { lerBackup, type LeituraBackup } from '@/dominio/backup/backup'
import type { ArquivoBackup } from '@/dominio/tipos'
import { buscarResultado, criarSessao, encerrarSessao, enviarResultado, entrarSessao, SessaoEncerradaError } from '@/lib/anamnese/sessao'
import { comprimirTexto, descomprimirTexto } from './compressao'

/** Limite do servidor para o corpo enviado (ver worker/sessoes.js). */
const LIMITE_ENVELOPE_BYTES = 1024 * 1024

const normalizar = (codigo: string) => codigo.toUpperCase().replace(/[^A-Z0-9]/g, '')

export interface Compartilhamento {
  id: string
  /** Como mostrar e digitar: XXXX-XXXX. */
  codigo: string
  expiraEm: Date
}

export async function publicarPacote(pacote: ArquivoBackup): Promise<Compartilhamento> {
  const comprimido = await comprimirTexto(JSON.stringify(pacote))
  // Base64 do texto cifrado ocupa cerca de 4/3 dos bytes (mais o IV): confere antes de criar a sessão.
  if (Math.ceil((comprimido.length + 16) * (4 / 3)) + 100 > LIMITE_ENVELOPE_BYTES) {
    throw new Error('O pacote ficou grande demais para enviar. Escolha menos prescrições.')
  }
  const sessao = await criarSessao('compartilhamento')
  try {
    const chave = await derivarChave(normalizar(sessao.codigo), sessao.salt)
    await enviarResultado(sessao.id, await cifrarBytes(comprimido, chave))
  } catch (erro) {
    await encerrarSessao(sessao.id)
    throw erro
  }
  return { id: sessao.id, codigo: sessao.codigo, expiraEm: new Date(Date.now() + sessao.expiraEmSegundos * 1000) }
}

/** Baixa o pacote com o código recebido. Erros em português, prontos para mostrar. */
export async function baixarPacote(codigoDigitado: string): Promise<LeituraBackup> {
  const codigo = normalizar(codigoDigitado)
  const sessao = await entrarSessao(codigo)
  const chave = await derivarChave(codigo, sessao.salt)
  let envelope
  try {
    envelope = await buscarResultado(sessao.id, 0)
  } catch (erro) {
    if (erro instanceof SessaoEncerradaError) throw new Error('Este compartilhamento foi cancelado ou expirou.')
    throw erro
  }
  if (!envelope) throw new Error('O pacote ainda não foi enviado. Tente de novo em instantes.')
  const bytes = await decifrarBytes(envelope, chave)
  if (!bytes) throw new Error('Não consegui abrir o pacote com este código.')
  try {
    return lerBackup(await descomprimirTexto(bytes))
  } catch {
    return { ok: false, erro: 'O pacote recebido está corrompido.' }
  }
}

/** Quem enviou cancela: o código deixa de valer na hora. */
export async function cancelarCompartilhamento(id: string): Promise<void> {
  await encerrarSessao(id)
}
