/** Compressão gzip no navegador (CompressionStream), para o pacote de prescrições caber no limite do servidor. */

async function passar(bytes: Uint8Array<ArrayBuffer>, fluxo: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const origem = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controle) {
      controle.enqueue(bytes)
      controle.close()
    },
  })
  const resposta = new Response(origem.pipeThrough(fluxo))
  return new Uint8Array(await resposta.arrayBuffer())
}

export function comprimirTexto(texto: string): Promise<Uint8Array<ArrayBuffer>> {
  return passar(new TextEncoder().encode(texto), new CompressionStream('gzip'))
}

export async function descomprimirTexto(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  return new TextDecoder().decode(await passar(bytes, new DecompressionStream('gzip')))
}
