/** Baixa um arquivo (texto ou bytes; no Android vai para Downloads). */
export function baixarArquivo(nome: string, conteudo: string | Uint8Array, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([conteudo as BlobPart], { type: tipo }))
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function criarArquivo(nome: string, conteudo: string, tipo: string) {
  return new File([conteudo], nome, { type: tipo })
}

/** O navegador consegue compartilhar arquivos (menu do Android: Drive, e-mail, WhatsApp…)? */
export function podeCompartilharArquivo(): boolean {
  try {
    return (
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [criarArquivo('teste.json', '{}', 'application/json')] })
    )
  } catch {
    return false
  }
}

/**
 * Abre o menu de compartilhamento do sistema com o arquivo.
 * Retorna false se o usuário cancelou.
 */
export async function compartilharArquivo(nome: string, conteudo: string, tipo = 'application/json'): Promise<boolean> {
  try {
    await navigator.share({ files: [criarArquivo(nome, conteudo, tipo)], title: nome })
    return true
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === 'AbortError') return false
    throw erro
  }
}
