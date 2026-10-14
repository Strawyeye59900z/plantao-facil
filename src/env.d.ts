/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vue" />

/** Versão do package.json, injetada pelo Vite. */
declare const __APP_VERSION__: string

/** Polyfill de IndexedDB em memória (usado no modo pen drive sem armazenamento). */
declare module 'fake-indexeddb/auto'
