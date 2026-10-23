import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { categoriaTeste, prescricaoTeste } from '@/dominio/prescricoes/fixtures.spec-helper'
import { montarPacote } from '@/dominio/compartilhar/pacote'
// O Worker é JavaScript puro: a API real roda aqui dentro, com Durable Objects em memória.
// @ts-expect-error o Worker é JavaScript, sem tipos
import { Entrada, Limitador, Sessao } from '../../../worker/objetos.js'
// @ts-expect-error o Worker é JavaScript, sem tipos
import { criarRotasSessoes } from '../../../worker/sessoes.js'
import { baixarPacote, cancelarCompartilhamento, publicarPacote } from './compartilhar'

function ctxFalso() {
  const dados = new Map<string, unknown>()
  return {
    blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
    storage: {
      get: async (k: string) => dados.get(k),
      put: async (k: string, v: unknown) => void dados.set(k, structuredClone(v)),
      deleteAll: async () => dados.clear(),
      setAlarm: async () => undefined,
      deleteAlarm: async () => undefined,
    },
  }
}

function instalarApiEmMemoria() {
  const objetos = new Map<string, { fetch(req: Request): Promise<Response> }>()
  const obter = (tipo: string, Classe: new (ctx: never, env: unknown) => { fetch(req: Request): Promise<Response> }) => (nome: string) => {
    const chave = `${tipo}:${nome}`
    if (!objetos.has(chave)) objetos.set(chave, new Classe(ctxFalso() as never, {}))
    return objetos.get(chave)!
  }
  const tratar = criarRotasSessoes({ sessao: obter('s', Sessao), entrada: obter('e', Entrada), limitador: obter('l', Limitador) })
  vi.stubGlobal('fetch', async (entrada: string, init?: RequestInit) => (await tratar(new Request(`https://app.teste${entrada}`, init)))!)
}

beforeEach(instalarApiEmMemoria)
afterEach(() => vi.unstubAllGlobals())

const AGORA = '2026-05-05T10:00:00.000Z'
const biblioteca = {
  prescricoes: [prescricaoTeste({ id: 'a', titulo: 'Situação Teste A', categoriaId: 'g1' }), prescricaoTeste({ id: 'b', titulo: 'Situação Teste B', categoriaId: 'g1' })],
  calculadoras: [],
  categorias: [categoriaTeste({ id: 'g1', nome: 'Grupo Teste A' })],
}

describe('compartilhar prescrições (ponta a ponta, sem rede)', () => {
  it('o colega abre o pacote com o código e recebe exatamente o que foi enviado', async () => {
    const pacote = montarPacote(biblioteca, ['a', 'b'], AGORA, '1')
    const envio = await publicarPacote(pacote)
    expect(envio.codigo).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    expect(envio.expiraEm.getTime() - Date.now()).toBeGreaterThan(6.9 * 86400 * 1000)

    const leitura = await baixarPacote(envio.codigo.toLowerCase().replace('-', ' '))
    expect(leitura.ok).toBe(true)
    if (leitura.ok) {
      expect(leitura.backup.prescricoes.map((p) => p.titulo)).toEqual(['Situação Teste A', 'Situação Teste B'])
      expect(leitura.backup.categorias.map((c) => c.nome)).toEqual(['Grupo Teste A'])
    }
  })

  it('mais de um colega usa o mesmo código', async () => {
    const envio = await publicarPacote(montarPacote(biblioteca, ['a'], AGORA, '1'))
    expect((await baixarPacote(envio.codigo)).ok).toBe(true)
    expect((await baixarPacote(envio.codigo)).ok).toBe(true)
  })

  it('código errado ou cancelado dá mensagem clara', async () => {
    const envio = await publicarPacote(montarPacote(biblioteca, ['a'], AGORA, '1'))
    await expect(baixarPacote('ZZZZ-ZZZZ')).rejects.toThrow('Código não encontrado ou expirado')
    await cancelarCompartilhamento(envio.id)
    await expect(baixarPacote(envio.codigo)).rejects.toThrow('Código não encontrado ou expirado')
  })

  it('recusa um pacote grande demais antes de criar a sessão', async () => {
    // Texto pouco compressível (aleatório) acima de 1 MB depois de comprimido.
    const ruido = Array.from({ length: 400_000 }, () => Math.random().toString(36).slice(2, 5)).join('')
    const grande = montarPacote(
      { ...biblioteca, prescricoes: [prescricaoTeste({ id: 'a', observacoes: ruido })] },
      ['a'],
      AGORA,
      '1',
    )
    const espiao = vi.fn(globalThis.fetch)
    vi.stubGlobal('fetch', espiao)
    await expect(publicarPacote(grande)).rejects.toThrow('grande demais')
    expect(espiao).not.toHaveBeenCalled()
  })

  it('o servidor não vê o texto das prescrições', async () => {
    const enviados: string[] = []
    const real = globalThis.fetch
    vi.stubGlobal('fetch', async (entrada: string, init?: RequestInit) => {
      if (typeof init?.body === 'string') enviados.push(init.body)
      return real(entrada, init)
    })
    await publicarPacote(montarPacote(biblioteca, ['a'], AGORA, '1'))
    expect(enviados.join('')).not.toContain('Situação Teste A')
  })
})
