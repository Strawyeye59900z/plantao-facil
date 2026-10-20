import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'vue-sonner/style.css'
import './style.css'
import App from './App.vue'
import FalhaAbertura from './components/layout/FalhaAbertura.vue'
import { carregarAoAbrir } from './abertura'
import { router } from './router'
import { pedirArmazenamentoPersistente } from './db/armazenamento'
import { MODO_PENDRIVE } from './modo'
import { useCalculadorasStore } from './stores/calculadoras'
import { useCategoriasStore } from './stores/categorias'
import { useConfiguracoesStore } from './stores/configuracoes'
import { usePrescricoesStore } from './stores/prescricoes'

export async function montarApp() {
  const app = createApp(App)
  app.use(createPinia())

  // A biblioteca é pequena: carrega tudo na abertura para a busca ser instantânea.
  // Antes do router: a navegação inicial começa no app.use(router), e as guardas
  // (modo pen drive) precisam das configurações já carregadas.
  const abertura = await carregarAoAbrir([
    () => useConfiguracoesStore().carregar(),
    () => useCategoriasStore().carregar(),
    () => usePrescricoesStore().carregar(),
    () => useCalculadorasStore().carregar(),
  ])
  if (!abertura.ok) {
    // Banco não abriu (ex.: a atualização do Dexie falhou e foi desfeita): tela clara em vez de app em branco.
    console.error('Falha ao abrir o banco do aparelho', abertura.erro)
    createApp(FalhaAbertura).mount('#app')
    return
  }
  app.use(router)
  app.mount('#app')

  // Não bloqueia a abertura do app; o status aparece em Ajustes. Irrelevante no pen drive.
  if (!MODO_PENDRIVE) void pedirArmazenamentoPersistente()
}
