import type { Component } from 'vue'
import { Info, OctagonAlert, TriangleAlert } from '@lucide/vue'
import type { Gravidade } from '@/dominio/tipos'

export const ESTILO_GRAVIDADE: Record<Gravidade, { caixa: string; icone: string; componente: Component }> = {
  critico: { caixa: 'border-critico/35 bg-critico/10', icone: 'text-critico', componente: OctagonAlert },
  atencao: { caixa: 'border-atencao/45 bg-atencao/12', icone: 'text-atencao', componente: TriangleAlert },
  informativo: { caixa: 'border-informativo/35 bg-informativo/10', icone: 'text-informativo', componente: Info },
}
