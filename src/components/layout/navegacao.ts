import type { Component } from 'vue'
import { Calculator, ClipboardList, ListChecks, DatabaseBackup, FileUp, Mic, NotebookPen, Settings, Tags, Trash2 } from '@lucide/vue'

export interface ItemNavegacao {
  rota: string
  rotulo: string
  icone: Component
}

/** Áreas do app, mostradas como pílulas no topo. */
export const AREAS: ItemNavegacao[] = [
  { rota: '/prescricoes', rotulo: 'Prescrições', icone: ClipboardList },
  { rota: '/calculadoras', rotulo: 'Calculadoras', icone: Calculator },
  { rota: '/escalas', rotulo: 'Escalas', icone: ListChecks },
  { rota: '/anamnese/bloco', rotulo: 'Bloco de notas', icone: NotebookPen },
  { rota: '/anamnese/transcricao', rotulo: 'Transcrição', icone: Mic },
]

/** Itens do menu redondo do topo (no pen drive some o que a rota bloqueia). */
export const MENU: ItemNavegacao[] = [
  { rota: '/categorias', rotulo: 'Grupos', icone: Tags },
  { rota: '/importar', rotulo: 'Importar PDF', icone: FileUp },
  { rota: '/backup', rotulo: 'Backup', icone: DatabaseBackup },
  { rota: '/lixeira', rotulo: 'Lixeira', icone: Trash2 },
  { rota: '/ajustes', rotulo: 'Ajustes', icone: Settings },
]
