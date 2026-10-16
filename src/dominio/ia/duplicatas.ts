import { normalizarTexto } from '@/dominio/texto/normalizar'

export interface TituloImportado {
  chave: string
  titulo: string
  /** De onde veio, para a mensagem (ex.: "lote 2, páginas 10–20"). */
  origem: string
}

/**
 * Possíveis duplicatas na revisão da importação: mesmo título (sem maiúsculas/acentos) entre as
 * prescrições importadas ou com uma já salva na biblioteca. Só marca; quem decide é o usuário.
 * Retorna, por chave do rascunho, as descrições das outras com o mesmo título.
 */
export function encontrarDuplicatas(importadas: TituloImportado[], tituloSalvas: string[]): Record<string, string[]> {
  const salvas = new Map<string, string>()
  for (const t of tituloSalvas) {
    const n = normalizarTexto(t)
    if (n && !salvas.has(n)) salvas.set(n, t)
  }

  const resultado: Record<string, string[]> = {}
  for (const r of importadas) {
    const n = normalizarTexto(r.titulo)
    if (!n) continue
    const avisos = importadas
      .filter((o) => o.chave !== r.chave && normalizarTexto(o.titulo) === n)
      .map((o) => `“${o.titulo.trim()}” (${o.origem})`)
    const salva = salvas.get(n)
    if (salva !== undefined) avisos.push(`“${salva.trim()}” (já salva na biblioteca)`)
    if (avisos.length) resultado[r.chave] = avisos
  }
  return resultado
}
