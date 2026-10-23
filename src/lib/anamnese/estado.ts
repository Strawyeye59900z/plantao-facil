/**
 * Estado da sincronização entre celular e PC. Os dados de pacientes vivem só na memória da aba: fechar
 * ou recarregar apaga o que está na tela. Para a sessão sobreviver ao refresh, guarda-se apenas a conexão
 * (id, código e salt, ver persistencia.ts); o bloco volta do servidor, cifrado, e é decifrado com o código.
 */
import { computed, reactive, ref, watch } from 'vue'
import { blocoVazio, lerBloco, type Bloco } from '@/dominio/anamnese/bloco'
import { cifrar, decifrar, derivarChave } from '@/dominio/anamnese/cifra'
import { esquecerConexao, guardarConexao, lerConexaoGuardada, papelAtual } from './persistencia'
import { buscarResultado, criarSessao, encerrarSessao, enviarResultado, entrarSessao, SessaoEncerradaError } from './sessao'

interface SessaoAtiva {
  id: string
  chave: CryptoKey
}

const normalizar = (codigo: string) => codigo.toUpperCase().replace(/[^A-Z0-9]/g, '')
const horaAgora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

// ----- Celular -----
const sessaoCelular = ref<SessaoAtiva | null>(null)
export const celular = {
  bloco: ref<Bloco>(blocoVazio()),
  sessao: sessaoCelular,
  erro: ref<string | null>(null),
  aviso: ref<string | null>(null),
  conectado: computed(() => sessaoCelular.value !== null),
}

/** Digita o código do PC: entra na sessão e envia o bloco na hora, para o PC mostrar "Sincronizado". */
export async function conectarCelular(codigoDigitado: string): Promise<void> {
  celular.erro.value = null
  const codigo = normalizar(codigoDigitado)
  try {
    const sessao = await entrarSessao(codigo)
    const chave = await derivarChave(codigo, sessao.salt)
    celular.sessao.value = { id: sessao.id, chave }
    guardarConexao('celular', { id: sessao.id, codigo, salt: sessao.salt })
    await sincronizarCelular()
  } catch (falha) {
    celular.erro.value = falha instanceof Error ? falha.message : String(falha)
  }
}

/** Encerra a sessão nos dois lados: apaga no servidor e desconecta o celular. As anotações ficam nesta aba. */
export async function encerrarCelular(): Promise<void> {
  const sessao = celular.sessao.value
  if (sessao) await encerrarSessao(sessao.id)
  celular.sessao.value = null
  esquecerConexao('celular')
  celular.erro.value = null
  celular.aviso.value = 'Sessão encerrada. As anotações continuam nesta aba até recarregar.'
}

/** Envia o bloco inteiro cifrado. O PC sempre recebe a versão mais recente. */
export async function sincronizarCelular(): Promise<void> {
  const sessao = celular.sessao.value
  if (!sessao) return
  celular.erro.value = null
  try {
    const envelope = await cifrar(JSON.stringify(celular.bloco.value), sessao.chave)
    await enviarResultado(sessao.id, envelope)
    celular.aviso.value = `Sincronizado às ${horaAgora()}.`
  } catch (falha) {
    if (falha instanceof SessaoEncerradaError) {
      celular.sessao.value = null
      esquecerConexao('celular')
      celular.erro.value = 'A sessão foi encerrada no PC. Gere um novo código lá e conecte de novo.'
      return
    }
    celular.erro.value = falha instanceof Error ? falha.message : String(falha)
  }
}

// Toda alteração no bloco vai para o PC na hora, sem depender de botão.
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

/** Revisão de cada consulta no PC (resposta do Gemini e prontuário editado). Só em memória, até encerrar a sessão. */
export interface Evolucao {
  resposta: string
  prontuario: string
  fora: string
  alertaNumeros: string[]
}
export const evolucoes = reactive<Record<string, Evolucao>>({})
const limparEvolucoes = () => Object.keys(evolucoes).forEach((id) => delete evolucoes[id])

let relogioPc: number | undefined
let ultimaVersao = 0

