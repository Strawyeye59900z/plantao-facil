import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'vue-sonner/style.css'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { pedirArmazenamentoPersistente } from './db/armazenamento'
import { useCategoriasStore } from './stores/categorias'
import { useConfiguracoesStore } from './stores/configuracoes'
import { usePrescricoesStore } from './stores/prescricoes'

async function iniciar() {
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)

  // A biblioteca é pequena: carrega tudo na abertura para a busca ser instantânea.
  await Promise.all([
    useConfiguracoesStore().carregar(),
    useCategoriasStore().carregar(),
    usePrescricoesStore().carregar(),
  ])
  app.mount('#app')

  // Não bloqueia a abertura do app; o status aparece em Ajustes.
  void pedirArmazenamentoPersistente()
}

void iniciar()
