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
      expect(lido.backup.versaoFormato).toBe(1)
    }
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

  it('backup antigo sem receita pronta é aceito (receita vazia) e não gera conflito', () => {
    const antigo = montarBackup(biblioteca({ prescricoes: [prescricaoTeste()] }), T1, '0.1.0')
    delete (antigo.prescricoes[0] as Partial<typeof antigo.prescricoes[0]>).receita
    const lido = lerBackup(JSON.stringify(antigo))
    expect(lido.ok).toBe(true)
    if (lido.ok) {
      expect(lido.backup.prescricoes[0]!.receita).toBe('')
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
    const r = lerBackup(JSON.stringify({ ...montarBackup(biblioteca(), T1, '9.9.9'), versaoFormato: 2 }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/versão mais nova/)
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
