import { beforeEach, describe, expect, it } from 'vitest'
import { esquecerConexao, guardarConexao, lerConexaoGuardada } from './persistencia'

describe('conexão guardada', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  const conexao = { id: 'abc', codigo: 'ABCD-2345', salt: 'c2FsdA==' }

  it('guarda e lê a conexão do PC (sessionStorage) e do celular (localStorage)', () => {
    guardarConexao('pc', conexao)
    guardarConexao('celular', { ...conexao, id: 'cel' })
    expect(lerConexaoGuardada('pc')).toEqual(conexao)
    expect(lerConexaoGuardada('celular')?.id).toBe('cel')
    expect(sessionStorage.length).toBe(1)
    expect(localStorage.length).toBe(1)
  })

  it('esquecer apaga só o papel pedido', () => {
    guardarConexao('pc', conexao)
    guardarConexao('celular', conexao)
    esquecerConexao('pc')
    expect(lerConexaoGuardada('pc')).toBeNull()
    expect(lerConexaoGuardada('celular')).not.toBeNull()
  })

  it('ignora conteúdo inválido', () => {
    sessionStorage.setItem('plantao.sincronizacao.pc.v1', '{"id":1}')
    expect(lerConexaoGuardada('pc')).toBeNull()
    sessionStorage.setItem('plantao.sincronizacao.pc.v1', 'não é json')
    expect(lerConexaoGuardada('pc')).toBeNull()
  })

  it('não guarda nada além de id, código e salt', () => {
    guardarConexao('pc', conexao)
    expect(Object.keys(JSON.parse(sessionStorage.getItem('plantao.sincronizacao.pc.v1')!)).sort()).toEqual(['codigo', 'id', 'salt'])
  })
})
