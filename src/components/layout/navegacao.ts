import type { Component } from 'vue'
import { Calculator, ClipboardList, DatabaseBackup, FileUp, Settings, Tags, Trash2 } from '@lucide/vue'

export interface ItemNavegacao {
  rota: string
  rotulo: string
  icone: Component
}

/** Itens da navegação inferior (celular) e do topo do menu lateral (PC). */
export const NAVEGACAO_PRINCIPAL: ItemNavegacao[] = [
  { rota: '/prescricoes', rotulo: 'Prescrições', icone: ClipboardList },
  { rota: '/calculadoras', rotulo: 'Calculadoras', icone: Calculator },
  { rota: '/ajustes', rotulo: 'Ajustes', icone: Settings },
]

/** No celular ficam dentro de Ajustes; no PC aparecem também no menu lateral. */
export const NAVEGACAO_SECUNDARIA: ItemNavegacao[] = [
  { rota: '/categorias', rotulo: 'Categorias', icone: Tags },
  { rota: '/backup', rotulo: 'Backup', icone: DatabaseBackup },
  { rota: '/importar', rotulo: 'Importar PDF', icone: FileUp },
  { rota: '/lixeira', rotulo: 'Lixeira', icone: Trash2 },
]
