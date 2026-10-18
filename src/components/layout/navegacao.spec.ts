import { describe, expect, it } from 'vitest'
import { AREAS, MENU } from './navegacao'

describe('navegação', () => {
  it('as áreas da Fase 1 são Prescrições e Calculadoras', () => {
    expect(AREAS.map((a) => a.rota)).toEqual(['/prescricoes', '/calculadoras'])
  })

  it('o menu tem Grupos, Importar PDF, Backup, Lixeira e Ajustes, nesta ordem', () => {
    expect(MENU.map((m) => m.rotulo)).toEqual(['Grupos', 'Importar PDF', 'Backup', 'Lixeira', 'Ajustes'])
  })
})
