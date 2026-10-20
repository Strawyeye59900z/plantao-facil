import 'fake-indexeddb/auto'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/banco'
import { prescricaoVazia } from '@/dominio/prescricoes/editar'
import { ROTULO_SEM_CATEGORIA, useCategoriasStore } from './categorias'
import { usePrescricoesStore } from './prescricoes'
import { useCalculadorasStore } from './calculadoras'
import { useConfiguracoesStore } from './configuracoes'

beforeEach(async () => {
  setActivePinia(createPinia())
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('categorias', () => {
  it('cria em ordem crescente e reordena', async () => {
    const categorias = useCategoriasStore()
    const a = await categorias.criar('  Categoria Teste A ', 'prescricao')
    const b = await categorias.criar('Categoria Teste B', 'prescricao')
    await categorias.criar('Categoria Calc', 'calculadora')
    expect(a.nome).toBe('Categoria Teste A')
    expect(categorias.dePrescricoes.map((c) => c.id)).toEqual([a.id, b.id])

    await categorias.mover(b.id, -1)
    expect(categorias.dePrescricoes.map((c) => c.id)).toEqual([b.id, a.id])
  })

  it('excluir categoria deixa as prescrições "Sem categoria"', async () => {
    const categorias = useCategoriasStore()
    const prescricoes = usePrescricoesStore()
    const cat = await categorias.criar('Categoria Teste A', 'prescricao')
    const p = await prescricoes.criar({
      ...prescricaoVazia(),
      titulo: 'Situação Teste A',
      categoriaId: cat.id,
    })
    expect(categorias.emUso(cat.id)).toBe(1)

    await categorias.excluir(cat.id)

    expect(categorias.dePrescricoes).toHaveLength(0)
    expect(prescricoes.obter(p.id)!.categoriaId).toBeNull()
    expect(categorias.nome(null)).toBe(ROTULO_SEM_CATEGORIA)
    expect((await db.prescricoes.get(p.id))!.categoriaId).toBeNull()
  })
})

describe('categorias de escalas', () => {
  it('deEscalas lista só os grupos de escalas; excluir deixa a escala "Sem categoria"', async () => {
    const categorias = useCategoriasStore()
    const calculadoras = useCalculadorasStore()
    await categorias.criar('Grupo Calc Teste', 'calculadora')
    const g = await categorias.criar('Grupo Escala Teste', 'escala')
    expect(categorias.deEscalas.map((c) => c.id)).toEqual([g.id])

    const e = await calculadoras.criar({
      area: 'escala',
      tipo: 'pontos',
      nome: 'Escore Teste',
      categoriaId: g.id,
      descricao: '',
      referencia: '',
      favorito: false,
      faixas: [],
      campos: [],
    })
    await categorias.excluir(g.id)
    expect(categorias.deEscalas).toEqual([])
    expect(calculadoras.obter(e.id)!.categoriaId).toBeNull()
    expect((await db.calculadoras.get(e.id))!.categoriaId).toBeNull()
  })
})

describe('calculadoras ligadas às prescrições', () => {
  const escalaVazia = {
    area: 'escala' as const,
    tipo: 'pontos' as const,
    nome: 'Escore Teste',
    categoriaId: null,
    descricao: '',
    referencia: '',
    favorito: false,
    faixas: [],
    campos: [],
  }

  it('excluir de vez remove o id de calculadoraIds nas prescrições (memória e banco)', async () => {
    const calculadoras = useCalculadorasStore()
    const prescricoes = usePrescricoesStore()
    const a = await calculadoras.criar(escalaVazia)
    const b = await calculadoras.criar({ ...escalaVazia, nome: 'Escore Teste B' })
    const p = await prescricoes.criar({ ...prescricaoVazia(), titulo: 'Situação Teste A', calculadoraIds: [a.id, b.id] })
    const outra = await prescricoes.criar({ ...prescricaoVazia(), titulo: 'Situação Teste B', calculadoraIds: [b.id] })

    await calculadoras.moverParaLixeira(a.id)
    await calculadoras.excluirPermanentemente(a.id)
    expect(prescricoes.obter(p.id)!.calculadoraIds).toEqual([b.id])
    expect((await db.prescricoes.get(p.id))!.calculadoraIds).toEqual([b.id])
    expect(prescricoes.obter(outra.id)!.calculadoraIds).toEqual([b.id])
  })

  it('mover para a lixeira mantém o vínculo', async () => {
    const calculadoras = useCalculadorasStore()
    const prescricoes = usePrescricoesStore()
    const a = await calculadoras.criar(escalaVazia)
    const p = await prescricoes.criar({ ...prescricaoVazia(), titulo: 'Situação Teste A', calculadoraIds: [a.id] })
    await calculadoras.moverParaLixeira(a.id)
    expect(prescricoes.obter(p.id)!.calculadoraIds).toEqual([a.id])
    expect(calculadoras.ativas.map((c) => c.id)).not.toContain(a.id)
    expect((await db.prescricoes.get(p.id))!.calculadoraIds).toEqual([a.id])
  })
})

describe('prescricoes', () => {
  it('duplicar cria nova prescrição com "(cópia)"; lixeira e restauração funcionam', async () => {
    const prescricoes = usePrescricoesStore()
    const p = await prescricoes.criar({ ...prescricaoVazia(), titulo: 'Situação Teste A', favorito: true })
    const copia = await prescricoes.duplicar(p.id)
    expect(copia.id).not.toBe(p.id)
    expect(copia.titulo).toBe('Situação Teste A (cópia)')
    expect(prescricoes.ativas).toHaveLength(2)

    await prescricoes.moverParaLixeira(p.id)
    expect(prescricoes.ativas.map((x) => x.id)).toEqual([copia.id])
    expect(prescricoes.lixeira.map((x) => x.id)).toEqual([p.id])

    await prescricoes.restaurar(p.id)
    expect(prescricoes.lixeira).toHaveLength(0)
  })

  it('alternar favorito', async () => {
    const prescricoes = usePrescricoesStore()
    const p = await prescricoes.criar({ ...prescricaoVazia(), titulo: 'Situação Teste A' })
    await prescricoes.alternarFavorito(p.id)
    expect(prescricoes.favoritas.map((x) => x.id)).toEqual([p.id])
  })
})

describe('configurações', () => {
  it('configurações sem corDestaque salva carregam com verde', async () => {
    await db.configuracoes.put({
      id: 'local',
      tema: 'claro',
      ia: { provedor: 'gemini', chaves: {}, modelos: {} },
      ultimoBackupEm: null,
      bibliotecaPenDriveDe: null,
    } as never)
    const store = useConfiguracoesStore()
    await store.carregar()
    expect(store.config.corDestaque).toBe('verde')
    expect(document.documentElement.dataset.destaque).toBe('verde')
  })

  it('definirCorDestaque aplica e salva', async () => {
    const store = useConfiguracoesStore()
    await store.carregar()
    await store.definirCorDestaque('violeta')
    expect(document.documentElement.dataset.destaque).toBe('violeta')
    expect((await db.configuracoes.get('local'))!.corDestaque).toBe('violeta')
  })
})
