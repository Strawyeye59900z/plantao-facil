/// <reference types="vitest/config" />
import { readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

const pacote = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

// No GitHub Pages o app fica em /<repositorio>/; o workflow de deploy define BASE_PATH.
const base = process.env.BASE_PATH ?? '/'

const pwa = VitePWA({
  registerType: 'prompt',
  includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
  manifest: {
    name: 'Plantão Fácil',
    short_name: 'Plantão Fácil',
    description: 'Apoio pessoal ao plantão médico: prescrições e calculadoras offline.',
    lang: 'pt-BR',
    display: 'standalone',
    start_url: '.',
    scope: '.',
    theme_color: '#eef1f6',
    background_color: '#eef1f6',
    icons: [
      { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    // Pré-carrega tudo do build: o app abre offline após o primeiro acesso.
    globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff2}'],
  },
})

/**
 * Modo pen drive (`vite build --mode pendrive`): um único plantao-facil.html aberto como arquivo.
 * Sem PWA (service worker não funciona em file://); o registro do SW vira um stub.
 */
function modoPenDrive(): Plugin {
  const STUB = '\0stub-pwa-register'
  const favicon = readFileSync(new URL('./public/favicon.svg', import.meta.url), 'utf8')
  return {
    name: 'plantao-facil-pendrive',
    resolveId(id) {
      if (id === 'virtual:pwa-register/vue') return STUB
    },
    load(id) {
      if (id === STUB) {
        return "import { ref } from 'vue'\nexport function useRegisterSW() { return { offlineReady: ref(false), needRefresh: ref(false), updateServiceWorker: async () => {} } }"
      }
    },
    transformIndexHtml(html) {
      // Ícones da pasta public não vão no arquivo único: favicon embutido, demais removidos.
      return html
        .replace(/<link rel="icon" href="\/favicon\.ico"[^>]*>\s*/, '')
        .replace(/<link rel="apple-touch-icon"[^>]*>\s*/, '')
        .replace(
          /<link rel="icon" href="\/favicon\.svg"[^>]*>/,
          `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(favicon)}" />`,
        )
    },
    writeBundle(opcoes) {
      const pasta = opcoes.dir ?? 'dist-pendrive'
      renameSync(join(pasta, 'index.html'), join(pasta, 'plantao-facil.html'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const penDrive = mode === 'pendrive'
  return {
    base: penDrive ? './' : base,
    publicDir: penDrive ? false : 'public',
    define: {
      __APP_VERSION__: JSON.stringify(pacote.version),
    },
    plugins: [vue(), tailwindcss(), ...(penDrive ? [modoPenDrive(), viteSingleFile()] : [pwa])],
    build: penDrive ? { outDir: 'dist-pendrive', emptyOutDir: true } : undefined,
    // Isolamento de origem (dev): permite o WASM usar várias threads na transcrição.
    // "credentialless" deixa o download do modelo funcionar sem exigir cabeçalhos do servidor de origem.
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.spec.ts'],
    },
  }
})
