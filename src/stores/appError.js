import { defineStore } from 'pinia'
import { ref } from 'vue'

// Tracks whether an uncaught error has left part of the UI in a broken
// state, so App.vue can swap in a fallback instead of a blank screen.
// Vue 3 has no first-class error-boundary component — this store plus
// App.vue's onErrorCaptured wrapper is the closest equivalent.
export const useAppErrorStore = defineStore('appError', () => {
  const fatalError = ref(null)

  function setFatalError(err) {
    fatalError.value = err
  }

  function clear() {
    fatalError.value = null
  }

  return { fatalError, setFatalError, clear }
})
