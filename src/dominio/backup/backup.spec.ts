// Dados fictícios de teste — nenhum conteúdo clínico real.
import { describe, expect, it } from 'vitest'
import type { Calculadora } from '@/dominio/tipos'
import { categoriaTeste, prescricaoTeste } from '@/dominio/prescricoes/fixtures.spec-helper'
import {
  aplicarMesclagem,
  camposAlterados,
  contarSituacoes,
  lerBackup,
  montarBackup,
  nomeArquivoBackup,
  planejarMesclagem,
  type Biblioteca,
} from './backup'

const T1 = '2026-01-01T00:00:00.000Z'
const T2 = '2026-02-01T00:00:00.000Z'

function biblioteca(parcial: Partial<Biblioteca> = {}): Biblioteca {
  return { prescricoes: [], calculadoras: [], categorias: [], ...parcial }
}

const calculadoraTeste: Calculadora = {
  id: 'calc-1',
  criadoEm: T1,
  atualizadoEm: T1,
  excluidoEm: null,
  area: 'escala',
  tipo: 'pontos',
  nome: 'Escore Teste',
  categoriaId: null,
  descricao: '',
  referencia: '',
  faixas: [{ id: 'f1', de: 0, ate: 2, texto: 'Faixa Teste', gravidade: 'informativo' }],
  favorito: false,
  campos: [{ id: 'c1', tipo: 'sim_nao', rotulo: 'Campo Teste', pontosSim: 1, pontosNao: 0 }],
}

describe('exportar e ler', () => {
  it('ida e volta sem perder dados (inclui itens na lixeira)', () => {
    const b = biblioteca({
      categorias: [categoriaTeste()],
      prescricoes: [prescricaoTeste(), prescricaoTeste({ id: 'p-2', excluidoEm: T2 })],
      calculadoras: [calculadoraTeste],
    })
    const texto = JSON.stringify(montarBackup(b, T2, '0.1.0'))
    const lido = lerBackup(texto)
    expect(lido.ok).toBe(true)
    if (lido.ok) {
      expect(lido.backup.prescricoes).toEqual(b.prescricoes)
      expect(lido.backup.categorias).toEqual(b.categorias)
      expect(lido.backup.calculadoras).toEqual(b.calculadoras)
      expect(lido.backup.versaoFormato).toBe(2)
    }
  })

  it('montarBackup grava o formato 2', () => {
    expect(montarBackup(biblioteca(), T1, '0.1.0').versaoFormato).toBe(2)
  })

  it('backup antigo sem ícone de categoria é aceito (ícone = null) e não gera conflito', () => {
    const antigo = montarBackup(biblioteca({ categorias: [categoriaTeste()] }), T1, '0.1.0')
    delete (antigo.categorias[0] as Partial<typeof antigo.categorias[0]>).icone
    const lido = lerBackup(JSON.stringify(antigo))
    expect(lido.ok).toBe(true)
    if (lido.ok) {
      expect(lido.backup.categorias[0]!.icone).toBeNull()
      const plano = planejarMesclagem(biblioteca({ categorias: [categoriaTeste()] }), lido.backup)
      expect(plano.categorias[0]!.situacao).toBe('igual')
    }
  })

  it('backup antigo sem receita pronta e sem condições é aceito (vazios) e não gera conflito', () => {
    const antigo = montarBackup(biblioteca({ prescricoes: [prescricaoTeste()] }), T1, '0.1.0')
    delete (antigo.prescricoes[0] as Partial<typeof antigo.prescricoes[0]>).receita
    delete (antigo.prescricoes[0] as Partial<typeof antigo.prescricoes[0]>).condicoes
    const lido = lerBackup(JSON.stringify(antigo))
    expect(lido.ok).toBe(true)
    if (lido.ok) {
      expect(lido.backup.prescricoes[0]!.receita).toBe('')
      expect(lido.backup.prescricoes[0]!.condicoes).toEqual([])
      const plano = planejarMesclagem(biblioteca({ prescricoes: [prescricaoTeste()] }), lido.backup)
      expect(plano.prescricoes[0]!.situacao).toBe('igual')
    }
  })

  it('nome do arquivo com data e hora local', () => {
    expect(nomeArquivoBackup(new Date(2026, 9, 4, 7, 5))).toBe('plantao-facil-backup-2026-10-04-0705.json')
  })

  it('rejeita JSON inválido', () => {
    expect(lerBackup('{ não é json')).toEqual({ ok: false, erro: 'O arquivo não é um JSON válido.' })
  })

  it('rejeita arquivo que não é backup do app', () => {
    expect(lerBackup('{"qualquer": 1}')).toEqual({ ok: false, erro: 'Este arquivo não é um backup do Plantão Fácil.' })
  })

  it('rejeita versão de formato mais nova', () => {
    const r = lerBackup(JSON.stringify({ ...montarBackup(biblioteca(), T1, '9.9.9'), versaoFormato: 3 }))
    expect(r).toEqual({
      ok: false,
      erro: 'Este backup foi feito numa versão mais nova do app. Atualize o app antes de importar.',
    })
  })

  it('rejeita item sem nenhuma opção (formato 2)', () => {
    const ruim = montarBackup(
      biblioteca({ prescricoes: [prescricaoTeste({ itens: [{ id: 'i-1', condicaoId: null, opcoes: [] }] })] }),
      T1,
      '0.1.0',
    )
    const r = lerBackup(JSON.stringify(ruim))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/prescricoes\.0\.itens\.0\.opcoes/)
  })

  it('rejeita dados inválidos e informa onde', () => {
    const ruim = { ...montarBackup(biblioteca({ prescricoes: [prescricaoTeste()] }), T1, '0.1.0') }
    ;(ruim.prescricoes[0] as unknown as Record<string, unknown>).titulo = 42
    const r = lerBackup(JSON.stringify(ruim))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/prescricoes\.0\.titulo/)
  })

  it('rejeita IDs repetidos', () => {
    const r = lerBackup(JSON.stringify(montarBackup(biblioteca({ prescricoes: [prescricaoTeste(), prescricaoTeste()] }), T1, '0.1.0')))
    expect(r).toEqual({ ok: false, erro: 'O backup tem prescrições com ID repetido e não foi importado.' })
  })
})

