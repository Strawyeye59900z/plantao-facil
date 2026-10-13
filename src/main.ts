import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { pedirArmazenamentoPersistente } from './db/armazenamento'
import { useConfiguracoesStore } from './stores/configuracoes'

async function iniciar() {
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)

  await useConfiguracoesStore().carregar()
  app.mount('#app')

  // Não bloqueia a abertura do app; o status aparece em Ajustes.
  void pedirArmazenamentoPersistente()
}

void iniciar()
