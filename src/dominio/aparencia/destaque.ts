import { MODO_PENDRIVE } from '@/modo'

export type CorDestaque = 'azul' | 'coral' | 'verde' | 'violeta'

export const CORES_DESTAQUE: Record<CorDestaque, { rotulo: string; hex: string }> = {
  azul: { rotulo: 'Azul', hex: '#2f5bea' },
  coral: { rotulo: 'Coral', hex: '#ef5b5b' },
  verde: { rotulo: 'Verde-água', hex: '#0f9d8a' },
  violeta: { rotulo: 'Violeta', hex: '#6d4fe0' },
}

export const COR_DESTAQUE_PADRAO: CorDestaque = 'verde'

/** Cópia da cor no localStorage só para aplicar antes do primeiro desenho (sem piscar). */
export const CHAVE_DESTAQUE_CACHE = 'plantao-facil:destaque'

/** Define a cor de destaque no <html> (o CSS troca `--primary` por `[data-destaque]`). */
export function aplicarDestaque(cor: CorDestaque): void {
  document.documentElement.dataset.destaque = cor
  if (MODO_PENDRIVE) return
  try {
    localStorage.setItem(CHAVE_DESTAQUE_CACHE, cor)
  } catch {
    // localStorage indisponível: a cor continua salva no banco.
  }
}
