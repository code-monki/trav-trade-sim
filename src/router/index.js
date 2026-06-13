import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
  },
  {
    path: '/',
    name: 'map',
    component: () => import('../views/MapView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/referee',
    name: 'referee',
    component: () => import('../views/RefereeView.vue'),
    meta: { requiresAuth: true, requiresReferee: true },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' }
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'map' }
  }
  if (to.meta.requiresReferee && !auth.isReferee) {
    return { name: 'map' }
  }
})

router.onError((err) => {
  console.error('[router]', err)
})

export default router
