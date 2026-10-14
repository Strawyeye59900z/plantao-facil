import type { Categoria, ISODate } from './base'
import type { Calculadora } from './calculadora'
import type { Prescricao } from './prescricao'

// ===== Módulo 3 — Backup =====
export interface ArquivoBackup {
  formato: 'plantao-facil-backup'
  versaoFormato: 1
  exportadoEm: ISODate
  versaoApp: string
  /** Inclui itens na lixeira (excluidoEm preenchido), para propagar exclusões na mesclagem. */
  prescricoes: Prescricao[]
  calculadoras: Calculadora[]
  categorias: Categoria[]
}

// ===== Módulo 5 — IA (provedores e formato da resposta em src/dominio/ia) =====
export type IdProvedor = 'gemini' | 'anthropic' | 'openai'

// ===== Dados locais do aparelho (fora do backup e da sincronização) =====
export type Tema = 'escuro' | 'claro'

export interface Configuracoes {
  id: 'local'
  tema: Tema
  ia: {
    provedor: IdProvedor
    /** Nunca entra no backup. */
    chaves: Partial<Record<IdProvedor, string>>
    modelos: Partial<Record<IdProvedor, string>>
  }
  /** Data do último backup exportado neste aparelho (para o lembrete). */
  ultimoBackupEm: ISODate | null
  /** Modo pen drive: data (exportadoEm) do backup carregado neste PC; null = nenhum. */
  bibliotecaPenDriveDe: ISODate | null
}

/** Recentes vivem só na memória enquanto o app está aberto (máx. 5). */
export interface UsoRecente {
  tipo: 'prescricao' | 'calculadora'
  refId: string
}
