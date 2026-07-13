<template>
  <div v-if="appError.fatalError" class="fatal-error">
    <h1>Traveller Trade Simulator</h1>
    <p>Something went wrong and the app couldn't continue safely.</p>
    <button @click="reload">Reload page</button>
  </div>
  <router-view v-else />
</template>

<script setup>
import { onErrorCaptured } from 'vue'
import { useAppErrorStore } from './stores/appError.js'

const appError = useAppErrorStore()

// Catches render/lifecycle errors thrown by any descendant component —
// the closest Vue 3 equivalent to a React error boundary. Returning false
// stops the error from propagating further up (it's already been logged
// by app.config.errorHandler before reaching here).
onErrorCaptured((err, instance, info) => {
  // Returning false stops propagation here, so this won't reach
  // app.config.errorHandler in main.js — log it ourselves.
  console.error('[vue]', info, err)
  appError.setFatalError({ err, info })
  return false
})

function reload() {
  window.location.reload()
}
</script>

<style scoped>
.fatal-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  height: 100vh;
  text-align: center;
  padding: 2rem;
  background: var(--bg);
  color: var(--text);
}

.fatal-error button {
  background: var(--accent-dim);
  color: var(--accent-text);
  border: none;
  border-radius: var(--radius);
  padding: 0.5rem 1.2rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.fatal-error button:hover { background: var(--accent); }
</style>