/** Zera o PC sem apagar nada no servidor (quem encerrou foi o celular). */
function esquecerSessaoPc(mensagem: string): void {
  clearInterval(relogioPc)
  pc.sessao.value = null
  pc.codigo.value = null
  pc.bloco.value = null
  esquecerConexao('pc')
  limparEvolucoes()
  pc.erro.value = null
  pc.status.value = mensagem
}

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
    pc.status.value = `Sincronizado às ${horaAgora()}.`
  } catch (falha) {
    if (falha instanceof SessaoEncerradaError) {
      esquecerSessaoPc('A sincronização foi encerrada (pelo celular ou por falta de uso).')
      return
    }
    pc.erro.value = falha instanceof Error ? falha.message : String(falha)
  }
}

/** Gera um código novo. Antes de criar, a sessão anterior é encerrada. */
export async function gerarCodigoPc(): Promise<void> {
  clearInterval(relogioPc)
  if (pc.sessao.value) await encerrarSessao(pc.sessao.value.id)
  esquecerConexao('pc')
  pc.erro.value = null
  pc.bloco.value = null
  limparEvolucoes()
  pc.status.value = 'Gerando código…'
  try {
    const criada = await criarSessao()
    const codigo = criada.codigo.replace('-', '')
    ultimaVersao = 0
    pc.codigo.value = criada.codigo
    pc.sessao.value = { id: criada.id, chave: await derivarChave(codigo, criada.salt) }
    guardarConexao('pc', { id: criada.id, codigo: criada.codigo, salt: criada.salt })
    pc.status.value = 'Digite este código no celular, em Ajustes. Ele vale por 12 horas sem uso.'
    relogioPc = window.setInterval(verificarPc, 3000)
  } catch (falha) {
    pc.erro.value = falha instanceof Error ? falha.message : String(falha)
  }
}

/** Encerra a sessão no PC: apaga no servidor e limpa o que estava na tela. */
export async function encerrarCodigoPc(): Promise<void> {
  if (pc.sessao.value) await encerrarSessao(pc.sessao.value.id)
  esquecerSessaoPc('Sincronização encerrada. Gere um novo código para sincronizar de novo.')
}

/** Sessão deste aparelho (a do PC ou a do celular), para outros recursos usarem o mesmo código. */
export function sessaoDeSincronizacao(): SessaoAtiva | null {
  return papelAtual === 'celular' ? celular.sessao.value : pc.sessao.value
}

// ----- Restaurar depois de recarregar a página -----
/** Reconecta com a conexão guardada. O bloco volta do servidor (cifrado) e é decifrado de novo com o código. */
async function restaurar(): Promise<void> {
  const guardada = lerConexaoGuardada(papelAtual)
  if (!guardada) return
  try {
    const chave = await derivarChave(normalizar(guardada.codigo), guardada.salt)
    if (papelAtual === 'celular') {
      const envelope = await buscarResultado(guardada.id, 0)
      const claro = envelope ? await decifrar(envelope, chave) : null
      const bloco = claro === null ? null : lerBloco(JSON.parse(claro))
      if (bloco) celular.bloco.value = bloco
      celular.sessao.value = { id: guardada.id, chave }
      celular.aviso.value = 'Sessão restaurada.'
    } else {
      ultimaVersao = 0
      pc.codigo.value = guardada.codigo
      pc.sessao.value = { id: guardada.id, chave }
      pc.status.value = 'Sessão restaurada. Digite o código no celular, em Ajustes, se ainda não conectou.'
      relogioPc = window.setInterval(verificarPc, 3000)
      await verificarPc()
    }
  } catch (falha) {
    if (falha instanceof SessaoEncerradaError) {
      esquecerConexao(papelAtual)
      if (papelAtual === 'pc') esquecerSessaoPc('A sincronização anterior expirou. Gere um novo código.')
      return
    }
    // Sem rede agora: mantém a conexão guardada para tentar de novo no próximo refresh.
    const mensagem = falha instanceof Error ? falha.message : String(falha)
    if (papelAtual === 'celular') celular.erro.value = mensagem
    else pc.erro.value = mensagem
  }
}

const restauracao = restaurar()

/** Mantém a sincronização ativa: espera a restauração e só cria um código se ainda não houver sessão. */
export async function garantirCodigoPc(): Promise<void> {
  await restauracao
  if (!pc.sessao.value) await gerarCodigoPc()
}
