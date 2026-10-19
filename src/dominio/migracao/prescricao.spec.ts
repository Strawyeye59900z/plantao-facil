// Dados fictícios para testes — nenhum conteúdo clínico real.
import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { esquemaArquivoBackupV1 } from './v1/esquema'
import { descreverRegraV1 } from './v1/regra'
import { migrarPrescricaoV1 } from './prescricao'
import type { ItemPrescricaoV1, PrescricaoV1, RegraDoseV1 } from './v1/tipos'

const arred = {
  arredondamentoDose: { modo: 'inteiro' },
  arredondamentoVolume: { modo: 'casas_decimais', casas: 1 },
} as const

const regraSimples: RegraDoseV1 = {
  dosePorKg: 10,
  unidade: 'mg',
  baseDoseKg: 'por_tomada',
  tomadasPorDia: null,
  doseMaximaPorTomada: 500,
  doseMaximaDiaria: null,
  pesoLimite: null,
  concentracao: null,
  ...arred,
}
const DESC_SIMPLES = '10 mg/kg, máx. 500 mg/tomada'

const regraCompleta: RegraDoseV1 = {
  dosePorKg: 30,
  unidade: 'mg',
  baseDoseKg: 'por_dia',
  tomadasPorDia: 3,
  doseMaximaPorTomada: null,
  doseMaximaDiaria: 1500,
  pesoLimite: { acimaDeKg: 40, doseFixa: 400 },
  concentracao: { quantidade: 100, volumeMl: 5 },
  ...arred,
}
const DESC_COMPLETA = '30 mg/kg/dia, 3 tomadas/dia, máx. 1500 mg/dia, acima de 40 kg: 400 mg, concentração 100 mg em 5 mL'

function geradorIds() {
  let n = 0
  return () => `novo-${++n}`
}

function itemV1(parcial: Partial<ItemPrescricaoV1> = {}): ItemPrescricaoV1 {
  return { id: 'i-1', texto: 'Medicamento Teste A', regraDose: null, alternativas: [], ...parcial }
}

function prescricaoV1(parcial: Partial<PrescricaoV1> = {}): PrescricaoV1 {
  return {
    id: 'p-1',
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-02T00:00:00.000Z',
    excluidoEm: null,
    titulo: 'Situação Teste A',
    categoriaId: 'c-1',
    tags: ['Tag Teste'],
    itens: [itemV1()],
    condicoes: [],
    alertas: [],
    receita: 'Receita Teste',
    observacoes: 'Observação Teste',
    referencia: 'Referência Teste',
    favorito: true,
    origem: 'manual',
    revisada: true,
    duvidasImportacao: [],
    ...parcial,
  }
}

const AVISO_ITEM_1 =
  'Migrada da versão anterior: o item 1 tinha cálculo de dose automático, transformado em texto. Confira.'

describe('descreverRegraV1', () => {
  it('dose por tomada com teto por tomada', () => {
    expect(descreverRegraV1(regraSimples)).toBe(DESC_SIMPLES)
  })

  it('dose por dia com tomadas, teto diário, peso limite e concentração', () => {
    expect(descreverRegraV1(regraCompleta)).toBe(DESC_COMPLETA)
  })

  it('números com vírgula decimal', () => {
    expect(descreverRegraV1({ ...regraSimples, dosePorKg: 2.5, doseMaximaPorTomada: null })).toBe('2,5 mg/kg')
  })
})

