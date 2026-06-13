import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router/index.js'
import App from './App.vue'
import './assets/style.css'

// iOS WebKit (Safari, Chrome, Firefox) scrolls the document even inside
// position:fixed containers. We intercept in the CAPTURE phase so this
// fires before any element listener (including lightweight-charts, which
// calls stopPropagation on touch events — that would block a bubble-phase
// listener on document from ever receiving the event).
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
}, { passive: false, capture: true })

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
