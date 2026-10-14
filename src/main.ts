import { armazenamento, MODO_PENDRIVE } from './modo'

/** Testa se o navegador deixa usar o IndexedDB (alguns bloqueiam em páginas abertas como arquivo). */
async function indexedDbDisponivel(): Promise<boolean> {
  try {
    if (!globalThis.indexedDB) return false
    return await new Promise<boolean>((resolve) => {
      const pedido = indexedDB.open('plantao-facil-teste')
      pedido.onsuccess = () => {
        pedido.result.close()
        indexedDB.deleteDatabase('plantao-facil-teste')
        resolve(true)
      }
      pedido.onerror = () => resolve(false)
      setTimeout(() => resolve(false), 3000)
    })
  } catch {
    return false
  }
}

async function iniciar() {
  // Pen drive sem IndexedDB: banco só na memória da aba (o usuário carrega o backup a cada uso).
  // Precisa vir antes de carregar o Dexie, por isso o restante do app é importado depois.
  if (MODO_PENDRIVE && !(await indexedDbDisponivel())) {
    await import('fake-indexeddb/auto')
    armazenamento.emMemoria = true
  }
  const { montarApp } = await import('./app')
  await montarApp()
}

void iniciar()
