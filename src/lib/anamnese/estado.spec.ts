import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adicionarLeito, blocoVazio } from '@/dominio/anamnese/bloco'
import { cifrar, derivarChave } from '@/dominio/anamnese/cifra'

const SALT = btoa('0123456789abcdef')
const CODIGO = 'ABCD2345'

const buscarResultado = vi.fn()
const enviarResultado = vi.fn()

vi.mock('./sessao', async () => {
  const real = await vi.importActual<typeof import('./sessao')>('./sessao')
  return {
    ...real,
    buscarResultado: (...args: unknown[]) => buscarResultado(...args),
    enviarResultado: (...args: unknown[]) => enviarResultado(...args),
    criarSessao: vi.fn(),
    entrarSessao: vi.fn(),
    encerrarSessao: vi.fn(),
  }
})

function simularNavegador(userAgent: string) {
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true })
}

async function envelopeDoServidor() {
  const bloco = adicionarLeito(blocoVazio(), 'Leito 12', () => 'l1')
  const envelope = await cifrar(JSON.stringify(bloco), await derivarChave(CODIGO, SALT))
  return { ...envelope, versao: 3 }
}

describe('restaurar a sessão depois de recarregar', () => {
  beforeEach(() => {
    vi.resetModules()
    sessionStorage.clear()
    localStorage.clear()
    buscarResultado.mockReset()
    enviarResultado.mockReset()
  })
  afterEach(() => {
    simularNavegador('Mozilla/5.0 (Windows NT 10.0) jsdom')
  })

  it('PC: reconecta com a sessão guardada e recebe o bloco do servidor', async () => {
    simularNavegador('Mozilla/5.0 (Windows NT 10.0) Chrome')
    sessionStorage.setItem('plantao.sincronizacao.pc.v1', JSON.stringify({ id: 'sessao-pc', codigo: 'ABCD-2345', salt: SALT }))
    buscarResultado.mockResolvedValue(await envelopeDoServidor())

    const { pc, garantirCodigoPc } = await import('./estado')
    await garantirCodigoPc()

    expect(pc.sessao.value?.id).toBe('sessao-pc')
    expect(pc.codigo.value).toBe('ABCD-2345')
    expect(pc.bloco.value?.leitos[0]?.identificacao).toBe('Leito 12')
    expect(buscarResultado).toHaveBeenCalledWith('sessao-pc', 0)
  })

  it('celular: reconecta e traz de volta o bloco que estava no servidor', async () => {
    simularNavegador('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari')
    localStorage.setItem('plantao.sincronizacao.celular.v1', JSON.stringify({ id: 'sessao-cel', codigo: CODIGO, salt: SALT }))
    buscarResultado.mockResolvedValue(await envelopeDoServidor())

    const { celular } = await import('./estado')
    await vi.waitFor(() => expect(celular.conectado.value).toBe(true))

    expect(celular.bloco.value.leitos[0]?.identificacao).toBe('Leito 12')
  })

  it('sessão expirada no servidor: esquece a conexão guardada', async () => {
    simularNavegador('Mozilla/5.0 (Windows NT 10.0) Chrome')
    sessionStorage.setItem('plantao.sincronizacao.pc.v1', JSON.stringify({ id: 'velha', codigo: 'ABCD-2345', salt: SALT }))
    const { SessaoEncerradaError } = await import('./sessao')
    buscarResultado.mockRejectedValue(new SessaoEncerradaError('expirou'))

    const { pc, garantirCodigoPc } = await import('./estado')
    // A restauração falha; garantirCodigoPc tentaria criar outra sessão (mock sem retorno), por isso só esperamos a restauração.
    await garantirCodigoPc().catch(() => undefined)

    expect(sessionStorage.getItem('plantao.sincronizacao.pc.v1')).toBeNull()
    expect(pc.codigo.value).toBeNull()
  })

  it('sem conexão guardada, não faz nada', async () => {
    const { pc } = await import('./estado')
    expect(pc.sessao.value).toBeNull()
    expect(buscarResultado).not.toHaveBeenCalled()
  })
})
