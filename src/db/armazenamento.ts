export type StatusArmazenamento = 'persistente' | 'nao_persistente' | 'indisponivel'

/**
 * Pede ao navegador para não apagar os dados locais sob pressão de espaço.
 * O Chrome/Android pode conceder automaticamente (ex.: app instalado) ou negar.
 */
export async function pedirArmazenamentoPersistente(): Promise<StatusArmazenamento> {
  if (!navigator.storage?.persist) return 'indisponivel'
  if (await navigator.storage.persisted()) return 'persistente'
  return (await navigator.storage.persist()) ? 'persistente' : 'nao_persistente'
}

export async function consultarArmazenamento(): Promise<{
  status: StatusArmazenamento
  usadoBytes: number | null
  cotaBytes: number | null
}> {
  if (!navigator.storage?.persisted) {
    return { status: 'indisponivel', usadoBytes: null, cotaBytes: null }
  }
  const persistido = await navigator.storage.persisted()
  const estimativa = await navigator.storage.estimate?.()
  return {
    status: persistido ? 'persistente' : 'nao_persistente',
    usadoBytes: estimativa?.usage ?? null,
    cotaBytes: estimativa?.quota ?? null,
  }
}
