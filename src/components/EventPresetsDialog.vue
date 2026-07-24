<template>
  <Teleport to="body">
    <div class="overlay">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="presets-title">
        <button class="close-btn" @click="$emit('close')" aria-label="Close">✕</button>
        <h2 id="presets-title" class="dialog-title">Built-in Presets</h2>
        <p class="dialog-sub">Reference only — assign one to a world from the Event Definitions list.</p>

        <div class="catalogue-list">
          <div v-for="e in EVENT_CATALOGUE" :key="e.description" class="cat-entry">
            <span class="cat-desc">{{ e.description }}</span>
            <span class="cat-meta">
              <span v-if="e.buyModifierPct != null" :class="e.buyModifierPct > 0 ? 'mod-up' : 'mod-down'">
                Buy {{ e.buyModifierPct > 0 ? '+' : '' }}{{ e.buyModifierPct }}%
              </span>
              <span v-if="e.sellModifierPct != null" :class="e.sellModifierPct > 0 ? 'mod-up' : 'mod-down'">
                Sell {{ e.sellModifierPct > 0 ? '+' : '' }}{{ e.sellModifierPct }}%
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { EVENT_CATALOGUE } from '../lib/event-catalogue.js'

defineEmits(['close'])
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}

.dialog {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 2rem;
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: relative;
  overflow-y: auto;
}

.dialog-title { font-size: 1.1rem; margin: 0; }
.dialog-sub   { font-size: 0.82rem; color: var(--text-dim); margin: 0; }

.close-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius);
}
.close-btn:hover { color: var(--text); background: var(--bg-item); }

.catalogue-list { display: flex; flex-direction: column; gap: 0.3rem; }

.cat-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.35rem 0.65rem;
}

.cat-desc { font-size: 0.8rem; color: var(--text); flex: 1; }
.cat-meta { display: flex; gap: 0.4rem; flex-shrink: 0; font-size: 0.72rem; font-family: monospace; }
.mod-up   { color: var(--red, #e05); }
.mod-down { color: var(--accent); }
</style>
