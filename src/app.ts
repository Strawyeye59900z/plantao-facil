import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'vue-sonner/style.css'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { pedirArmazenamentoPersistente } from './db/armazenamento'
import { MODO_PENDRIVE } from './modo'
import { useCategoriasStore } from './stores/categorias'
import { useConfiguracoesStore } from './stores/configuracoes'
import { usePrescricoesStore } from './stores/prescricoes'

export async function montarApp() {
  const app = createApp(App)
  app.use(createPinia())

  // A biblioteca é pequena: carrega tudo na abertura para a busca ser instantânea.
  // Antes do router: a navegação inicial começa no app.use(router), e as guardas
  // (modo pen drive) precisam das configurações já carregadas.
  await Promise.all([
    useConfiguracoesStore().carregar(),
    useCategoriasStore().carregar(),
    usePrescricoesStore().carregar(),
  ])
  app.use(router)
  app.mount('#app')

  // Não bloqueia a abertura do app; o status aparece em Ajustes. Irrelevante no pen drive.
  if (!MODO_PENDRIVE) void pedirArmazenamentoPersistente()
}
