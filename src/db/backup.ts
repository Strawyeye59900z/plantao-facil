import { db, type BancoPlantao } from '@/db/banco'
import type { Biblioteca } from '@/dominio/backup/backup'

/** Tudo, inclusive itens na lixeira. */
export async function lerBiblioteca(banco: BancoPlantao = db): Promise<Biblioteca> {
  const [prescricoes, calculadoras, categorias] = await Promise.all([
    banco.prescricoes.toArray(),
    banco.calculadoras.toArray(),
    banco.categorias.toArray(),
  ])
  // Registros criados antes dos ícones/receita não têm o campo: normaliza para não gerar falso conflito.
  return {
    prescricoes: prescricoes.map((p) => ({ ...p, receita: p.receita ?? '' })),
    calculadoras,
    categorias: categorias.map((c) => ({ ...c, icone: c.icone ?? null })),
  }
}

/** Cópia simples: o IndexedDB não aceita os proxies reativos do Vue. */
function semProxy(b: Biblioteca): Biblioteca {
  return JSON.parse(JSON.stringify(b)) as Biblioteca
}

/** Grava (insere ou sobrescreve) numa única transação: ou entra tudo, ou nada muda. */
export async function gravarNaBiblioteca(dados: Biblioteca, banco: BancoPlantao = db): Promise<void> {
  const b = semProxy(dados)
  await banco.transaction('rw', banco.prescricoes, banco.calculadoras, banco.categorias, async () => {
    await banco.categorias.bulkPut(b.categorias)
    await banco.prescricoes.bulkPut(b.prescricoes)
    await banco.calculadoras.bulkPut(b.calculadoras)
  })
}

/** Apaga a biblioteca do aparelho e grava a do arquivo, numa única transação. */
export async function substituirBiblioteca(dados: Biblioteca, banco: BancoPlantao = db): Promise<void> {
  const b = semProxy(dados)
  await banco.transaction('rw', banco.prescricoes, banco.calculadoras, banco.categorias, async () => {
    await Promise.all([banco.prescricoes.clear(), banco.calculadoras.clear(), banco.categorias.clear()])
    await banco.categorias.bulkPut(b.categorias)
    await banco.prescricoes.bulkPut(b.prescricoes)
    await banco.calculadoras.bulkPut(b.calculadoras)
  })
}
