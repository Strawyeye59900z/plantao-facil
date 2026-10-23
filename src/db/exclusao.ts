import { db, type BancoPlantao } from '@/db/banco'
import type { UUID } from '@/dominio/tipos'

/**
 * Exclusões em massa. Tudo numa única transação: ou entra tudo, ou nada muda.
 * Prescrições vão para a lixeira (exclusão lógica); só a biblioteca inteira apaga de vez.
 */

/** Move para a lixeira as prescrições ativas com esses ids. Devolve quantas foram movidas. */
export async function moverPrescricoesParaLixeira(
  ids: UUID[],
  banco: BancoPlantao = db,
  agora: () => string = () => new Date().toISOString(),
): Promise<number> {
  return banco.transaction('rw', banco.prescricoes, async () => {
    const momento = agora()
    const alvo = (await banco.prescricoes.bulkGet(ids)).filter((p) => p !== undefined && p.excluidoEm === null)
    await banco.prescricoes.bulkPut(alvo.map((p) => ({ ...p!, excluidoEm: momento, atualizadoEm: momento })))
    return alvo.length
  })
}

/**
 * Move para a lixeira as prescrições ativas do grupo e exclui o grupo (que, como na tela Grupos,
 * não aparece na Lixeira). As prescrições mantêm o `categoriaId`: se forem restauradas, caem em "Sem grupo".
 */
export async function excluirGrupoComPrescricoes(
  grupoId: UUID,
  banco: BancoPlantao = db,
  agora: () => string = () => new Date().toISOString(),
): Promise<number> {
  return banco.transaction('rw', banco.prescricoes, banco.categorias, async () => {
    const grupo = await banco.categorias.get(grupoId)
    if (!grupo) throw new Error(`Grupo não encontrado: ${grupoId}`)
    const momento = agora()
    const alvo = (await banco.prescricoes.where('categoriaId').equals(grupoId).toArray()).filter((p) => p.excluidoEm === null)
    await banco.prescricoes.bulkPut(alvo.map((p) => ({ ...p, excluidoEm: momento, atualizadoEm: momento })))
    await banco.categorias.put({ ...grupo, excluidoEm: momento, atualizadoEm: momento })
    return alvo.length
  })
}

/** Apaga de vez prescrições, calculadoras, escalas e grupos (inclusive a lixeira). Configurações ficam. */
export async function apagarBibliotecaInteira(banco: BancoPlantao = db): Promise<void> {
  await banco.transaction('rw', banco.prescricoes, banco.calculadoras, banco.categorias, async () => {
    await Promise.all([banco.prescricoes.clear(), banco.calculadoras.clear(), banco.categorias.clear()])
  })
}
