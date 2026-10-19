import { createRouter, createWebHashHistory } from 'vue-router'
import { MODO_PENDRIVE, rotaBloqueadaNoPenDrive } from '@/modo'
import { useConfiguracoesStore } from '@/stores/configuracoes'

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
      path: '/calculadoras/nova',
      name: 'calculadora-nova',
      component: () => import('@/views/CalculadoraEditorView.vue'),
      meta: { titulo: 'Nova calculadora' },
    },
    {
      path: '/calculadoras/:id/editar',
      name: 'calculadora-editar',
      component: () => import('@/views/CalculadoraEditorView.vue'),
      meta: { titulo: 'Editar calculadora' },
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
      meta: { titulo: 'Grupos' },
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
      path: '/carregar',
      name: 'carregar',
      component: () => import('@/views/CarregarBibliotecaView.vue'),
      meta: { titulo: 'Carregar biblioteca' },
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

// Modo pen drive: somente leitura, e nada funciona antes de carregar a biblioteca do pen drive.
if (MODO_PENDRIVE) {
  router.beforeEach((para) => {
    if (rotaBloqueadaNoPenDrive(para.path)) return '/prescricoes'
    const carregada = useConfiguracoesStore().config.bibliotecaPenDriveDe !== null
    if (!carregada && para.path !== '/carregar') return '/carregar'
    if (carregada && para.path === '/carregar') return '/prescricoes'
  })
} else {
  router.beforeEach((para) => (para.path === '/carregar' ? '/prescricoes' : undefined))
}

declare module 'vue-router' {
  interface RouteMeta {
    titulo?: string
  }
}
