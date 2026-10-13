import type { Component } from 'vue'
import { Info, OctagonAlert, TriangleAlert } from '@lucide/vue'
import type { Gravidade } from '@/dominio/tipos'

export const ESTILO_GRAVIDADE: Record<Gravidade, { caixa: string; icone: string; componente: Component }> = {
  critico: { caixa: 'border-critico bg-critico/12', icone: 'text-critico', componente: OctagonAlert },
  atencao: { caixa: 'border-atencao bg-atencao/12', icone: 'text-atencao', componente: TriangleAlert },
  informativo: { caixa: 'border-informativo bg-informativo/10', icone: 'text-informativo', componente: Info },
}
