<template>
  <Teleport to="body">
    <div class="overlay">
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="rc-title">
        <h2 id="rc-title" class="dialog-title">Save Your Recovery Code</h2>
        <p class="dialog-sub">
          If you ever forget your PIN, this code lets you reset it.
          <strong>It will not be shown again.</strong>
        </p>

        <div class="code-block">
          <span class="code-text">{{ props.code }}</span>
          <button class="copy-btn" @click="copy" :class="{ copied }">
            {{ copied ? 'Copied!' : 'Copy' }}
          </button>
        </div>

        <p class="store-hint">
          Write it down and store it somewhere safe — a notebook, a password manager, or alongside your campaign notes.
        </p>

        <label class="ack-label">
          <input type="checkbox" v-model="acknowledged" class="ack-check" />
          I have saved my recovery code and understand it cannot be retrieved later.
        </label>

        <button class="continue-btn" :disabled="!acknowledged" @click="$emit('close')">
          Continue to Campaign
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  code: { type: String, required: true },
})

defineEmits(['close'])

const acknowledged = ref(false)
const copied       = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // clipboard unavailable — user can select manually
  }
}
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
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.dialog-title {
  font-size: 1.1rem;
  color: var(--amber);
  margin: 0;
}

.dialog-sub {
  font-size: 0.85rem;
  color: var(--text);
  line-height: 1.5;
  margin: 0;
}

.code-block {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--bg);
  border: 1px solid var(--amber);
  border-radius: var(--radius);
  padding: 0.75rem 1rem;
}

.code-text {
  font-family: monospace;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  color: var(--amber);
  flex: 1;
  word-break: break-all;
}

.copy-btn {
  flex-shrink: 0;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: var(--radius);
  padding: 0.25rem 0.65rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.1s;
}
.copy-btn:hover  { border-color: var(--accent-dim); color: var(--accent); }
.copy-btn.copied { border-color: var(--green); color: var(--green); }

.store-hint {
  font-size: 0.78rem;
  color: var(--text-dim);
  line-height: 1.5;
  margin: 0;
}

.ack-label {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  font-size: 0.82rem;
  color: var(--text);
  line-height: 1.5;
  cursor: pointer;
}

.ack-check {
  flex-shrink: 0;
  margin-top: 2px;
  width: 1rem;
  height: 1rem;
  accent-color: var(--accent);
  cursor: pointer;
}

.continue-btn {
  background: var(--accent-dim);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  padding: 0.65rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  letter-spacing: 0.04em;
}
.continue-btn:hover:not(:disabled) { background: var(--accent); }
.continue-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
