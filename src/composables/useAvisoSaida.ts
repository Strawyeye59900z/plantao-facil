import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

/**
 * Pergunta antes de sair de um editor com alterações não salvas
 * (navegação no app via diálogo; fechar a aba via aviso do navegador).
 * Use `liberarSaida()` logo antes de navegar após salvar.
 */
export function useAvisoSaida(alterado: Ref<boolean>) {
  const confirmarSaida = ref(false)
  let resolverSaida: ((sair: boolean) => void) | null = null
  let liberado = false

  onBeforeRouteLeave(() => {
    if (liberado || !alterado.value) return true
    confirmarSaida.value = true
    return new Promise<boolean>((resolve) => (resolverSaida = resolve))
  })

  function responderSaida(sair: boolean) {
    confirmarSaida.value = false
    resolverSaida?.(sair)
    resolverSaida = null
  }

  // Fechar o diálogo por Esc ou toque fora conta como "continuar editando".
  watch(confirmarSaida, (aberto) => {
    if (!aberto && resolverSaida) responderSaida(false)
  })

  function avisoAoFechar(evento: BeforeUnloadEvent) {
    if (!liberado && alterado.value) evento.preventDefault()
  }
  onMounted(() => window.addEventListener('beforeunload', avisoAoFechar))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', avisoAoFechar))

  return {
    confirmarSaida,
    responderSaida,
    liberarSaida: (sim = true) => {
      liberado = sim
    },
  }
}
