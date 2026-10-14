import { montarPedido } from '@/dominio/ia/prompt'
import { mensagemErroHttp, type ProvedorIA } from '@/dominio/ia/provedores'
import { lerRespostaIA, type LeituraRespostaIA } from '@/dominio/ia/resposta'
import { paraBase64 } from './pdf'

/**
 * Envia o PDF (já recortado, se for o caso) ao provedor e devolve a resposta validada.
 * A chave vai só no cabeçalho da requisição ao provedor escolhido.
 */
export async function enviarParaIA(
  provedor: ProvedorIA,
  p: { pdf: Uint8Array; intervalo: { de: number; ate: number } | null; modelo: string; chave: string; sinal: AbortSignal },
  requisitar: typeof fetch = fetch,
): Promise<LeituraRespostaIA> {
  const { url, init } = provedor.montarRequisicao({
    pdfBase64: paraBase64(p.pdf),
    pedido: montarPedido(p.intervalo),
    modelo: p.modelo,
    chave: p.chave,
  })

  let resposta: Response
  try {
    resposta = await requisitar(url, { ...init, signal: p.sinal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return { ok: false, erro: 'Envio cancelado.' }
    return { ok: false, erro: `Não foi possível falar com ${provedor.nome}. Verifique a internet.` }
  }

  let corpo: unknown = null
  try {
    corpo = await resposta.json()
  } catch {
    // corpo não-JSON: tratado abaixo
  }
  if (!resposta.ok) return { ok: false, erro: mensagemErroHttp(provedor, resposta.status, corpo) }

  const texto = provedor.lerResposta(corpo)
  if (!texto.ok) return texto
  return lerRespostaIA(texto.texto)
}
