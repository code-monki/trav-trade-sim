import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router/index.js'
import App from './App.vue'
import './assets/style.css'

// iOS WebKit scrolls the document even inside position:fixed containers.
// Walk up from the touch target; only allow the event if we find a
// genuinely scrollable ancestor (has overflow auto/scroll AND actual overflow).
document.addEventListener('touchmove', (e) => {
  let node = e.target
  while (node && node !== document.body) {
    const { overflowY } = window.getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') &&
        node.scrollHeight > node.clientHeight) {
      return
    }
    node = node.parentElement
  }
  e.preventDefault()
}, { passive: false })

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
