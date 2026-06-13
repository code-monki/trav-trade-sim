<template>
  <Teleport to="body">
    <div v-if="modelValue" class="overlay" @mousedown.self="close">
      <div class="dialog" role="dialog" aria-modal="true"
           aria-labelledby="tut-dialog-title" ref="dialogEl">

        <!-- Header -->
        <div class="dialog-header">
          <span id="tut-dialog-title" class="dialog-title">Tutorials</span>
          <button class="close-btn" @click="close" aria-label="Close">✕</button>
        </div>

        <!-- Body: nav + content -->
        <div class="dialog-body">

          <!-- Left navigation -->
          <nav class="tut-nav" aria-label="Tutorial list">
            <div v-for="group in TUTORIAL_GROUPS" :key="group.role" class="nav-group">
              <div class="nav-group-label">{{ group.role }}</div>
              <button
                v-for="id in group.ids"
                :key="id"
                :class="['nav-item', { active: selectedId === id }]"
                @click="selectTut(id)"
              >
                {{ TUTORIAL_MAP[id].title }}
              </button>
            </div>
          </nav>

          <!-- Right content -->
          <div class="tut-content" ref="contentEl" @click="handleContentClick">
            <template v-if="current">
              <div v-for="sec in current.sections" :key="sec.id" :id="sec.id" class="tut-section">
                <h3 class="sec-title">{{ sec.title }}</h3>
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div class="sec-body" v-html="sec.body" />
              </div>
            </template>
          </div>

        </div>

        <!-- Footer -->
        <div class="dialog-footer">
          <div class="footer-nav">
            <button class="btn-ghost" :disabled="!prevTut" @click="prevTut && selectTut(prevTut.id)">
              ← {{ prevTut?.title ?? '' }}
            </button>
            <button class="btn-ghost" :disabled="!nextTut" @click="nextTut && selectTut(nextTut.id)">
              {{ nextTut?.title ?? '' }} →
            </button>
          </div>
          <button class="btn-primary" @click="close">Close</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { TUTORIALS, TUTORIAL_GROUPS, TUTORIAL_MAP } from '../lib/tutorials.js'
import { useFocusTrap } from '../composables/useFocusTrap.js'

const props = defineProps({ modelValue: { type: Boolean, required: true } })
const emit  = defineEmits(['update:modelValue'])

const dialogEl  = ref(null)
const contentEl = ref(null)
const selectedId = ref(TUTORIALS[0].id)

const { activate, deactivate } = useFocusTrap(dialogEl)
watch(() => props.modelValue, v => v ? nextTick(activate) : deactivate())

const current = computed(() => TUTORIAL_MAP[selectedId.value])

const allIds = TUTORIALS.map(t => t.id)
const prevTut = computed(() => {
  const i = allIds.indexOf(selectedId.value)
  return i > 0 ? TUTORIAL_MAP[allIds[i - 1]] : null
})
const nextTut = computed(() => {
  const i = allIds.indexOf(selectedId.value)
  return i < allIds.length - 1 ? TUTORIAL_MAP[allIds[i + 1]] : null
})

function selectTut(id, sectionId = null) {
  selectedId.value = id
  nextTick(() => {
    if (sectionId) {
      const el = contentEl.value?.querySelector(`#${sectionId}`)
      el ? el.scrollIntoView({ behavior: 'smooth', block: 'start' })
         : contentEl.value?.scrollTo({ top: 0 })
    } else {
      contentEl.value?.scrollTo({ top: 0 })
    }
  })
}

// Event delegation for cross-reference links inside v-html content
function handleContentClick(e) {
  const a = e.target.closest('[data-tut]')
  if (!a) return
  e.preventDefault()
  selectTut(a.dataset.tut, a.dataset.sec)
}

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
  width: min(820px, 95vw);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(0,0,0,0.5);
}

/* ── Header ────────────────────────────────────────────────────────────────── */
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.dialog-title {
  font-size: 0.88rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
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

/* ── Body: nav + content ───────────────────────────────────────────────────── */
.dialog-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Left nav */
.tut-nav {
  width: 190px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.75rem 0;
}

.nav-group { margin-bottom: 1rem; }

.nav-group-label {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-dim);
  padding: 0 0.85rem 0.3rem;
}

