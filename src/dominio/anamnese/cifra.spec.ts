import { describe, expect, it } from 'vitest'
import { cifrar, decifrar, exportarChave, gerarChave, importarChave } from './cifra'

describe('cifra do pareamento', () => {
  it('decifra com a mesma chave importada do QR code', async () => {
    const chave = await gerarChave()
    const texto = await exportarChave(chave)
    const envelope = await cifrar('HDA: Paciente refere ⟦dor⟧ há ⟦3 dias⟧.', chave)
    const recebida = await importarChave(texto)
    expect(await decifrar(envelope, recebida)).toBe('HDA: Paciente refere ⟦dor⟧ há ⟦3 dias⟧.')
  })

  it('o envelope não contém o texto em claro', async () => {
    const chave = await gerarChave()
    const envelope = await cifrar('Paciente toma losartana 50 mg', chave)
    expect(JSON.stringify(envelope).includes('losartana')).toBe(false)
  })

  it('outra chave não consegue decifrar', async () => {
    const envelope = await cifrar('segredo', await gerarChave())
    expect(await decifrar(envelope, await gerarChave())).toBeNull()
  })

  it('envelope alterado é recusado', async () => {
    const chave = await gerarChave()
    const envelope = await cifrar('texto', chave)
    const adulterado = { ...envelope, ciphertext: envelope.ciphertext.slice(0, -2) + 'AA' }
    expect(await decifrar(adulterado, chave)).toBeNull()
  })

  it('iv muda a cada envio (mesmo texto, envelopes diferentes)', async () => {
    const chave = await gerarChave()
    const a = await cifrar('igual', chave)
    const b = await cifrar('igual', chave)
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })
})
