/**
 * Modo pen drive: build `npm run build:pendrive` (arquivo único aberto como file://).
 * Somente leitura; a biblioteca vem do backup do pen drive.
 */
export const MODO_PENDRIVE = import.meta.env.MODE === 'pendrive'

/** Preenchido na abertura: true se o navegador não deixou salvar (dados só na memória da aba). */
export const armazenamento = { emMemoria: false }

/** Rotas de edição/gestão que não existem no modo pen drive. */
export function rotaBloqueadaNoPenDrive(caminho: string): boolean {
  return (
    /^\/(prescricoes|calculadoras|escalas)\/nova$/.test(caminho) ||
    /^\/(prescricoes|calculadoras|escalas)\/[^/]+\/editar$/.test(caminho) ||
    ['/categorias', '/lixeira', '/backup', '/importar'].includes(caminho)
  )
}
