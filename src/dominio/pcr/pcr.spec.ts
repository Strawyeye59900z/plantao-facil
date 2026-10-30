import { describe, expect, it } from 'vitest'
import {
  CICLO_MS,
  contar,
  desfazerUltimo,
  doseDaProxima,
  EPI_ATRASO_MS,
  EPI_REPETIR_MS,
  estadoDaParada,
  expirado,
  formatarTempo,
  lerRegistros,
  montarResumo,
  novoRegistro,
  registrarEvento,
  VALIDADE_MS,
  type EventoPcr,
} from './pcr'

const T0 = 1_000_000_000_000
let seq = 0
const ev = (tipo: EventoPcr['tipo'], em: number, extra: Partial<EventoPcr> = {}): EventoPcr => ({ id: `e${seq++}`, tipo, em, ...extra })

describe('PCR: contagens', () => {
  it('conta choques pelas checagens chocáveis e as doses de cada medicação', () => {
    let r = novoRegistro('r1', T0)
    r = registrarEvento(r, ev('checagem', T0 + CICLO_MS, { chocavel: true }))
    r = registrarEvento(r, ev('epinefrina', T0 + CICLO_MS + 1000))
    r = registrarEvento(r, ev('checagem', T0 + 2 * CICLO_MS, { chocavel: false }))
    r = registrarEvento(r, ev('amiodarona', T0 + 2 * CICLO_MS + 1000))
    r = registrarEvento(r, ev('via_aerea', T0 + 2 * CICLO_MS + 2000))
    r = registrarEvento(r, ev('outro', T0 + 2 * CICLO_MS + 3000, { texto: 'Acesso IO' }))
    expect(contar(r)).toEqual({ checagens: 2, choques: 1, epinefrina: 1, amiodarona: 1, lidocaina: 0, viaAerea: 1, outros: 1 })
  })

  it('desfazer remove só o último toque', () => {
    let r = registrarEvento(novoRegistro('r', T0), ev('epinefrina', T0 + 1000))
    r = registrarEvento(r, ev('lidocaina', T0 + 2000))
    expect(desfazerUltimo(r).eventos.map((e) => e.tipo)).toEqual(['epinefrina'])
  })
})

describe('PCR: tempos', () => {
  it('o ciclo de 2 min vence e a checagem fica pendente até ser respondida', () => {
    const r = novoRegistro('r', T0)
    expect(estadoDaParada(r, T0 + 30_000)).toMatchObject({ cicloRestanteMs: CICLO_MS - 30_000, checagemPendente: false })
    expect(estadoDaParada(r, T0 + CICLO_MS)).toMatchObject({ cicloRestanteMs: 0, checagemPendente: true })
    const respondida = registrarEvento(r, ev('checagem', T0 + CICLO_MS + 5000, { chocavel: false }))
    expect(estadoDaParada(respondida, T0 + CICLO_MS + 6000)).toMatchObject({ cicloRestanteMs: CICLO_MS - 1000, checagemPendente: false })
  })

  it('a epinefrina avisa aos 3 min e fica atrasada aos 5 min; sem dose não avisa', () => {
    const base = novoRegistro('r', T0)
    expect(estadoDaParada(base, T0 + 10 * 60_000).epinefrina).toBe('sem_dose')
    const r = registrarEvento(base, ev('epinefrina', T0 + 60_000))
    expect(estadoDaParada(r, T0 + 60_000 + EPI_REPETIR_MS - 1).epinefrina).toBe('aguardar')
    expect(estadoDaParada(r, T0 + 60_000 + EPI_REPETIR_MS).epinefrina).toBe('repetir')
    expect(estadoDaParada(r, T0 + 60_000 + EPI_ATRASO_MS).epinefrina).toBe('atrasada')
    const outra = registrarEvento(r, ev('epinefrina', T0 + 60_000 + EPI_REPETIR_MS))
    expect(estadoDaParada(outra, T0 + 60_000 + EPI_REPETIR_MS + 1000).epinefrina).toBe('aguardar')
  })

  it('encerrada, o relógio para', () => {
    const r = { ...novoRegistro('r', T0), encerradoEm: T0 + 90_000 }
    expect(estadoDaParada(r, T0 + 999_999)).toMatchObject({ totalMs: 90_000, checagemPendente: false })
  })

  it('formata mm:ss', () => {
    expect(formatarTempo(0)).toBe('00:00')
    expect(formatarTempo(125_900)).toBe('02:05')
    expect(formatarTempo(61 * 60_000)).toBe('61:00')
  })
})

describe('PCR: doses de referência', () => {
  it('mostra a dose da próxima aplicação e nada além do previsto', () => {
    expect(doseDaProxima('epinefrina', 0)).toBe('1 mg')
    expect(doseDaProxima('epinefrina', 4)).toBe('1 mg')
    expect(doseDaProxima('amiodarona', 0)).toBe('300 mg')
    expect(doseDaProxima('amiodarona', 1)).toBe('150 mg')
    expect(doseDaProxima('amiodarona', 2)).toBeNull()
    expect(doseDaProxima('lidocaina', 1)).toBe('0,5–0,75 mg/kg')
  })
})

describe('PCR: resumo, validade e leitura', () => {
  it('o resumo traz contagens e a linha do tempo, sem identificadores', () => {
    let r = novoRegistro('r', T0)
    r = registrarEvento(r, ev('epinefrina', T0 + 65_000))
    r = registrarEvento(r, ev('checagem', T0 + CICLO_MS, { chocavel: true }))
    r = registrarEvento(r, ev('outro', T0 + CICLO_MS + 5000, { texto: 'Acesso IO' }))
    r = { ...r, encerradoEm: T0 + 300_000 }
    const txt = montarResumo(r)
    expect(txt).toContain('duração 05:00')
    expect(txt).toContain('Choques: 1 · Epinefrina: 1')
    expect(txt).toMatch(/\(01:05\) Epinefrina \(1ª dose\)/)
    expect(txt).toMatch(/\(02:00\) Checagem de ritmo: chocável, choque dado/)
    expect(txt).toMatch(/\(02:05\) Acesso IO/)
  })

  it('expira depois de 2 dias', () => {
    const r = novoRegistro('r', T0)
    expect(expirado(r, T0 + VALIDADE_MS)).toBe(false)
    expect(expirado(r, T0 + VALIDADE_MS + 1)).toBe(true)
  })

  it('lê registros válidos e descarta o que está malformado', () => {
    const bom = { id: 'a', iniciadoEm: T0, encerradoEm: null, eventos: [{ id: 'x', tipo: 'epinefrina', em: T0 + 1 }, { id: 'y', tipo: 'invalido', em: 1 }] }
    const lidos = lerRegistros([bom, { id: 1 }, null, 'texto'])
    expect(lidos).toHaveLength(1)
    expect(lidos[0]!.eventos).toHaveLength(1)
    expect(lerRegistros('nada')).toEqual([])
  })
})
