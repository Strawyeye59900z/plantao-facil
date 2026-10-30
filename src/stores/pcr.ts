import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { db } from '@/db/banco'
import {
  BPM_METRONOMO,
  contar,
  desfazerUltimo,
  encerrar,
  estadoDaParada,
  expirado,
  novoRegistro,
  registrarEvento,
  type NivelEpinefrina,
  type RegistroPcr,
  type TipoEvento,
} from '@/dominio/pcr/pcr'
import { celular } from '@/lib/anamnese/estado'
import { ativarSom, bipe, iniciarMetronomo, pararMetronomo } from '@/lib/pcr/audio'
import { enviarRegistros } from '@/lib/pcr/sincronizar'
import { liberarTela, manterTelaLigada } from '@/lib/pcr/telaLigada'

/** Intervalo entre repetições do bipe enquanto a checagem de ritmo espera resposta. */
const REPETE_BIPE_MS = 6000

/** Cópia simples: o IndexedDB não aceita o proxy reativo do Vue. */
const simples = <T>(valor: T): T => JSON.parse(JSON.stringify(valor))

export const usePcrStore = defineStore('pcr', () => {
  const registros = ref<RegistroPcr[]>([])
  const agora = ref(Date.now())
  const metronomo = ref(false)
  const somLiberado = ref(false)

  const ativa = computed(() => registros.value.find((r) => r.encerradoEm === null) ?? null)
  const estado = computed(() => (ativa.value ? estadoDaParada(ativa.value, agora.value) : null))
  const contagens = computed(() => (ativa.value ? contar(ativa.value) : null))
  /** Algo pede atenção: checagem pendente ou epinefrina para repetir/atrasada. */
  const alerta = computed(() => {
    const e = estado.value
    return e !== null && (e.checagemPendente || e.epinefrina === 'repetir' || e.epinefrina === 'atrasada')
  })

  let relogio: ReturnType<typeof setInterval> | undefined
  let nivelAnterior: NivelEpinefrina = 'sem_dose'
  let ultimoBipeRitmo = 0

  async function salvar(registro: RegistroPcr) {
    await db.pcr.put(simples(registro))
  }

  function substituir(registro: RegistroPcr) {
    registros.value = registros.value.map((r) => (r.id === registro.id ? registro : r))
    void salvar(registro)
  }

  function tique() {
    agora.value = Date.now()
    const e = estado.value
    if (!e) return
    if (e.checagemPendente && agora.value - ultimoBipeRitmo >= REPETE_BIPE_MS) {
      ultimoBipeRitmo = agora.value
      bipe('ritmo')
    }
    if (e.epinefrina !== nivelAnterior) {
      if (e.epinefrina === 'repetir') bipe('epinefrina')
      else if (e.epinefrina === 'atrasada') bipe('atraso')
      nivelAnterior = e.epinefrina
    }
  }

  function comecarRelogio() {
    if (relogio !== undefined) return
    relogio = setInterval(tique, 250)
    manterTelaLigada()
  }

  function pararRelogio() {
    clearInterval(relogio)
    relogio = undefined
    pararMetronomo()
    metronomo.value = false
    liberarTela()
  }

  /** Abre o app: apaga o que passou de 2 dias e retoma uma parada que estava em andamento. */
  async function carregar() {
    const todos = await db.pcr.toArray()
    const vencidos = todos.filter((r) => expirado(r, Date.now()))
    if (vencidos.length) await db.pcr.bulkDelete(vencidos.map((r) => r.id))
    registros.value = todos.filter((r) => !vencidos.includes(r)).sort((a, b) => b.iniciadoEm - a.iniciadoEm)
    if (ativa.value) {
      nivelAnterior = estadoDaParada(ativa.value, Date.now()).epinefrina
      comecarRelogio()
    }
  }

  /** Começa a parada (chamar de um toque: libera o som) com o metrônomo ligado. */
  async function iniciar() {
    if (ativa.value) return
    somLiberado.value = await ativarSom()
    const registro = novoRegistro(crypto.randomUUID(), Date.now())
    registros.value = [registro, ...registros.value]
    await salvar(registro)
    nivelAnterior = 'sem_dose'
    ultimoBipeRitmo = 0
    agora.value = Date.now()
    comecarRelogio()
    if (somLiberado.value) {
      iniciarMetronomo(BPM_METRONOMO)
      metronomo.value = true
    }
  }

  function marcar(tipo: Exclude<TipoEvento, 'checagem'>, texto?: string) {
    if (!ativa.value) return
    const evento = { id: crypto.randomUUID(), tipo, em: Date.now(), ...(texto ? { texto: texto.trim() } : {}) }
    substituir(registrarEvento(ativa.value, evento))
    if (tipo === 'epinefrina') nivelAnterior = 'aguardar'
  }

  /** Resposta da checagem de ritmo: houve choque (ritmo chocável) ou não. Reinicia o ciclo de 2 min. */
  function responderChecagem(chocavel: boolean) {
    if (!ativa.value) return
    substituir(registrarEvento(ativa.value, { id: crypto.randomUUID(), tipo: 'checagem', em: Date.now(), chocavel }))
    ultimoBipeRitmo = 0
  }

  function desfazer() {
    if (!ativa.value) return
    const refeito = desfazerUltimo(ativa.value)
    substituir(refeito)
    nivelAnterior = estadoDaParada(refeito, Date.now()).epinefrina
  }

  function encerrarParada() {
    if (!ativa.value) return
    substituir(encerrar(ativa.value, Date.now()))
    pararRelogio()
  }

  async function alternarMetronomo() {
    if (metronomo.value) {
      pararMetronomo()
      metronomo.value = false
      return
    }
    somLiberado.value = await ativarSom()
    if (!somLiberado.value) return
    iniciarMetronomo(BPM_METRONOMO)
    metronomo.value = true
  }

  /** Depois de recarregar a página o navegador bloqueia o som até um toque. */
  async function liberarSom() {
    somLiberado.value = await ativarSom()
    if (somLiberado.value && ativa.value && metronomo.value === false && relogio !== undefined) {
      iniciarMetronomo(BPM_METRONOMO)
      metronomo.value = true
    }
  }

  async function excluirRegistro(id: string) {
    if (ativa.value?.id === id) pararRelogio()
    registros.value = registros.value.filter((r) => r.id !== id)
    await db.pcr.delete(id)
  }

  async function excluirTudo() {
    pararRelogio()
    registros.value = []
    await db.pcr.clear()
  }

  // Celular conectado: cada alteração vai para o PC (junto de uma pequena espera, para juntar toques seguidos).
  let esperaEnvio: ReturnType<typeof setTimeout> | undefined
  function enviarAoPc() {
    clearTimeout(esperaEnvio)
    esperaEnvio = setTimeout(() => {
      const sessao = celular.sessao.value
      if (sessao) void enviarRegistros(sessao, simples(registros.value)).catch(() => undefined)
    }, 400)
  }
  watch(registros, enviarAoPc, { deep: true })
  watch(() => celular.sessao.value, (sessao) => sessao && enviarAoPc())

  return {
    registros,
    ativa,
    estado,
    contagens,
    alerta,
    metronomo,
    somLiberado,
    carregar,
    iniciar,
    marcar,
    responderChecagem,
    desfazer,
    encerrarParada,
    alternarMetronomo,
    liberarSom,
    excluirRegistro,
    excluirTudo,
  }
})
