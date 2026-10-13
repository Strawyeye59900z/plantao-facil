import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UsoRecente } from '@/dominio/tipos'

/** Máximo por tipo (prescrições e calculadoras contam separado). */
export const MAX_RECENTES = 5

type Tipo = UsoRecente['tipo']

/** Só em memória: some quando o app é fechado. */
export const useRecentesStore = defineStore('recentes', () => {
  const porTipo = ref<Record<Tipo, string[]>>({ prescricao: [], calculadora: [] })

  function registrar(tipo: Tipo, refId: string) {
    porTipo.value[tipo] = [refId, ...porTipo.value[tipo].filter((id) => id !== refId)].slice(
      0,
      MAX_RECENTES,
    )
  }

  function ids(tipo: Tipo): string[] {
    return porTipo.value[tipo]
  }

  return { porTipo, registrar, ids }
})
