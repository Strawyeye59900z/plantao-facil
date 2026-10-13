import 'fake-indexeddb/auto'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/banco'
import { prescricaoVazia } from '@/dominio/prescricoes/editar'
import { ROTULO_SEM_CATEGORIA, useCategoriasStore } from './categorias'
import { usePrescricoesStore } from './prescricoes'
import { MAX_RECENTES, useRecentesStore } from './recentes'

beforeEach(async () => {
  setActivePinia(createPinia())
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('recentes', () => {
  it(`guarda no máximo ${MAX_RECENTES} por tipo, mais recente primeiro e sem repetir`, () => {
    const recentes = useRecentesStore()
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) recentes.registrar('prescricao', id)
    recentes.registrar('prescricao', 'd')
    recentes.registrar('calculadora', 'x')
    expect(recentes.ids('prescricao')).toEqual(['d', 'f', 'e', 'c', 'b'])
    expect(recentes.ids('calculadora')).toEqual(['x'])
  })
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
