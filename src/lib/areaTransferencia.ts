/**
 * Copia texto para a área de transferência.
 * Usa a API moderna; se indisponível (ex.: página aberta como arquivo), cai no execCommand.
 */
export async function copiarTexto(texto: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(texto)
      return
    } catch {
      // segue para o método antigo
    }
  }
  const area = document.createElement('textarea')
  area.value = texto
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  area.remove()
  if (!ok) throw new Error('Falha ao copiar.')
}