describe('ler backup do formato 1 (v1)', () => {
  const regraV1 = {
    dosePorKg: 10,
    unidade: 'mg',
    baseDoseKg: 'por_tomada',
    tomadasPorDia: null,
    doseMaximaPorTomada: 500,
    doseMaximaDiaria: null,
    pesoLimite: null,
    concentracao: null,
    arredondamentoDose: { modo: 'inteiro' },
    arredondamentoVolume: { modo: 'casas_decimais', casas: 1 },
  }

  function prescricaoV1(id: string, parcial: Record<string, unknown> = {}) {
    return {
      id,
      criadoEm: T1,
      atualizadoEm: T1,
      excluidoEm: null,
      titulo: 'Situação Teste A',
      categoriaId: 'c-1',
      tags: [],
      itens: [
        {
          id: 'i-1',
          texto: 'Medicamento Teste A {dose}',
          regraDose: regraV1,
          alternativas: [{ id: 'a-1', motivo: 'Motivo Teste', texto: 'Medicamento Teste B', regraDose: null }],
        },
      ],
      alertas: [],
      observacoes: '',
      referencia: '',
      favorito: false,
      origem: 'manual',
      revisada: true,
      duvidasImportacao: [],
      ...parcial,
    }
  }

  function arquivoV1(parcial: Record<string, unknown> = {}) {
    const categoria: Record<string, unknown> = { ...categoriaTeste() }
    delete categoria.icone
    return {
      formato: 'plantao-facil-backup',
      versaoFormato: 1,
      exportadoEm: T2,
      versaoApp: '1.0.0',
      prescricoes: [prescricaoV1('p-1'), prescricaoV1('p-2', { excluidoEm: T2 })],
      calculadoras: [calculadoraTeste],
      categorias: [categoria],
      ...parcial,
    }
  }

  it('é lido como formato 2, com as prescrições convertidas (inclusive as da lixeira)', () => {
    const lido = lerBackup(JSON.stringify(arquivoV1()))
    expect(lido.ok).toBe(true)
    if (!lido.ok) return
    const b = lido.backup
    expect(b.formato).toBe('plantao-facil-backup')
    expect(b.versaoFormato).toBe(2)
    expect(b.exportadoEm).toBe(T2)
    expect(b.versaoApp).toBe('1.0.0')
    expect(b.prescricoes.map((p) => [p.id, p.excluidoEm])).toEqual([
      ['p-1', null],
      ['p-2', T2],
    ])
    for (const p of b.prescricoes) {
      expect(p.itens[0]!.opcoes.map((o) => [o.texto, o.motivo])).toEqual([
        ['Medicamento Teste A [10 mg/kg, máx. 500 mg/tomada]', 'Padrão'],
        ['Medicamento Teste B', 'Motivo Teste'],
      ])
      expect(p.revisada).toBe(false)
      expect(p.receita).toBe('')
      expect(p.condicoes).toEqual([])
      expect(p.calculadoraIds).toEqual([])
    }
    expect(b.calculadoras).toEqual([calculadoraTeste])
    expect(b.categorias).toEqual([categoriaTeste()])
  })

  it('o resultado convertido passa na validação do formato 2', () => {
    const lido = lerBackup(JSON.stringify(arquivoV1()))
    expect(lido.ok).toBe(true)
    if (lido.ok) expect(lerBackup(JSON.stringify(lido.backup)).ok).toBe(true)
  })

  it('rejeita formato 1 com dados inválidos e informa onde', () => {
    const r = lerBackup(JSON.stringify(arquivoV1({ prescricoes: [prescricaoV1('p-1', { titulo: 42 })] })))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/^O backup tem dados inválidos e não foi importado \(.*prescricoes\.0\.titulo/)
  })

  it('rejeita formato 1 com o modelo novo de itens', () => {
    const r = lerBackup(JSON.stringify(arquivoV1({ prescricoes: [prescricaoTeste()] })))
    expect(r.ok).toBe(false)
  })

  it('rejeita formato 1 com IDs repetidos', () => {
    const r = lerBackup(JSON.stringify(arquivoV1({ prescricoes: [prescricaoV1('p-1'), prescricaoV1('p-1')] })))
    expect(r).toEqual({ ok: false, erro: 'O backup tem prescrições com ID repetido e não foi importado.' })
  })
})

