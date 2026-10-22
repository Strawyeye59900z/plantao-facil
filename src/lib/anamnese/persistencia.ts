/**
 * Guarda só a conexão (id da sessão, código e salt) para sobreviver a recarregar a página.
 * Nenhum dado de paciente é guardado aqui: o bloco volta do servidor, cifrado, e é decifrado com o código.
 * No PC usa sessionStorage (some ao fechar a aba, importante em PC compartilhado); no celular usa
 * localStorage, para sobreviver ao navegador descarregar a aba.
 */
export type Papel = 'pc' | 'celular'

export interface ConexaoGuardada {
  id: string
  codigo: string
  salt: string
}

export const ehCelular = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
export const papelAtual: Papel = ehCelular ? 'celular' : 'pc'

const chave = (papel: Papel) => `plantao.sincronizacao.${papel}.v1`

function armazem(papel: Papel): Storage | null {
  try {
    return papel === 'celular' ? localStorage : sessionStorage
  } catch {
    return null
  }
}

export function guardarConexao(papel: Papel, conexao: ConexaoGuardada): void {
  try {
    armazem(papel)?.setItem(chave(papel), JSON.stringify(conexao))
  } catch {
    // Sem armazenamento: a sessão só não sobrevive ao refresh.
  }
}

export function lerConexaoGuardada(papel: Papel): ConexaoGuardada | null {
  try {
    const bruto = armazem(papel)?.getItem(chave(papel))
    if (!bruto) return null
    const c = JSON.parse(bruto) as Partial<ConexaoGuardada>
    const texto = (v: unknown): v is string => typeof v === 'string' && v.length > 0
    return texto(c.id) && texto(c.codigo) && texto(c.salt) ? { id: c.id, codigo: c.codigo, salt: c.salt } : null
  } catch {
    return null
  }
}

export function esquecerConexao(papel: Papel): void {
  try {
    armazem(papel)?.removeItem(chave(papel))
  } catch {
    // nada a fazer
  }
}
