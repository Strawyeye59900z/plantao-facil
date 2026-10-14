import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/db/banco'
import type { Configuracoes, Tema } from '@/dominio/tipos'

/** Cópia do tema no localStorage só para aplicar antes do primeiro desenho (sem piscar). */
export const CHAVE_TEMA_CACHE = 'plantao-facil:tema'

function padrao(): Configuracoes {
  return {
    id: 'local',
    tema: 'escuro',
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
    aplicarTema(config.value.tema)
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

  async function registrarBackup(quando: string) {
    config.value.ultimoBackupEm = quando
    await salvar()
  }

  async function registrarBibliotecaPenDrive(de: string | null) {
    config.value.bibliotecaPenDriveDe = de
    await salvar()
  }

  return { config, carregar, definirTema, registrarBackup, registrarBibliotecaPenDrive }
})