describe('planejar mesclagem', () => {
  it('classifica novo, igual e conflito; o que só existe no aparelho não entra no plano', () => {
    const local = biblioteca({
      prescricoes: [
        prescricaoTeste({ id: 'igual' }),
        prescricaoTeste({ id: 'conflito', titulo: 'Versão do aparelho' }),
        prescricaoTeste({ id: 'so-local' }),
      ],
    })
    const arquivo = biblioteca({
      prescricoes: [
        prescricaoTeste({ id: 'igual' }),
        prescricaoTeste({ id: 'conflito', titulo: 'Versão do arquivo', atualizadoEm: T2 }),
        prescricaoTeste({ id: 'novo' }),
      ],
    })
    const plano = planejarMesclagem(local, arquivo)
    expect(plano.prescricoes.map((i) => [i.id, i.situacao])).toEqual([
      ['igual', 'igual'],
      ['conflito', 'conflito'],
      ['novo', 'novo'],
    ])
    expect(contarSituacoes(plano.prescricoes)).toEqual({ novo: 1, igual: 1, conflito: 1 })
    const conflito = plano.prescricoes[1]!
    expect(conflito.maisRecente).toBe('arquivo')
    expect(conflito.campos).toEqual(['titulo'])
  })

  it('só atualizadoEm diferente conta como igual', () => {
    const plano = planejarMesclagem(
      biblioteca({ prescricoes: [prescricaoTeste()] }),
      biblioteca({ prescricoes: [prescricaoTeste({ atualizadoEm: T2 })] }),
    )
    expect(plano.prescricoes[0]!.situacao).toBe('igual')
  })

  it('exclusão (lixeira) em um lado e ativa no outro é conflito', () => {
    const plano = planejarMesclagem(
      biblioteca({ prescricoes: [prescricaoTeste()] }),
      biblioteca({ prescricoes: [prescricaoTeste({ excluidoEm: T2, atualizadoEm: T2 })] }),
    )
    expect(plano.prescricoes[0]!.situacao).toBe('conflito')
    expect(plano.prescricoes[0]!.campos).toEqual(['excluidoEm'])
  })

  it('empate de data: mais recente = aparelho', () => {
    const plano = planejarMesclagem(
      biblioteca({ prescricoes: [prescricaoTeste({ titulo: 'A' })] }),
      biblioteca({ prescricoes: [prescricaoTeste({ titulo: 'B' })] }),
    )
    expect(plano.prescricoes[0]!.maisRecente).toBe('local')
  })

  it('junta categorias de mesmo nome e escopo (sem acento/maiúscula) e remapeia prescrições', () => {
    const local = biblioteca({ categorias: [categoriaTeste({ id: 'cat-local', nome: 'Categoria Ácida' })] })
    const arquivo = biblioteca({
      categorias: [
        categoriaTeste({ id: 'cat-arq', nome: 'categoria acida' }),
        categoriaTeste({ id: 'cat-outro-escopo', nome: 'Categoria Ácida', escopo: 'calculadora' }),
      ],
      prescricoes: [prescricaoTeste({ id: 'p-arq', categoriaId: 'cat-arq' })],
    })
    const plano = planejarMesclagem(local, arquivo)
    expect(plano.categoriasUnificadas).toEqual([{ nome: 'Categoria Ácida', idArquivo: 'cat-arq', idLocal: 'cat-local' }])
    expect(plano.categorias.map((c) => c.id)).toEqual(['cat-outro-escopo'])
    expect(plano.prescricoes[0]!.arquivo.categoriaId).toBe('cat-local')
  })

  it('não junta categoria excluída', () => {
    const local = biblioteca({ categorias: [categoriaTeste({ id: 'cat-local', excluidoEm: T2 })] })
    const arquivo = biblioteca({ categorias: [categoriaTeste({ id: 'cat-arq' })] })
    expect(planejarMesclagem(local, arquivo).categoriasUnificadas).toEqual([])
  })
})

