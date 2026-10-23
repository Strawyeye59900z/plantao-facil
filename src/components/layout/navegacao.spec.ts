import { describe, expect, it } from 'vitest'
import { AREAS, MENU } from './navegacao'

describe('navegação', () => {
  it('as áreas são Prescrições, Calculadoras, Escalas, Bloco de notas e Transcrição', () => {
    expect(AREAS.map((a) => a.rota)).toEqual(['/prescricoes', '/calculadoras', '/escalas', '/anamnese/bloco', '/anamnese/transcricao'])
  })

  it('o menu tem Grupos, Importar PDF, Receber de colega, Backup, Lixeira e Ajustes, nesta ordem', () => {
    expect(MENU.map((m) => m.rotulo)).toEqual(['Grupos', 'Importar PDF', 'Receber de colega', 'Backup', 'Lixeira', 'Ajustes'])
  })
})