describe('migrarPrescricaoV1', () => {
  it('item com regra: marcadores viram texto com a regra e a prescrição fica para revisar', () => {
    const p = prescricaoV1({
      itens: [itemV1({ texto: 'Medicamento Teste A {dose} VO ({volume}) {tomadas}', regraDose: regraCompleta })],
      duvidasImportacao: ['Dúvida Teste'],
    })
    const m = migrarPrescricaoV1(p, geradorIds())
    expect(m.itens[0]!.opcoes[0]!.texto).toBe(`Medicamento Teste A [${DESC_COMPLETA}] VO ([volume]) de 8h em 8h`)
    expect(m.revisada).toBe(false)
    expect(m.duvidasImportacao).toEqual(['Dúvida Teste', AVISO_ITEM_1])
  })

  it('marcadores seguintes viram [dose]/[dose diária]; {tomadas} fora da tabela vira [tomadas]', () => {
    const p = prescricaoV1({
      itens: [
        itemV1({
          texto: '{dose_diaria} ({dose}) {tomadas} {dose_diaria} {desconhecido}',
          regraDose: { ...regraSimples, tomadasPorDia: 5 },
        }),
      ],
    })
    const desc = '10 mg/kg, 5 tomadas/dia, máx. 500 mg/tomada'
    expect(migrarPrescricaoV1(p, geradorIds()).itens[0]!.opcoes[0]!.texto).toBe(
      `[${desc}] ([dose]) [tomadas] [dose diária] {desconhecido}`,
    )
  })

  it('{tomadas} usa o intervalo da v1 (1 vez ao dia, de 12h em 12h…)', () => {
    const texto = (tomadasPorDia: number) =>
      migrarPrescricaoV1(
        prescricaoV1({ itens: [itemV1({ texto: '{dose} {tomadas}', regraDose: { ...regraSimples, tomadasPorDia } })] }),
        geradorIds(),
      ).itens[0]!.opcoes[0]!.texto.replace(/^\[[^\]]*\] /, '')
    expect(texto(1)).toBe('1 vez ao dia')
    expect(texto(2)).toBe('de 12h em 12h')
    expect(texto(24)).toBe('de 1h em 1h')
  })

  it('item com regra e sem marcador: descrição anexada ao fim', () => {
    const p = prescricaoV1({ itens: [itemV1({ texto: 'Medicamento Teste A VO', regraDose: regraSimples })] })
    const m = migrarPrescricaoV1(p, geradorIds())
    expect(m.itens[0]!.opcoes[0]!.texto).toBe(`Medicamento Teste A VO [${DESC_SIMPLES}]`)
    expect(m.revisada).toBe(false)
    expect(m.duvidasImportacao).toEqual([AVISO_ITEM_1])
  })

  it('opções equivalentes: principal (motivo vazio) + alternativas (motivo delas), mesmo item.id', () => {
    const p = prescricaoV1({
      itens: [
        itemV1({
          id: 'i-ou',
          texto: 'Opção Teste 1',
          opcoesEquivalentes: true,
          alternativas: [
            { id: 'a-1', motivo: 'Motivo Teste', texto: 'Opção Teste 2', regraDose: null },
            { id: 'a-2', motivo: '', texto: 'Opção Teste 3 {dose}', regraDose: regraSimples },
          ],
        }),
      ],
    })
    const m = migrarPrescricaoV1(p, geradorIds())
    const item = m.itens[0]!
    expect(item.id).toBe('i-ou')
    expect(item.opcoes).toEqual([
      { id: 'novo-1', texto: 'Opção Teste 1', motivo: '' },
      { id: 'novo-2', texto: 'Opção Teste 2', motivo: 'Motivo Teste' },
      { id: 'novo-3', texto: `Opção Teste 3 [${DESC_SIMPLES}]`, motivo: '' },
    ])
    // A alternativa tinha regra: a prescrição também fica para revisar.
    expect(m.revisada).toBe(false)
    expect(m.duvidasImportacao).toEqual([AVISO_ITEM_1])
  })

  it('alternativas sem opções equivalentes: a principal recebe o motivo "Padrão"', () => {
    const alternativas = [{ id: 'a-1', motivo: 'Motivo Teste', texto: 'Medicamento Teste B', regraDose: null }]
    for (const opcoesEquivalentes of [undefined, false]) {
      const m = migrarPrescricaoV1(prescricaoV1({ itens: [itemV1({ alternativas, opcoesEquivalentes })] }), geradorIds())
      expect(m.itens[0]!.opcoes.map((o) => [o.texto, o.motivo])).toEqual([
        ['Medicamento Teste A', 'Padrão'],
        ['Medicamento Teste B', 'Motivo Teste'],
      ])
      expect(m.revisada).toBe(true)
    }
  })

  it('item sem regra e sem alternativas: uma opção com o mesmo texto; revisada mantida', () => {
    for (const revisada of [true, false]) {
      const m = migrarPrescricaoV1(prescricaoV1({ revisada, itens: [itemV1({ texto: 'Medicamento Teste A {dose}' })] }))
      expect(m.itens[0]!.opcoes).toHaveLength(1)
      expect(m.itens[0]!.opcoes[0]!.texto).toBe('Medicamento Teste A {dose}')
      expect(m.itens[0]!.opcoes[0]!.motivo).toBe('')
      expect(m.revisada).toBe(revisada)
      expect(m.duvidasImportacao).toEqual([])
    }
  })

  it('registro antigo sem receita, condições e condicaoId recebe os vazios', () => {
    const antigo = prescricaoV1() as Partial<PrescricaoV1>
    delete antigo.receita
    delete antigo.condicoes
    const m = migrarPrescricaoV1(antigo as PrescricaoV1, geradorIds())
    expect(m.receita).toBe('')
    expect(m.condicoes).toEqual([])
    expect(m.itens[0]!.condicaoId).toBeNull()
  })

  it('mantém todos os outros dados: campos, condições, vínculos e alertas; calculadoraIds vazio', () => {
    const p = prescricaoV1({
      condicoes: [{ id: 'c-a', nome: 'Condição Teste A' }],
      itens: [itemV1({ id: 'i-1' }), itemV1({ id: 'i-2', texto: 'Medicamento Teste B', condicaoId: 'c-a' })],
      alertas: [
        { id: 'al-1', tipo: 'contraindicacao', gravidade: 'critico', texto: 'Alerta Teste', itemId: 'i-2' },
        { id: 'al-2', tipo: 'outro', gravidade: 'informativo', texto: 'Alerta Geral Teste', itemId: null },
      ],
      origem: 'importada_ia',
      excluidoEm: '2026-01-03T00:00:00.000Z',
    })
    const m = migrarPrescricaoV1(p, geradorIds())
    expect(m.alertas).toEqual(p.alertas)
    expect(m.itens.map((i) => [i.id, i.condicaoId])).toEqual([
      ['i-1', null],
      ['i-2', 'c-a'],
    ])
    expect(m.condicoes).toEqual(p.condicoes)
    expect(m.calculadoraIds).toEqual([])
    const { itens: _i, calculadoraIds: _c, ...resto } = m
    const { itens: _iv1, ...restoV1 } = p
    expect(resto).toEqual(restoV1)
  })

  it('não altera o registro original', () => {
    const p = prescricaoV1({ itens: [itemV1({ texto: '{dose}', regraDose: regraSimples })] })
    const copia = structuredClone(p)
    migrarPrescricaoV1(p, geradorIds())
    expect(p).toEqual(copia)
  })
})

describe('esquemaArquivoBackupV1', () => {
  it('aceita um backup da v1 (itens com texto, regra e alternativas) e a migração o converte', () => {
    const arquivo = {
      formato: 'plantao-facil-backup',
      versaoFormato: 1,
      exportadoEm: '2026-01-05T00:00:00.000Z',
      versaoApp: '1.0.0',
      prescricoes: [
        prescricaoV1({
          itens: [
            itemV1({
              texto: 'Medicamento Teste A {dose}',
              regraDose: regraSimples,
              alternativas: [{ id: 'a-1', motivo: 'Motivo Teste', texto: 'Medicamento Teste B', regraDose: null }],
            }),
          ],
        }),
      ],
      calculadoras: [],
      categorias: [],
    }
    const r = v.safeParse(esquemaArquivoBackupV1, arquivo)
    expect(r.success).toBe(true)
    if (r.success) {
      const m = migrarPrescricaoV1(r.output.prescricoes[0]!, geradorIds())
      expect(m.itens[0]!.opcoes.map((o) => [o.texto, o.motivo])).toEqual([
        [`Medicamento Teste A [${DESC_SIMPLES}]`, 'Padrão'],
        ['Medicamento Teste B', 'Motivo Teste'],
      ])
    }
  })
})
