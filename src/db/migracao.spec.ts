// Dados fictícios de teste — nenhum conteúdo clínico real.
import 'fake-indexeddb/auto'
import { Dexie } from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { criarBanco, type BancoPlantao } from '@/db/banco'
import { lerBiblioteca } from '@/db/backup'
import { lerBackup, planejarMesclagem } from '@/dominio/backup/backup'

/** Esquema do banco da v1 (versão 1 do Dexie), congelado para o teste. */
const STORES_V1 = {
  prescricoes: 'id, categoriaId, *tags, atualizadoEm',
  calculadoras: 'id, categoriaId, tipo, atualizadoEm',
  categorias: 'id, escopo, atualizadoEm',
  configuracoes: 'id',
}

const T1 = '2026-01-01T00:00:00.000Z'
const T2 = '2026-01-02T00:00:00.000Z'

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

/** Registro cru como a v1 mais antiga gravava: sem receita, condicoes, opcoesEquivalentes e condicaoId. */
function prescricaoV1Crua(id: string, parcial: Record<string, unknown> = {}) {
  return {
    id,
    criadoEm: T1,
    atualizadoEm: T2,
    excluidoEm: null,
    titulo: 'Situação Teste A',
    categoriaId: 'cat-1',
    tags: ['Tag Teste'],
    itens: [{ id: 'i-1', texto: 'Medicamento Teste A {dose}', regraDose: regraV1, alternativas: [] }],
    alertas: [{ id: 'al-1', tipo: 'atencao', gravidade: 'atencao', texto: 'Alerta Teste', itemId: 'i-1' }],
    observacoes: 'Observação Teste',
    referencia: '',
    favorito: true,
    origem: 'manual',
    revisada: true,
    duvidasImportacao: [],
    ...parcial,
  }
}

/** Categoria criada antes dos ícones (sem o campo `icone`). */
const categoriaSemIcone = {
  id: 'cat-1',
  criadoEm: T1,
  atualizadoEm: T1,
  excluidoEm: null,
  nome: 'Categoria Teste A',
  escopo: 'prescricao',
  ordem: 0,
}

const calculadoraV1 = {
  id: 'calc-1',
  criadoEm: T1,
  atualizadoEm: T1,
  excluidoEm: null,
  tipo: 'pontos',
  nome: 'Escore Teste',
  categoriaId: null,
  descricao: '',
  referencia: '',
  faixas: [],
  favorito: false,
  campos: [{ id: 'c1', tipo: 'sim_nao', rotulo: 'Campo Teste', pontosSim: 1, pontosNao: 0 }],
}

let nome = ''
let banco: BancoPlantao | null = null

afterEach(async () => {
  banco?.close()
  await Dexie.delete(nome)
  banco = null
})

async function gravarComoV1(dados: { prescricoes: unknown[]; categorias: unknown[]; calculadoras: unknown[] }) {
  nome = `teste-migracao-${crypto.randomUUID()}`
  const antigo = new Dexie(nome)
  antigo.version(1).stores(STORES_V1)
  await antigo.table('prescricoes').bulkPut(dados.prescricoes)
  await antigo.table('categorias').bulkPut(dados.categorias)
  await antigo.table('calculadoras').bulkPut(dados.calculadoras)
  antigo.close()
}

