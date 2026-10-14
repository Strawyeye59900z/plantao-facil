import { db } from '@/db/banco'
import { substituirBiblioteca } from '@/db/backup'
import { lerBackup } from '@/dominio/backup/backup'
import { CHAVE_TEMA_CACHE, useConfiguracoesStore } from '@/stores/configuracoes'
import { useCategoriasStore } from '@/stores/categorias'
import { usePrescricoesStore } from '@/stores/prescricoes'

/**
 * Modo pen drive: troca toda a biblioteca deste PC pelo backup escolhido (sem mesclar).
 * Retorna mensagem de erro, ou null se deu certo.
 */
export async function carregarBibliotecaDoArquivo(arquivo: File): Promise<string | null> {
  const leitura = lerBackup(await arquivo.text())
  if (!leitura.ok) return leitura.erro
  const { prescricoes, calculadoras, categorias, exportadoEm } = leitura.backup
  try {
    await substituirBiblioteca({ prescricoes, calculadoras, categorias })
  } catch (erro) {
    return `Não foi possível salvar a biblioteca: ${erro instanceof Error ? erro.message : String(erro)}`
  }
  await useConfiguracoesStore().registrarBibliotecaPenDrive(exportadoEm)
  await Promise.all([usePrescricoesStore().carregar(), useCategoriasStore().carregar()])
  return null
}

/** Apaga tudo o que o app guardou neste navegador (biblioteca, configurações, tema). */
export async function apagarDadosDestePc(): Promise<void> {
  await db.transaction('rw', db.prescricoes, db.calculadoras, db.categorias, db.configuracoes, async () => {
    await Promise.all([db.prescricoes.clear(), db.calculadoras.clear(), db.categorias.clear(), db.configuracoes.clear()])
  })
  try {
    localStorage.removeItem(CHAVE_TEMA_CACHE)
  } catch {
    // sem localStorage: nada a apagar
  }
  await Promise.all([useConfiguracoesStore().carregar(), usePrescricoesStore().carregar(), useCategoriasStore().carregar()])
}
