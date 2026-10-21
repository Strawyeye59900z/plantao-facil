/**
 * Estado da sincronização entre celular e PC. Vive só na memória da aba: trocar de aba mantém os dados,
 * mas fechar ou recarregar o app apaga tudo. Nada é guardado em disco.
 */
import { computed, ref, watch } from 'vue'
import { blocoVazio, lerBloco, type Bloco } from '@/dominio/anamnese/bloco'
import { cifrar, decifrar, derivarChave } from '@/dominio/anamnese/cifra'
import { buscarResultado, criarSessao, encerrarSessao, enviarResultado, entrarSessao } from './sessao'

interface SessaoAtiva {
  id: string
  chave: CryptoKey
}

const normalizar = (codigo: string) => codigo.toUpperCase().replace(/[^A-Z0-9]/g, '')

// ----- Celular -----
const sessaoCelular = ref<SessaoAtiva | null>(null)
export const celular = {
  bloco: ref<Bloco>(blocoVazio()),
  sessao: sessaoCelular,
  erro: ref<string | null>(null),
  aviso: ref<string | null>(null),
  conectado: computed(() => sessaoCelular.value !== null),
}

export async function conectarCelular(codigoDigitado: string): Promise<void> {
  celular.erro.value = null
  const codigo = normalizar(codigoDigitado)
  try {
    const sessao = await entrarSessao(codigo)
    const chave = await derivarChave(codigo, sessao.salt)
    celular.sessao.value = { id: sessao.id, chave }
    celular.aviso.value = 'Conectado ao PC.'
  } catch (falha) {
    celular.erro.value = falha instanceof Error ? falha.message : String(falha)
  }
}

export function desconectarCelular(): void {
  celular.sessao.value = null
  celular.aviso.value = null
}

/** Envia o bloco inteiro cifrado. O PC sempre recebe a versão mais recente. */
export async function sincronizarCelular(): Promise<void> {
  const sessao = celular.sessao.value
  if (!sessao) return
  celular.erro.value = null
  try {
    const envelope = await cifrar(JSON.stringify(celular.bloco.value), sessao.chave)
    await enviarResultado(sessao.id, envelope)
    celular.aviso.value = `Sincronizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`
  } catch (falha) {
    celular.erro.value = falha instanceof Error ? falha.message : String(falha)
  }
}

// Toda alteração no bloco vai para o PC na hora, sem depender do botão "Sincronizar".
watch(celular.bloco, () => {
  if (celular.conectado.value) void sincronizarCelular()
}, { deep: true })

// ----- PC -----
export const pc = {
  bloco: ref<Bloco | null>(null),
  codigo: ref<string | null>(null),
  sessao: ref<SessaoAtiva | null>(null),
  erro: ref<string | null>(null),
  status: ref('Gerando código…'),
}

let relogioPc: number | undefined
let ultimaVersao = 0

async function verificarPc(): Promise<void> {
  const sessao = pc.sessao.value
  if (!sessao) return
  try {
    const envelope = await buscarResultado(sessao.id, ultimaVersao)
    if (!envelope) return
    const claro = await decifrar(envelope, sessao.chave)
    const bloco = claro === null ? null : lerBloco(JSON.parse(claro))
    if (!bloco) {
      pc.erro.value = 'Não consegui ler o bloco recebido. Sincronize de novo pelo celular.'
      return
    }
    ultimaVersao = envelope.versao
    pc.bloco.value = bloco
    pc.erro.value = null
    pc.status.value = `Bloco atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`
  } catch (falha) {
    pc.erro.value = falha instanceof Error ? falha.message : String(falha)
  }
}

/** Gera um código novo. Antes de criar, a sessão anterior é encerrada. */
export async function gerarCodigoPc(): Promise<void> {
  clearInterval(relogioPc)
  if (pc.sessao.value) await encerrarSessao(pc.sessao.value.id)
  pc.erro.value = null
  pc.bloco.value = null
  pc.status.value = 'Gerando código…'
  try {
    const criada = await criarSessao()
    const codigo = criada.codigo.replace('-', '')
    ultimaVersao = 0
    pc.codigo.value = criada.codigo
    pc.sessao.value = { id: criada.id, chave: await derivarChave(codigo, criada.salt) }
    pc.status.value = 'Digite este código no celular. Ele vale por 12 horas sem uso.'
    relogioPc = window.setInterval(verificarPc, 3000)
  } catch (falha) {
    pc.erro.value = falha instanceof Error ? falha.message : String(falha)
  }
}

/** Mantém a sincronização ativa: só cria um código se ainda não houver um. */
export async function garantirCodigoPc(): Promise<void> {
  if (!pc.sessao.value) await gerarCodigoPc()
}

