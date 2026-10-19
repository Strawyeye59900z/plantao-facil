import type { Gravidade } from '@/dominio/tipos'

/**
 * Fundo + texto + borda suave de avisos na tela da prescrição:
 * vermelho para crítico, âmbar para atenção, neutro para informativo.
 */
export const TINTA_GRAVIDADE: Record<Gravidade, string> = {
  critico: 'bg-critico-suave text-critico-suave-foreground border-critico/20',
  atencao: 'bg-atencao-suave text-atencao-suave-foreground border-atencao/30',
  informativo: 'bg-secondary text-foreground border-border',
}
