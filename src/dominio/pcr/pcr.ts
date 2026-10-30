/**
 * Registro de uma parada cardiorrespiratória (PCR): só tempos e marcações, sem nenhum identificador de
 * paciente. Referência dos tempos: AHA 2025, Part 9 (Adult Advanced Life Support), algoritmo de parada em
 * adultos. O app não decide conduta: os alertas lembram o ciclo de 2 min e o intervalo da epinefrina.
 */
export type TipoEvento = 'checagem' | 'epinefrina' | 'amiodarona' | 'lidocaina' | 'via_aerea' | 'outro'

export interface EventoPcr {
  id: string
  tipo: TipoEvento
  /** Instante do toque (ms desde 1970). */
  em: number
  /** 'outro': o que o médico digitou. */
  texto?: string
  /** 'checagem': o ritmo era chocável (houve choque). */
  chocavel?: boolean
}

export interface RegistroPcr {
  id: string
  iniciadoEm: number
  encerradoEm: number | null
  eventos: EventoPcr[]
}

/** Ciclo de RCP até a checagem de ritmo. */
export const CICLO_MS = 2 * 60 * 1000
/** A tela pisca nos últimos 15 s antes da checagem de ritmo. */
export const AVISO_ANTES_MS = 15 * 1000
/** Epinefrina: a repetição é razoável a cada 3–5 min (contados da dose anterior). */
export const EPI_REPETIR_MS = 3 * 60 * 1000
export const EPI_ATRASO_MS = 5 * 60 * 1000
/** Metrônomo das compressões (a diretriz pede 100–120/min). */
export const BPM_METRONOMO = 110
/** Registros salvos no aparelho por 2 dias. */
export const VALIDADE_MS = 2 * 24 * 60 * 60 * 1000

/** Doses de referência exibidas nos botões (AHA 2025, algoritmo de PCR em adultos). Conferir na diretriz. */
export const DOSES = {
  epinefrina: ['1 mg'],
  amiodarona: ['300 mg', '150 mg'],
  lidocaina: ['1–1,5 mg/kg', '0,5–0,75 mg/kg'],
} as const

export type Medicacao = keyof typeof DOSES

/** Dose de referência da próxima aplicação (n = quantas já foram dadas); null se a diretriz não prevê. */
export function doseDaProxima(med: Medicacao, jaDadas: number): string | null {
  const lista: readonly string[] = DOSES[med]
  return med === 'epinefrina' ? lista[0]! : (lista[jaDadas] ?? null)
}

export function novoRegistro(id: string, agora: number): RegistroPcr {
  return { id, iniciadoEm: agora, encerradoEm: null, eventos: [] }
}

export function registrarEvento(registro: RegistroPcr, evento: EventoPcr): RegistroPcr {
  return { ...registro, eventos: [...registro.eventos, evento] }
}

/** Desfaz o último toque (engano). */
export function desfazerUltimo(registro: RegistroPcr): RegistroPcr {
  return { ...registro, eventos: registro.eventos.slice(0, -1) }
}

export function encerrar(registro: RegistroPcr, agora: number): RegistroPcr {
  return { ...registro, encerradoEm: agora }
}

export interface Contagens {
  checagens: number
  choques: number
  epinefrina: number
  amiodarona: number
  lidocaina: number
  viaAerea: number
  outros: number
}

export function contar(registro: RegistroPcr): Contagens {
  const c: Contagens = { checagens: 0, choques: 0, epinefrina: 0, amiodarona: 0, lidocaina: 0, viaAerea: 0, outros: 0 }
  for (const e of registro.eventos) {
    if (e.tipo === 'checagem') {
      c.checagens++
      if (e.chocavel) c.choques++
    } else if (e.tipo === 'via_aerea') c.viaAerea++
    else if (e.tipo === 'outro') c.outros++
    else c[e.tipo]++
  }
  return c
}

export type NivelEpinefrina = 'sem_dose' | 'aguardar' | 'repetir' | 'atrasada'

export interface EstadoParada {
  totalMs: number
  /** Tempo que falta para a checagem de ritmo; 0 quando já venceu. */
  cicloRestanteMs: number
  /** Venceu o ciclo e ainda não foi respondido "houve choque?". */
  checagemPendente: boolean
  desdeEpinefrinaMs: number | null
  epinefrina: NivelEpinefrina
}

