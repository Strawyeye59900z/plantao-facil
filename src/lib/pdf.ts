import { PDFDocument } from 'pdf-lib'

/** Número de páginas do PDF (erro legível se o arquivo estiver protegido ou corrompido). */
export async function contarPaginas(bytes: Uint8Array): Promise<number> {
  try {
    return (await PDFDocument.load(bytes)).getPageCount()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(/encrypt/i.test(msg) ? 'O PDF está protegido por senha.' : 'Não foi possível ler o PDF.')
  }
}

/** Novo PDF só com as páginas de `de` a `ate` (1-based, inclusivas). Feito no aparelho. */
export async function recortarPaginas(bytes: Uint8Array, de: number, ate: number): Promise<Uint8Array> {
  const original = await PDFDocument.load(bytes)
  const novo = await PDFDocument.create()
  const indices = Array.from({ length: ate - de + 1 }, (_, i) => de - 1 + i)
  for (const pagina of await novo.copyPages(original, indices)) novo.addPage(pagina)
  return novo.save()
}

/** Base64 em blocos (evita estourar a pilha com arquivos grandes). */
export function paraBase64(bytes: Uint8Array): string {
  let binario = ''
  const BLOCO = 0x8000
  for (let i = 0; i < bytes.length; i += BLOCO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + BLOCO))
  }
  return btoa(binario)
}