describe('aplicar mesclagem', () => {
  const local = biblioteca({
    prescricoes: [
      prescricaoTeste({ id: 'c1', titulo: 'Aparelho 1' }),
      prescricaoTeste({ id: 'c2', titulo: 'Aparelho 2', atualizadoEm: T2 }),
      prescricaoTeste({ id: 'igual' }),
    ],
  })
  const arquivo = biblioteca({
    prescricoes: [
      prescricaoTeste({ id: 'c1', titulo: 'Arquivo 1', atualizadoEm: T2 }),
      prescricaoTeste({ id: 'c2', titulo: 'Arquivo 2' }),
      prescricaoTeste({ id: 'igual' }),
      prescricaoTeste({ id: 'novo' }),
    ],
  })
  const plano = planejarMesclagem(local, arquivo)

  it('sem escolhas: novos + conflitos em que o arquivo é mais recente', () => {
    expect(aplicarMesclagem(plano, {}).prescricoes.map((p) => [p.id, p.titulo])).toEqual([
      ['c1', 'Arquivo 1'],
      ['novo', 'Situação Teste A'],
    ])
  })

  it('escolhas manuais prevalecem', () => {
    expect(aplicarMesclagem(plano, { c1: 'local', c2: 'arquivo' }).prescricoes.map((p) => p.id)).toEqual([
      'c2',
      'novo',
    ])
  })
})