.nav-item {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  border-left: 3px solid transparent;
  color: var(--text-dim);
  font-size: 0.82rem;
  padding: 0.45rem 0.85rem;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
}
.nav-item:hover { background: var(--bg-item); color: var(--text); }
.nav-item.active {
  border-left-color: var(--accent);
  color: var(--accent);
  background: var(--bg-selected);
}

/* Right content */
.tut-content {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.tut-section {
  padding-bottom: 1.25rem;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid rgba(42,48,80,0.5);
  scroll-margin-top: 0.5rem;
}
.tut-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }

.sec-title {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  margin: 0 0 0.65rem;
}

/* ── v-html content styles (applied globally to .sec-body children) ────────── */
</style>

<!-- Non-scoped styles for v-html content -->
<style>
.sec-body p {
  font-size: 0.83rem;
  color: var(--text);
  line-height: 1.65;
  margin: 0 0 0.55rem;
}
.sec-body p:last-child { margin-bottom: 0; }

.sec-body ul, .sec-body ol {
  margin: 0.3rem 0 0.55rem 1.2rem;
  padding: 0;
}
.sec-body li {
  font-size: 0.83rem;
  color: var(--text);
  line-height: 1.6;
  margin-bottom: 0.25rem;
}

.sec-body strong { color: var(--text); font-weight: 600; }
.sec-body code {
  font-family: monospace;
  background: var(--bg-item);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.85em;
  color: var(--code);
}
.sec-body kbd {
  display: inline-block;
  font-family: monospace;
  font-size: 0.82rem;
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 6px;
  color: var(--code);
}

.sec-body a[data-tut] {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  font-size: inherit;
}
.sec-body a[data-tut]:hover { color: var(--accent-dim); }

/* Tutorial table */
.tut-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  margin: 0.6rem 0 0.55rem;
}
.tut-table th {
  text-align: left;
  padding: 0.3rem 0.6rem;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-dim);
  border-bottom: 1px solid var(--border);
}
.tut-table td {
  padding: 0.4rem 0.6rem;
  color: var(--text);
  border-bottom: 1px solid rgba(42,48,80,0.3);
  vertical-align: top;
}
.tut-table td:first-child {
  white-space: nowrap;
  color: var(--accent);
  width: 10rem;
  font-weight: 500;
}
.tut-table tr:last-child td { border-bottom: none; }

/* Screenshot placeholder */
.tut-shot {
  background: var(--bg-item);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  padding: 0.5rem 0.85rem;
  font-size: 0.75rem;
  color: var(--text-dim);
  font-style: italic;
  margin: 0.5rem 0;
}

/* Warning and note callouts */
.tut-warn {
  background: rgba(217,58,58,0.07);
  border-left: 3px solid var(--red);
  border-radius: 0 var(--radius) var(--radius) 0;
  padding: 0.45rem 0.75rem;
  font-size: 0.82rem;
  color: var(--text);
  margin: 0.4rem 0 0.55rem !important;
}
.tut-note {
  background: rgba(90,120,200,0.07);
  border-left: 3px solid var(--accent-dim);
  border-radius: 0 var(--radius) var(--radius) 0;
  padding: 0.45rem 0.75rem;
  font-size: 0.82rem;
  color: var(--text);
  margin: 0.4rem 0 0.55rem !important;
}
</style>

<style scoped>
/* ── Footer ────────────────────────────────────────────────────────────────── */
.dialog-footer {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 1rem;
}

.footer-nav {
  display: flex;
  gap: 0.5rem;
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: var(--radius);
  padding: 0.3rem 0.75rem;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.btn-ghost:hover:not(:disabled) { border-color: var(--accent-dim); color: var(--accent); }
.btn-ghost:disabled { opacity: 0.3; cursor: default; }

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
  flex-shrink: 0;
}
.btn-primary:hover { background: var(--accent); }

/* ── Responsive: narrow screens ─────────────────────────────────────────────── */
@media (max-width: 540px) {
  .tut-nav { width: 140px; }
  .footer-nav { display: none; }
}
</style>
