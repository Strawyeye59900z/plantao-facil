import { describe, expect, it } from 'vitest'
import { normalizarTexto } from './normalizar'

describe('normalizarTexto', () => {
  it('remove acentos e cedilha', () => {
    expect(normalizarTexto('Ação Pública Ãé Ü')).toBe('acao publica ae u')
  })

  it('converte para minúsculas e colapsa espaços', () => {
    expect(normalizarTexto('  Medicamento   TESTE  A ')).toBe('medicamento teste a')
  })

  it('mantém números e símbolos', () => {
    expect(normalizarTexto('Teste 1/2 {dose}')).toBe('teste 1/2 {dose}')
  })
})