describe('camposAlterados', () => {
  it('ignora ordem das chaves e atualizadoEm', () => {
    const a = prescricaoTeste()
    const b = Object.fromEntries(Object.entries(prescricaoTeste({ atualizadoEm: T2 })).reverse()) as typeof a
    expect(camposAlterados(a, b)).toEqual([])
  })
})

describe('esquema das calculadoras v2', () => {
  const base = { criadoEm: T1, atualizadoEm: T1, excluidoEm: null, categoriaId: null, descricao: '', referencia: '', favorito: false }
  const dosePeso = {
    ...base, id: 'dp', area: 'calculadora', tipo: 'dose_peso', nome: 'Dose Teste',
    linhas: [{ id: 'l1', texto: 'Medicamento Teste A {inducao}', regras: [{ id: 'r1', marcador: 'inducao', dosePorKg: 2, unidade: 'mg', concentracao: 10, doseMaxima: null, casasDecimais: 1 }] }],
  }
  const formula = {
    ...base, id: 'fo', area: 'calculadora', tipo: 'formula', nome: 'Fórmula Teste',
    campos: [
      { id: 'c1', tipo: 'numero', variavel: 'a', rotulo: 'A', unidade: 'u', min: 0, max: null },
      { id: 'c2', tipo: 'sim_nao', variavel: 'b', rotulo: 'B', valorSim: 1, valorNao: 0 },
    ],
    saidas: [{ id: 's1', nome: 'Resultado', expressao: 'a + b', unidade: 'u', casasDecimais: 1, teto: null, piso: 0,
      faixas: [{ id: 'f1', de: null, ate: 5, texto: 'Faixa Teste', gravidade: 'informativo' }] }],
  }
  const pontos = { ...base, id: 'po', area: 'escala', tipo: 'pontos', nome: 'Escore Teste', faixas: [], campos: [] }
  const arquivo = (calculadoras: unknown[]) =>
    JSON.stringify({ formato: 'plantao-facil-backup', versaoFormato: 2, exportadoEm: T2, versaoApp: '1.0.0', prescricoes: [], categorias: [], calculadoras })

  it('aceita dose_peso e fórmula no formato novo', () => {
    const lido = lerBackup(arquivo([dosePeso, formula, pontos]))
    expect(lido.ok).toBe(true)
    if (lido.ok) expect(lido.backup.calculadoras).toEqual([dosePeso, formula, pontos])
  })

  it('rejeita dose_peso em escala e pontos em calculadora', () => {
    expect(lerBackup(arquivo([{ ...dosePeso, area: 'escala' }])).ok).toBe(false)
    expect(lerBackup(arquivo([{ ...pontos, area: 'calculadora' }])).ok).toBe(false)
  })

  it('backup v1 com pontos e fórmula é convertido e validado', () => {
    const v1Pontos = { ...base, id: 'p1', tipo: 'pontos', nome: 'Escore Teste', faixas: [], campos: [] }
    const v1Formula = {
      ...base, id: 'f1', tipo: 'formula', nome: 'Fórmula Teste', faixas: [],
      entradas: [{ id: 'e1', variavel: 'a', rotulo: 'A', unidade: 'u', min: 0, max: 10 }],
      expressao: 'a * 2', unidadeResultado: 'u', casasDecimais: 1, teto: null, piso: null,
    }
    const v1 = JSON.stringify({ formato: 'plantao-facil-backup', versaoFormato: 1, exportadoEm: T2, versaoApp: '1.0.0', prescricoes: [], categorias: [], calculadoras: [v1Pontos, v1Formula] })
    const lido = lerBackup(v1)
    expect(lido.ok).toBe(true)
    if (!lido.ok) return
    expect(lido.backup.calculadoras[0]).toMatchObject({ id: 'p1', area: 'escala', tipo: 'pontos' })
    expect(lido.backup.calculadoras[1]).toMatchObject({ id: 'f1', area: 'calculadora', tipo: 'formula' })
    expect(lerBackup(JSON.stringify(lido.backup)).ok).toBe(true)
  })
})
