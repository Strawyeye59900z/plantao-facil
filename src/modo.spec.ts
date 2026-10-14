import { describe, expect, it } from 'vitest'
import { rotaBloqueadaNoPenDrive } from './modo'

describe('rotaBloqueadaNoPenDrive', () => {
  it.each(['/prescricoes/nova', '/prescricoes/abc/editar', '/calculadoras/nova', '/calculadoras/abc/editar', '/categorias', '/lixeira', '/backup', '/importar'])(
    'bloqueia %s',
    (rota) => expect(rotaBloqueadaNoPenDrive(rota)).toBe(true),
  )

  it.each(['/prescricoes', '/prescricoes/abc', '/calculadoras', '/calculadoras/abc', '/ajustes', '/carregar'])(
    'libera %s',
    (rota) => expect(rotaBloqueadaNoPenDrive(rota)).toBe(false),
  )
})
