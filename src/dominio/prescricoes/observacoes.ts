export interface ParagrafoObservacao {
  /** Rótulo da linha de abertura ("Obs", "#Bizu"…), sem os dois-pontos; null = parágrafo sem rótulo. */
  rotulo: string | null
  texto: string
}

const ROTULO = /^\s*(#?\s?[\p{L}][\p{L} ]{0,24}):\s*/u

/**
 * Divide as observações em parágrafos. Um parágrafo novo começa numa linha em branco
 * ou numa linha que abre com rótulo ("Obs:", "# Cuidados:"). As linhas do parágrafo
 * ficam unidas por "\n".
 */
export function paragrafosObservacoes(texto: string): ParagrafoObservacao[] {
  const paragrafos: { rotulo: string | null; linhas: string[] }[] = []
  let atual: { rotulo: string | null; linhas: string[] } | null = null

  for (const bruta of texto.split(/\r\n|\r|\n/)) {
    const linha = bruta.trimEnd()
    if (linha.trim() === '') {
      atual = null
      continue
    }
    const achou = ROTULO.exec(linha)
    if (achou) {
      atual = { rotulo: achou[1]!.trim(), linhas: [] }
      paragrafos.push(atual)
      const resto = linha.slice(achou[0].length)
      if (resto !== '') atual.linhas.push(resto)
    } else {
      if (!atual) {
        atual = { rotulo: null, linhas: [] }
        paragrafos.push(atual)
      }
      atual.linhas.push(linha.trim())
    }
  }

  return paragrafos.map((p) => ({ rotulo: p.rotulo, texto: p.linhas.join('\n') }))
}
