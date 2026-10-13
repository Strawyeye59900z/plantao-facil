import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * Hash history (/#/rota): o GitHub Pages não tem fallback de SPA,
 * e assim qualquer rota abre direto, inclusive offline.
 */
export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/prescricoes' },
    {
      path: '/prescricoes',
      name: 'prescricoes',
      component: () => import('@/views/PrescricoesView.vue'),
      meta: { titulo: 'Prescrições' },
    },
    {
      path: '/prescricoes/nova',
      name: 'prescricao-nova',
      component: () => import('@/views/PrescricaoEditorView.vue'),
      meta: { titulo: 'Nova prescrição' },
    },
    {
      path: '/prescricoes/:id/editar',
      name: 'prescricao-editar',
      component: () => import('@/views/PrescricaoEditorView.vue'),
      meta: { titulo: 'Editar prescrição' },
    },
    {
      path: '/prescricoes/:id',
      name: 'prescricao',
      component: () => import('@/views/PrescricaoView.vue'),
      meta: { titulo: 'Prescrição' },
    },
    {
      path: '/calculadoras',
      name: 'calculadoras',
      component: () => import('@/views/CalculadorasView.vue'),
      meta: { titulo: 'Calculadoras' },
    },
    {
      path: '/calculadoras/:id',
      name: 'calculadora',
      component: () => import('@/views/CalculadoraView.vue'),
      meta: { titulo: 'Calculadora' },
    },
    {
      path: '/ajustes',
      name: 'ajustes',
      component: () => import('@/views/AjustesView.vue'),
      meta: { titulo: 'Ajustes' },
    },
    {
      path: '/categorias',
      name: 'categorias',
      component: () => import('@/views/CategoriasView.vue'),
      meta: { titulo: 'Categorias' },
    },
    {
      path: '/backup',
      name: 'backup',
      component: () => import('@/views/BackupView.vue'),
      meta: { titulo: 'Backup' },
    },
    {
      path: '/importar',
      name: 'importar',
      component: () => import('@/views/ImportarView.vue'),
      meta: { titulo: 'Importar PDF' },
    },
    {
      path: '/lixeira',
      name: 'lixeira',
      component: () => import('@/views/LixeiraView.vue'),
      meta: { titulo: 'Lixeira' },
    },
    {
      path: '/:caminho(.*)*',
      name: 'nao-encontrada',
      component: () => import('@/views/NaoEncontradaView.vue'),
      meta: { titulo: 'Página não encontrada' },
    },
  ],
})

declare module 'vue-router' {
  interface RouteMeta {
    titulo?: string
  }
}
