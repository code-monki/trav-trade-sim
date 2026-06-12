<template>
  <div class="hm-wrap" ref="wrapEl">
    <button class="hm-btn" :class="{ open: isOpen }"
            @click="isOpen = !isOpen" aria-label="Menu" title="Menu">
      <span class="bar" />
      <span class="bar" />
      <span class="bar" />
    </button>

    <div v-if="isOpen" class="hm-dropdown">
      <button class="hm-item" @click="select('about')">About</button>
      <button class="hm-item" @click="select('help')">Help &amp; User Manual</button>
      <div class="hm-divider" />
      <button class="hm-item danger" @click="select('signout')">Sign Out</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const emit   = defineEmits(['about', 'help', 'signout'])
const isOpen = ref(false)
const wrapEl = ref(null)

function select(action) {
  isOpen.value = false
  emit(action)
}

function handleClickOutside(e) {
  if (wrapEl.value && !wrapEl.value.contains(e.target)) isOpen.value = false
}

onMounted(()   => document.addEventListener('mousedown', handleClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', handleClickOutside))
</script>

<style scoped>
.hm-wrap {
  position: relative;
}

.hm-btn {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
  width: 34px;
  height: 34px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  padding: 0;
  transition: border-color 0.15s, background 0.15s;
}

.hm-btn:hover,
.hm-btn.open {
  border-color: var(--accent-dim);
  background: var(--bg-item);
}

.bar {
  display: block;
  width: 14px;
  height: 2px;
  background: var(--text-dim);
  border-radius: 1px;
  transition: background 0.15s;
}

.hm-btn:hover .bar,
.hm-btn.open  .bar {
  background: var(--text);
}

/* Dropdown */
.hm-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 180px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.35rem 0;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  z-index: 200;
}

.hm-item {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: var(--text);
  font-size: 0.83rem;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: background 0.1s;
}

.hm-item:hover      { background: var(--bg-item); }
.hm-item.danger     { color: var(--red); }
.hm-item.danger:hover { background: rgba(217,58,58,0.08); }

.hm-divider {
  height: 1px;
  background: var(--border);
  margin: 0.3rem 0;
}
</style>
