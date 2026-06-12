import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router/index.js'
import App from './App.vue'
import './assets/style.css'

const app = createApp(App)

app.config.errorHandler = (err, instance, info) => {
  console.error('[vue]', info, err)
}

const pinia = createPinia()
app.use(pinia)
app.use(router)
app.mount('#app')

// Apply the saved/default theme as early as possible to avoid flash.
// Import after mount so Pinia is ready.
import('./stores/theme.js').then(({ useThemeStore }) => {
  useThemeStore().init()
})
