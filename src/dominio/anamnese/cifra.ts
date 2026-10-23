/**
 * Cifra ponta a ponta do pareamento. A chave AES-GCM 256 nasce no PC, vai no QR code (fragmento da
 * URL, que nunca chega ao servidor) e o celular cifra o texto antes de enviar. O servidor só guarda
 * iv + ciphertext.
 */

const base64url = (bytes: Uint8Array): string => {
  let texto = ''
  for (const b of bytes) texto += String.fromCharCode(b)
  return btoa(texto).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const bytesDeBase64url = (texto: string): Uint8Array<ArrayBuffer> => {
  const normal = texto.replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(normal + '='.repeat((4 - (normal.length % 4)) % 4))
  const bytes = new Uint8Array(new ArrayBuffer(binario.length))
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

export async function gerarChave(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function exportarChave(chave: CryptoKey): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.exportKey('raw', chave)))
}

export async function importarChave(texto: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', bytesDeBase64url(texto), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export interface Envelope {
  iv: string
  ciphertext: string
}

export async function cifrar(texto: string, chave: CryptoKey): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, new TextEncoder().encode(texto))
  return { iv: base64url(iv), ciphertext: base64url(new Uint8Array(cifrado)) }
}

/** Como `cifrar`, para bytes (ex.: texto já comprimido). */
export async function cifrarBytes(bytes: Uint8Array<ArrayBuffer>, chave: CryptoKey): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, bytes)
  return { iv: base64url(iv), ciphertext: base64url(new Uint8Array(cifrado)) }
}

/** Devolve os bytes, ou null se a chave não confere (ou o envelope foi alterado). */
export async function decifrarBytes(envelope: Envelope, chave: CryptoKey): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const claro = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytesDeBase64url(envelope.iv) },
      chave,
      bytesDeBase64url(envelope.ciphertext),
    )
    return new Uint8Array(claro)
  } catch {
    return null
  }
}

/** Devolve o texto, ou null se a chave não confere (ou o envelope foi alterado). */
export async function decifrar(envelope: Envelope, chave: CryptoKey): Promise<string | null> {
  try {
    const claro = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytesDeBase64url(envelope.iv) },
      chave,
      bytesDeBase64url(envelope.ciphertext),
    )
    return new TextDecoder().decode(claro)
  } catch {
    return null
  }
}

/** Iterações PBKDF2-SHA256 (recomendação OWASP): tornam cada tentativa de adivinhar o código lenta. */
export const ITERACOES_DERIVACAO = 310_000

/**
 * Deriva a chave AES-GCM a partir do código digitado e do salt da sessão.
 * PC e celular chegam à mesma chave sem que ela passe pelo servidor.
 */
export async function derivarChave(codigo: string, saltBase64: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(codigo), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bytesDeBase64url(saltBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')), iterations: ITERACOES_DERIVACAO, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}
