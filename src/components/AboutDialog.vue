<template>
  <Teleport to="body">
    <div v-if="modelValue" class="overlay" @mousedown.self="close">
      <div class="dialog" role="dialog" aria-modal="true" aria-label="About">
        <div class="dialog-header">
          <div class="app-identity">
            <span class="app-name">Traveller Trade Simulator</span>
            <span class="app-version">v{{ version }}</span>
          </div>
          <button class="close-btn" @click="close" aria-label="Close">✕</button>
        </div>

        <div class="dialog-body">
          <p class="app-desc">
            A speculative trade dashboard for Classic Traveller campaigns,
            inspired by the market mechanics of M.U.L.E. Track commodity prices,
            analyse market events, and identify profitable trade routes across the
            Third Imperium.
          </p>

          <a class="repo-link"
             href="https://github.com/code-monki/trav-trade-sim"
             target="_blank" rel="noopener noreferrer">
            View source on GitHub
          </a>

          <hr class="section-rule" />

          <div class="legal-block">
            <p class="legal-head">Mongoose Publishing</p>
            <p>
              The Traveller game in all forms is owned by Mongoose Publishing Ltd..
              Copyright 1977&nbsp;- Present Mongoose Publishing Ltd. Traveller is a
              registered trademark of Mongoose Publishing, Ltd. Mongoose Publishing
              permits web sites and fanzines for this game, provided it contains this
              notice, that Mongoose Publishing is notified, and subject to a withdrawal
              of permission on 90 days notice. The contents of this site are for
              personal, non-commercial use only.
            </p>
            <p>
              Any use of Mongoose Publishing's copyrighted material or trademarks
              anywhere on this web site and its files should not be viewed as a
              challenge to those copyrights or trademarks. In addition, any
              program/articles/file on this site cannot be republished or distributed
              without the consent of the author who contributed it.
            </p>
          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn-primary" @click="close">Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import pkg from '../../package.json'

const props = defineProps({ modelValue: { type: Boolean, required: true } })
const emit  = defineEmits(['update:modelValue'])

const version = pkg.version

function close() { emit('update:modelValue', false) }

function onKey(e) { if (e.key === 'Escape') close() }
onMounted(()   => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
}

.dialog {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) * 2);
  width: min(520px, 92vw);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(0,0,0,0.5);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0.75rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.app-identity {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}

.app-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
  letter-spacing: 0.02em;
}

.app-version {
  font-size: 0.72rem;
  color: var(--text-dim);
  font-family: monospace;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius);
  transition: color 0.15s;
}
.close-btn:hover { color: var(--text); }

.dialog-body {
  padding: 1.1rem 1.25rem;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.app-desc {
  font-size: 0.85rem;
  color: var(--text);
  line-height: 1.55;
  margin: 0;
}

.repo-link {
  font-size: 0.8rem;
  color: var(--accent);
  text-decoration: none;
  width: fit-content;
}
.repo-link:hover { text-decoration: underline; }

.section-rule {
  border: none;
  border-top: 1px solid var(--border);
  margin: 0.25rem 0;
}

.legal-block {
  font-size: 0.75rem;
  color: var(--text-dim);
  line-height: 1.55;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.legal-head {
  font-weight: 600;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-dim);
  margin: 0;
}

.legal-block p { margin: 0; }

.dialog-footer {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.btn-primary {
  background: var(--accent-dim);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  padding: 0.35rem 1.1rem;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-primary:hover { background: var(--accent); }
</style>
