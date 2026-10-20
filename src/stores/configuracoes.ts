import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/db/banco'
import type { Configuracoes, IdProvedor, Tema } from '@/dominio/tipos'
import { aplicarDestaque, COR_DESTAQUE_PADRAO, type CorDestaque } from '@/dominio/aparencia/destaque'
import { PROVEDORES } from '@/dominio/ia/provedores'

/** Cópia do tema no localStorage só para aplicar antes do primeiro desenho (sem piscar). */
export const CHAVE_TEMA_CACHE = 'plantao-facil:tema'

function padrao(): Configuracoes {
  return {
    id: 'local',
    tema: 'claro',
    corDestaque: COR_DESTAQUE_PADRAO,
    ia: { provedor: 'gemini', chaves: {}, modelos: {} },
    ultimoBackupEm: null,
    bibliotecaPenDriveDe: null,
  }
}

export function aplicarTema(tema: Tema) {
  document.documentElement.classList.toggle('dark', tema === 'escuro')
  const cor = getComputedStyle(document.body).backgroundColor
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cor)
  try {
    localStorage.setItem(CHAVE_TEMA_CACHE, tema)
  } catch {
    // localStorage indisponível: o tema continua salvo no banco.
  }
}

export const useConfiguracoesStore = defineStore('configuracoes', () => {
  const config = ref<Configuracoes>(padrao())

  async function carregar() {
    const salvo = await db.configuracoes.get('local')
    config.value = { ...padrao(), ...salvo }
    // Configurações salvas antes de algum campo existir.
    config.value.ia = { ...padrao().ia, ...config.value.ia }
    aplicarTema(config.value.tema)
    aplicarDestaque(config.value.corDestaque)
  }

  async function salvar() {
    // Cópia simples: o IndexedDB não aceita o proxy reativo do Vue.
    await db.configuracoes.put(JSON.parse(JSON.stringify(config.value)))
  }

  async function definirTema(tema: Tema) {
    config.value.tema = tema
    aplicarTema(tema)
    await salvar()
  }

  async function definirCorDestaque(cor: CorDestaque) {
    config.value.corDestaque = cor
    aplicarDestaque(cor)
    await salvar()
  }

  async function registrarBackup(quando: string) {
    config.value.ultimoBackupEm = quando
    await salvar()
  }

  async function registrarBibliotecaPenDrive(de: string | null) {
    config.value.bibliotecaPenDriveDe = de
    await salvar()
  }

  // ===== IA (chaves só neste aparelho; configurações não entram no backup) =====
  async function definirProvedor(provedor: IdProvedor) {
    config.value.ia.provedor = provedor
    await salvar()
  }

  async function definirChave(provedor: IdProvedor, chave: string) {
    const limpa = chave.trim()
    if (limpa) config.value.ia.chaves[provedor] = limpa
    else delete config.value.ia.chaves[provedor]
    await salvar()
  }

  async function definirModelo(provedor: IdProvedor, modelo: string) {
    config.value.ia.modelos[provedor] = modelo.trim()
    await salvar()
  }

  /** Modelo escolhido (ou o padrão do provedor). */
  function modeloDe(provedor: IdProvedor): string {
    return config.value.ia.modelos[provedor] || PROVEDORES[provedor].modeloPadrao
  }

  return {
    config,
    carregar,
    definirTema,
    definirCorDestaque,
    registrarBackup,
    registrarBibliotecaPenDrive,
    definirProvedor,
    definirChave,
    definirModelo,
    modeloDe,
  }
})
