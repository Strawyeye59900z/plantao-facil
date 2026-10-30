/**
 * Registros de PCR do celular para o PC, pela sessão do código de sincronização (canal "pcr").
 * Comprimir não é preciso: são poucos registros. No PC ficam só na memória da aba.
 */
import { ref } from 'vue'
import { cifrar, decifrar } from '@/dominio/anamnese/cifra'
import { lerRegistros, type RegistroPcr } from '@/dominio/pcr/pcr'
import { pc } from '@/lib/anamnese/estado'
import { buscarResultado, enviarResultado, SessaoEncerradaError } from '@/lib/anamnese/sessao'

interface Sessao {
  id: string
  chave: CryptoKey
}

/** Celular: envia todos os registros guardados (lista vazia apaga no PC). */
export async function enviarRegistros(sessao: Sessao, registros: RegistroPcr[]): Promise<void> {
  const envelope = await cifrar(JSON.stringify(registros), sessao.chave)
  await enviarResultado(sessao.id, envelope, 'pcr')
}

/** PC: o que o celular enviou nesta sessão. Só em memória. */
export const registrosNoPc = ref<RegistroPcr[]>([])
export const erroPcr = ref<string | null>(null)
let versao = 0

/** PC: busca a versão mais nova; devolve true se algo mudou. */
export async function consultarRegistrosNoPc(): Promise<boolean> {
  const sessao = pc.sessao.value
  if (!sessao) return false
  try {
    const envelope = await buscarResultado(sessao.id, versao, 'pcr')
    if (!envelope) return false
    const claro = await decifrar(envelope, sessao.chave)
    if (claro === null) {
      erroPcr.value = 'Não consegui abrir os registros. Confira se os dois aparelhos usam o mesmo código.'
      return false
    }
    versao = envelope.versao
    registrosNoPc.value = lerRegistros(JSON.parse(claro)).sort((a, b) => b.iniciadoEm - a.iniciadoEm)
    erroPcr.value = null
    return true
  } catch (falha) {
    if (!(falha instanceof SessaoEncerradaError)) erroPcr.value = falha instanceof Error ? falha.message : String(falha)
    return false
  }
}

export function limparRegistrosNoPc(): void {
  registrosNoPc.value = []
  versao = 0
}
