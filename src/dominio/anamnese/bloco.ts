/**
 * Bloco de notas beira leito: uma entrada por leito, com lista de problemas (cada um com suspeitas
 * diagnósticas) e anotações com hora. Consultas transcritas também entram aqui para seguir ao PC.
 * Tudo fica só na memória das telas: nada é salvo em disco.
 */

export interface Suspeita {
  id: string
  texto: string
}

export interface Problema {
  id: string
  titulo: string
  suspeitas: Suspeita[]
}

export interface Anotacao {
  id: string
  hora: string
  texto: string
}

export interface Leito {
  id: string
  /** Identificação do leito (ex.: "Leito 12"). Nunca o nome do paciente. */
  identificacao: string
  problemas: Problema[]
  anotacoes: Anotacao[]
}

export interface Consulta {
  id: string
  hora: string
  texto: string
}

export interface Bloco {
  versao: 1
  leitos: Leito[]
  consultas: Consulta[]
}

export type GerarId = () => string

export const blocoVazio = (): Bloco => ({ versao: 1, leitos: [], consultas: [] })

export function adicionarLeito(bloco: Bloco, identificacao: string, gerarId: GerarId): Bloco {
  const nome = identificacao.trim()
  if (!nome) return bloco
  return { ...bloco, leitos: [...bloco.leitos, { id: gerarId(), identificacao: nome, problemas: [], anotacoes: [] }] }
}

/** Substitui um leito pelo resultado de `mudar`, sem alterar os outros. */
export function atualizarLeito(bloco: Bloco, leitoId: string, mudar: (l: Leito) => Leito): Bloco {
  return { ...bloco, leitos: bloco.leitos.map((l) => (l.id === leitoId ? mudar(l) : l)) }
}

export function adicionarProblema(bloco: Bloco, leitoId: string, titulo: string, gerarId: GerarId): Bloco {
  const t = titulo.trim()
  if (!t) return bloco
  return atualizarLeito(bloco, leitoId, (l) => ({ ...l, problemas: [...l.problemas, { id: gerarId(), titulo: t, suspeitas: [] }] }))
}

export function adicionarSuspeita(bloco: Bloco, leitoId: string, problemaId: string, texto: string, gerarId: GerarId): Bloco {
  const t = texto.trim()
  if (!t) return bloco
  return atualizarLeito(bloco, leitoId, (l) => ({
    ...l,
    problemas: l.problemas.map((p) =>
      p.id === problemaId ? { ...p, suspeitas: [...p.suspeitas, { id: gerarId(), texto: t }] } : p,
    ),
  }))
}

export function removerProblema(bloco: Bloco, leitoId: string, problemaId: string): Bloco {
  return atualizarLeito(bloco, leitoId, (l) => ({ ...l, problemas: l.problemas.filter((p) => p.id !== problemaId) }))
}

export function adicionarAnotacao(bloco: Bloco, leitoId: string, texto: string, hora: string, gerarId: GerarId): Bloco {
  const t = texto.trim()
  if (!t) return bloco
  return atualizarLeito(bloco, leitoId, (l) => ({ ...l, anotacoes: [...l.anotacoes, { id: gerarId(), hora, texto: t }] }))
}

/** Lê um bloco vindo do celular/PC, validando a forma. Devolve null se não for um bloco válido. */
export function lerBloco(bruto: unknown): Bloco | null {
  const b = bruto as Partial<Bloco> | null
  if (!b || b.versao !== 1 || !Array.isArray(b.leitos) || !Array.isArray(b.consultas)) return null
  const texto = (v: unknown) => typeof v === 'string'
  for (const l of b.leitos) {
    if (!l || !texto(l.id) || !texto(l.identificacao) || !Array.isArray(l.problemas) || !Array.isArray(l.anotacoes)) return null
    for (const p of l.problemas) {
      if (!p || !texto(p.id) || !texto(p.titulo) || !Array.isArray(p.suspeitas)) return null
      if (!p.suspeitas.every((s) => s && texto(s.id) && texto(s.texto))) return null
    }
    if (!l.anotacoes.every((a) => a && texto(a.id) && texto(a.hora) && texto(a.texto))) return null
  }
  if (!b.consultas.every((c) => c && texto(c.id) && texto(c.hora) && texto(c.texto))) return null
  return b as Bloco
}
