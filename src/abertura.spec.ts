// Dados fictícios de teste — nenhum conteúdo clínico real.
import 'fake-indexeddb/auto'
import { Dexie } from 'dexie'
import { describe, expect, it, vi } from 'vitest'
import { carregarAoAbrir, MENSAGEM_FALHA_ABERTURA } from './abertura'

describe('carregarAoAbrir', () => {
  it('ok quando todos os carregamentos terminam', async () => {
    const a = vi.fn(async () => {})
    const b = vi.fn(async () => {})
    expect(await carregarAoAbrir([a, b])).toEqual({ ok: true })
    expect(a).toHaveBeenCalledOnce()
    expect(b).toHaveBeenCalledOnce()
  })

  it('falha (sem lançar) quando um carregamento é recusado', async () => {
    const erro = new Error('falhou')
    const r = await carregarAoAbrir([async () => {}, async () => Promise.reject(erro)])
    expect(r).toEqual({ ok: false, erro })
  })

  it('falha quando a atualização do banco (upgrade do Dexie) lança erro', async () => {
    const nome = 'teste-abertura-upgrade'
    const v1 = new Dexie(nome)
    v1.version(1).stores({ itens: 'id' })
    await v1.table('itens').put({ id: 'seed-1', nome: 'Item Teste A' })
    v1.close()

    const v2 = new Dexie(nome)
    v2.version(1).stores({ itens: 'id' })
    v2.version(2).stores({ itens: 'id' }).upgrade(() => {
      throw new Error('upgrade falhou')
    })
    const r = await carregarAoAbrir([async () => { await v2.table('itens').toArray() }])
    expect(r.ok).toBe(false)
    v2.close()

    // Os dados continuam como estavam (versão 1).
    const conferir = new Dexie(nome)
    conferir.version(1).stores({ itens: 'id' })
    expect(await conferir.table('itens').toArray()).toEqual([{ id: 'seed-1', nome: 'Item Teste A' }])
    conferir.close()
    await Dexie.delete(nome)
  })

  it('mensagem em português', () => {
    expect(MENSAGEM_FALHA_ABERTURA).toBe(
      'Não foi possível atualizar os dados deste aparelho. Seus dados continuam guardados como estavam. Tente recarregar; se continuar, procure ajuda antes de apagar dados do navegador.',
    )
  })
})