describe('migração do banco (Dexie versão 1 → 2)', () => {
  it('converte as prescrições v1, inclusive as da lixeira, e mantém categorias e calculadoras', async () => {
    await gravarComoV1({
      prescricoes: [prescricaoV1Crua('p-ativa'), prescricaoV1Crua('p-lixeira', { excluidoEm: T2 })],
      categorias: [categoriaSemIcone],
      calculadoras: [calculadoraV1],
    })

    banco = criarBanco(nome)
    await banco.open()
    expect(banco.verno).toBe(2)

    const prescricoes = await banco.prescricoes.orderBy('id').toArray()
    expect(prescricoes.map((p) => p.id)).toEqual(['p-ativa', 'p-lixeira'])
    for (const p of prescricoes) {
      expect(p.itens[0]!.id).toBe('i-1')
      expect(p.itens[0]!.condicaoId).toBeNull()
      expect(p.itens[0]!.opcoes).toHaveLength(1)
      expect(p.itens[0]!.opcoes[0]!.texto).toBe('Medicamento Teste A [10 mg/kg, máx. 500 mg/tomada]')
      expect(p.itens[0]!.opcoes[0]!.motivo).toBe('')
      expect(p.revisada).toBe(false)
      expect(p.receita).toBe('')
      expect(p.condicoes).toEqual([])
      expect(p.calculadoraIds).toEqual([])
      expect(p.alertas).toEqual([
        { id: 'al-1', tipo: 'atencao', gravidade: 'atencao', texto: 'Alerta Teste', itemId: 'i-1' },
      ])
      expect(p.duvidasImportacao).toHaveLength(1)
      // Campos antigos do item não ficam no registro.
      expect(p.itens[0]).not.toHaveProperty('texto')
      expect(p.itens[0]).not.toHaveProperty('regraDose')
      expect(p.itens[0]).not.toHaveProperty('alternativas')
    }
    expect(prescricoes[1]!.excluidoEm).toBe(T2)

    // Categoria intacta (o ícone ausente continua ausente no banco; a leitura normaliza para null).
    expect(await banco.categorias.toArray()).toEqual([categoriaSemIcone])
    expect(await banco.calculadoras.toArray()).toEqual([calculadoraV1])
    const biblioteca = await lerBiblioteca(banco)
    expect(biblioteca.categorias[0]!.icone).toBeNull()
  })

  it('se um registro não puder ser convertido, a atualização é desfeita e nada se perde', async () => {
    await gravarComoV1({
      prescricoes: [prescricaoV1Crua('p-boa'), prescricaoV1Crua('p-quebrada', { itens: null })],
      categorias: [],
      calculadoras: [],
    })
    banco = criarBanco(nome)
    await expect(banco.open()).rejects.toThrow()
    banco.close()

    const antigo = new Dexie(nome)
    antigo.version(1).stores(STORES_V1)
    const registros = await antigo.table('prescricoes').orderBy('id').toArray()
    expect(antigo.verno).toBe(1)
    expect(registros).toEqual([prescricaoV1Crua('p-boa'), prescricaoV1Crua('p-quebrada', { itens: null })])
    antigo.close()
  })

  it('banco v1 vazio abre normalmente', async () => {
    await gravarComoV1({ prescricoes: [], categorias: [], calculadoras: [] })
    banco = criarBanco(nome)
    expect(await banco.prescricoes.count()).toBe(0)
    expect(banco.verno).toBe(2)
  })

  it('backup v1 do mesmo conteúdo, importado num aparelho já migrado, fica todo "igual" (sem falso conflito)', async () => {
    const prescricoes = [
      // Registros crus antigos (sem receita/condições/condicaoId), no banco e no arquivo.
      prescricaoV1Crua('p-ativa', {
        itens: [
          {
            id: 'i-1',
            texto: 'Medicamento Teste A {dose}',
            regraDose: regraV1,
            alternativas: [{ id: 'a-1', motivo: 'Motivo Teste', texto: 'Medicamento Teste B', regraDose: null }],
          },
          {
            id: 'i-2',
            texto: 'Opção Teste 1',
            regraDose: null,
            opcoesEquivalentes: true,
            alternativas: [{ id: 'a-2', motivo: '', texto: 'Opção Teste 2', regraDose: null }],
          },
        ],
      }),
      prescricaoV1Crua('p-lixeira', { excluidoEm: T2 }),
    ]
    const categorias = [categoriaSemIcone]
    await gravarComoV1({ prescricoes, categorias, calculadoras: [] })
    banco = criarBanco(nome)

    const textoBackupV1 = JSON.stringify({
      formato: 'plantao-facil-backup',
      versaoFormato: 1,
      exportadoEm: T2,
      versaoApp: '1.0.0',
      prescricoes,
      calculadoras: [],
      categorias,
    })
    const lido = lerBackup(textoBackupV1)
    expect(lido.ok).toBe(true)
    if (!lido.ok) return

    const plano = planejarMesclagem(await lerBiblioteca(banco), lido.backup)
    expect(plano.prescricoes.map((i) => [i.id, i.situacao])).toEqual([
      ['p-ativa', 'igual'],
      ['p-lixeira', 'igual'],
    ])
    expect(plano.categorias.map((i) => i.situacao)).toEqual(['igual'])
  })
})
