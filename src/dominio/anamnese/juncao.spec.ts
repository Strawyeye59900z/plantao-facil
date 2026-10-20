import { describe, expect, it } from 'vitest'
import { juntarTrechos } from './juncao'

describe('juntarTrechos', () => {
  it('junta dois trechos sem sobreposição com um espaço', () => {
    expect(juntarTrechos('Paciente refere dor', 'no peito há dois dias')).toBe('Paciente refere dor no peito há dois dias')
  })

  it('remove a palavra repetida na sobreposição entre blocos', () => {
    expect(juntarTrechos('Tem alergia a dipirona', 'a dipirona dá coceira')).toBe('Tem alergia a dipirona dá coceira')
  })

  it('reconhece a repetição mesmo com acento e pontuação diferentes', () => {
    expect(juntarTrechos('Toma losartana, sim.', 'Sim. Toma losartana 50 mg')).toBe('Toma losartana, sim. Toma losartana 50 mg')
  })

  it('não remove repetições que não estão no começo do bloco novo', () => {
    expect(juntarTrechos('Nega febre', 'nega tosse')).toBe('Nega febre nega tosse')
  })

  it('devolve o bloco novo quando não há texto anterior', () => {
    expect(juntarTrechos('', '  Paciente hipertenso  ')).toBe('Paciente hipertenso')
  })

  it('mantém o texto anterior quando o bloco novo está vazio', () => {
    expect(juntarTrechos('Nega etilismo', '   ')).toBe('Nega etilismo')
  })
})