/** Tudo o que a tela mostra, calculado a partir do registro e do relógio. */
export function estadoDaParada(registro: RegistroPcr, agora: number): EstadoParada {
  const fim = registro.encerradoEm ?? agora
  const checagens = registro.eventos.filter((e) => e.tipo === 'checagem')
  const inicioCiclo = checagens.at(-1)?.em ?? registro.iniciadoEm
  const cicloRestanteMs = Math.max(0, CICLO_MS - (fim - inicioCiclo))
  const ultimaEpi = registro.eventos.filter((e) => e.tipo === 'epinefrina').at(-1)
  const desdeEpinefrinaMs = ultimaEpi ? Math.max(0, fim - ultimaEpi.em) : null
  const epinefrina: NivelEpinefrina =
    desdeEpinefrinaMs === null
      ? 'sem_dose'
      : desdeEpinefrinaMs >= EPI_ATRASO_MS
        ? 'atrasada'
        : desdeEpinefrinaMs >= EPI_REPETIR_MS
          ? 'repetir'
          : 'aguardar'
  return {
    totalMs: Math.max(0, fim - registro.iniciadoEm),
    cicloRestanteMs,
    checagemPendente: registro.encerradoEm === null && cicloRestanteMs === 0,
    desdeEpinefrinaMs,
    epinefrina,
  }
}

export function formatarTempo(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000)
  const min = Math.floor(total / 60)
  return `${String(min).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const hora = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const NOMES = {
  epinefrina: 'Epinefrina',
  amiodarona: 'Amiodarona',
  lidocaina: 'Lidocaína',
  via_aerea: 'Via aérea avançada',
} as const

/** Texto de uma linha da linha do tempo. */
export function descreverEvento(registro: RegistroPcr, evento: EventoPcr): string {
  if (evento.tipo === 'outro') return evento.texto?.trim() || 'Outro'
  if (evento.tipo === 'checagem') {
    return evento.chocavel ? 'Checagem de ritmo: chocável, choque dado' : 'Checagem de ritmo: não chocável, sem choque'
  }
  if (evento.tipo === 'via_aerea') return NOMES.via_aerea
  const n = registro.eventos.filter((e) => e.tipo === evento.tipo).indexOf(evento) + 1
  return `${NOMES[evento.tipo]} (${n}ª dose)`
}

/** Resumo para copiar ao prontuário: horário, tempo desde o início e o que foi feito. */
export function montarResumo(registro: RegistroPcr): string {
  const c = contar(registro)
  const estado = estadoDaParada(registro, registro.encerradoEm ?? Date.now())
  const linhas = [
    `PCR iniciada às ${hora(registro.iniciadoEm)}, duração ${formatarTempo(estado.totalMs)}${registro.encerradoEm ? '' : ' (em andamento)'}.`,
    `Choques: ${c.choques} · Epinefrina: ${c.epinefrina} · Amiodarona: ${c.amiodarona} · Lidocaína: ${c.lidocaina} · Via aérea avançada: ${c.viaAerea}`,
    '',
  ]
  for (const e of registro.eventos) {
    linhas.push(`${hora(e.em)} (${formatarTempo(e.em - registro.iniciadoEm)}) ${descreverEvento(registro, e)}`)
  }
  return linhas.join('\n')
}

export function expirado(registro: RegistroPcr, agora: number): boolean {
  return agora - registro.iniciadoEm > VALIDADE_MS
}

const TIPOS: TipoEvento[] = ['checagem', 'epinefrina', 'amiodarona', 'lidocaina', 'via_aerea', 'outro']
const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Lê registros vindos do outro aparelho (já decifrados); descarta o que não tiver o formato certo. */
export function lerRegistros(dados: unknown): RegistroPcr[] {
  if (!Array.isArray(dados)) return []
  const lidos: RegistroPcr[] = []
  for (const r of dados as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !numero(r.iniciadoEm) || !Array.isArray(r.eventos)) continue
    if (r.encerradoEm !== null && !numero(r.encerradoEm)) continue
    const eventos: EventoPcr[] = []
    for (const e of r.eventos as Record<string, unknown>[]) {
      if (!e || typeof e.id !== 'string' || !numero(e.em) || !TIPOS.includes(e.tipo as TipoEvento)) continue
      eventos.push({
        id: e.id,
        tipo: e.tipo as TipoEvento,
        em: e.em,
        ...(typeof e.texto === 'string' ? { texto: e.texto.slice(0, 200) } : {}),
        ...(typeof e.chocavel === 'boolean' ? { chocavel: e.chocavel } : {}),
      })
    }
    lidos.push({ id: r.id, iniciadoEm: r.iniciadoEm, encerradoEm: r.encerradoEm as number | null, eventos })
  }
  return lidos
}
