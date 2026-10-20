import { ref } from 'vue'
import { juntarTrechos } from '@/dominio/anamnese/juncao'

/**
 * Ditado pelo reconhecimento de voz do navegador, forçado a rodar NO APARELHO
 * (processLocally). Se o aparelho não tiver o pacote local, o navegador não inicia:
 * o áudio nunca é enviado para servidores.
 */

interface ResultadoReconhecido {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
  resultIndex: number
}

interface Reconhecimento {
  lang: string
  continuous: boolean
  interimResults: boolean
  processLocally: boolean
  onresult: ((evento: ResultadoReconhecido) => void) | null
  onend: (() => void) | null
  onerror: ((evento: { error: string }) => void) | null
  start(): void
  stop(): void
}

interface OpcoesDisponibilidade {
  langs: string[]
  processLocally: boolean
}

type ClasseReconhecimento = (new () => Reconhecimento) & {
  available?: (opcoes: OpcoesDisponibilidade) => Promise<string>
  install?: (opcoes: OpcoesDisponibilidade) => Promise<boolean>
}

const LINGUA = 'pt-BR'

function classe(): ClasseReconhecimento | null {
  const janela = window as unknown as {
    SpeechRecognition?: ClasseReconhecimento
    webkitSpeechRecognition?: ClasseReconhecimento
  }
  return janela.SpeechRecognition ?? janela.webkitSpeechRecognition ?? null
}

export function useDitadoLocal() {
  const disponibilidade = ref<string>('verificando')
  const texto = ref('')
  const ditando = ref(false)
  const erro = ref<string | null>(null)
  let reconhecimento: Reconhecimento | null = null

  /** Diz se o aparelho consegue reconhecer português localmente: available, downloadable, downloading ou unavailable. */
  async function verificar() {
    const Classe = classe()
    if (!Classe) {
      disponibilidade.value = 'sem-suporte'
      return
    }
    if (!Classe.available) {
      disponibilidade.value = 'desconhecido'
      return
    }
    try {
      disponibilidade.value = await Classe.available({ langs: [LINGUA], processLocally: true })
    } catch (falha) {
      erro.value = falha instanceof Error ? falha.message : String(falha)
      disponibilidade.value = 'erro'
    }
  }

  /** Baixa o pacote de português para uso local. Precisa de um toque do usuário. */
  async function instalar() {
    const Classe = classe()
    if (!Classe?.install) return false
    try {
      return await Classe.install({ langs: [LINGUA], processLocally: true })
    } catch (falha) {
      erro.value = falha instanceof Error ? falha.message : String(falha)
      return false
    }
  }

  function iniciar() {
    const Classe = classe()
    if (!Classe) {
      erro.value = 'Este navegador não tem reconhecimento de voz.'
      return
    }
    erro.value = null
    reconhecimento = new Classe()
    reconhecimento.lang = LINGUA
    reconhecimento.continuous = true
    reconhecimento.interimResults = false
    reconhecimento.processLocally = true

    reconhecimento.onresult = (evento) => {
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const resultado = evento.results[i]
        if (resultado?.isFinal) texto.value = juntarTrechos(texto.value, resultado[0].transcript)
      }
    }
    reconhecimento.onerror = (evento) => {
      // "no-speech" é silêncio, não é erro de verdade.
      if (evento.error === 'no-speech') return
      erro.value = `Erro no reconhecimento: ${evento.error}`
      ditando.value = false
    }
    // Em silêncios o navegador encerra sozinho: reinicia enquanto o usuário não parar.
    reconhecimento.onend = () => {
      if (ditando.value && reconhecimento) reconhecimento.start()
    }

    try {
      reconhecimento.start()
      ditando.value = true
    } catch (falha) {
      erro.value = falha instanceof Error ? falha.message : String(falha)
    }
  }

  function parar() {
    ditando.value = false
    reconhecimento?.stop()
    reconhecimento = null
  }

  return { disponibilidade, texto, ditando, erro, verificar, instalar, iniciar, parar }
}
