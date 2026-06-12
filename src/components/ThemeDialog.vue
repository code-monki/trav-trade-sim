<template>
  <Teleport to="body">
    <div v-if="modelValue" class="overlay" @mousedown.self="close">
      <div class="dialog" role="dialog" aria-modal="true"
           aria-labelledby="theme-dialog-title" ref="dialogEl">

        <div class="dialog-header">
          <h2 id="theme-dialog-title" class="dialog-title">Themes</h2>
          <button class="close-btn" @click="close" aria-label="Close themes">✕</button>
        </div>

        <div class="dialog-body">

          <!-- ── Theme list ─────────────────────────────────────────────── -->
          <div v-if="!editingTheme" class="theme-list">
            <div v-for="theme in themeStore.allThemes" :key="theme.id"
                 :class="['theme-card', { active: themeStore.currentId === theme.id }]"
                 role="button" :tabindex="0"
                 :aria-pressed="themeStore.currentId === theme.id"
                 @click="themeStore.setTheme(theme.id)"
                 @keydown.enter.space.prevent="themeStore.setTheme(theme.id)">

              <div class="swatch-row" aria-hidden="true">
                <span v-for="key in SWATCH_KEYS" :key="key"
                      class="swatch"
                      :style="{ background: theme.tokens[key] }" />
              </div>

              <div class="theme-info">
                <span class="theme-name">{{ theme.name }}</span>
                <span class="theme-desc">{{ theme.description }}</span>
              </div>

              <div class="theme-actions" @click.stop @keydown.stop>
                <span v-if="themeStore.currentId === theme.id"
                      class="active-badge" aria-label="Currently active">Active</span>
                <button class="action-btn" title="Export theme as JSON"
                        @click="doExport(theme.id)" aria-label="Export {{ theme.name }}">
                  ↓
                </button>
                <button v-if="!theme.builtin" class="action-btn"
                        title="Edit theme" aria-label="Edit {{ theme.name }}"
                        @click="startEdit(theme)">
                  ✎
                </button>
                <button v-if="!theme.builtin" class="action-btn danger"
                        title="Delete theme" aria-label="Delete {{ theme.name }}"
                        @click="doDelete(theme.id)">
                  ✕
                </button>
              </div>
            </div>
          </div>

          <!-- ── Theme editor ───────────────────────────────────────────── -->
          <div v-else class="theme-editor">
            <div class="editor-header">
              <button class="back-btn" @click="editingTheme = null"
                      aria-label="Back to theme list">
                ← Back
              </button>
              <span class="editor-title">{{ editingTheme.id ? 'Edit Theme' : 'New Theme' }}</span>
            </div>

            <div class="editor-fields">
              <label class="field-label" for="theme-name-input">Theme Name</label>
              <input id="theme-name-input" v-model="editingTheme.name"
                     class="theme-name-input" placeholder="My Custom Theme"
                     autocomplete="off" />

              <label class="field-label" for="base-theme-select">
                Base On
                <span class="field-hint">(copies all tokens from the selected built-in theme)</span>
              </label>
              <select id="base-theme-select" class="base-select"
                      v-model="baseThemeId" @change="applyBase">
                <option v-for="t in BUILTIN_THEMES" :key="t.id" :value="t.id">
                  {{ t.name }}
                </option>
              </select>
            </div>

            <div class="token-editor">
              <div v-for="group in THEME_TOKEN_GROUPS" :key="group.label" class="token-group">
                <h4 class="group-label">{{ group.label }}</h4>
                <div class="token-grid">
                  <div v-for="tok in group.tokens" :key="tok.key" class="token-row">
                    <label :for="`tok-${tok.key}`" class="token-label">
                      {{ tok.label }}
                    </label>
                    <div class="token-inputs">
                      <input :id="`tok-${tok.key}`"
                             type="color"
                             :value="editingTheme.tokens[tok.key] || '#000000'"
                             @input="editingTheme.tokens[tok.key] = $event.target.value"
                             class="color-picker"
                             :aria-label="tok.label + ' colour picker'" />
                      <input type="text"
                             :value="editingTheme.tokens[tok.key] || ''"
                             @input="editingTheme.tokens[tok.key] = $event.target.value"
                             class="hex-input"
                             placeholder="#000000"
                             :aria-label="tok.label + ' hex value'" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div class="dialog-footer">
          <template v-if="!editingTheme">
            <label class="import-btn" title="Import a theme from a JSON file">
              Import
              <input type="file" accept=".json,application/json"
                     class="sr-only" @change="doImport" aria-label="Import theme JSON file" />
            </label>
            <button class="btn-secondary" @click="startNew">New Theme</button>
          </template>
          <template v-else>
            <button class="btn-secondary" @click="editingTheme = null">Cancel</button>
            <button class="btn-primary" @click="doSave"
                    :disabled="!editingTheme.name.trim()">Save Theme</button>
          </template>
          <button class="btn-primary" @click="close">Done</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useThemeStore }       from '../stores/theme.js'
import { BUILTIN_THEMES }      from '../lib/themes-builtin.js'
import { THEME_TOKEN_GROUPS }  from '../lib/theme-tokens.js'
import { useFocusTrap }        from '../composables/useFocusTrap.js'

const props = defineProps({ modelValue: { type: Boolean, required: true } })
const emit  = defineEmits(['update:modelValue'])

const themeStore   = useThemeStore()
const dialogEl     = ref(null)
const editingTheme = ref(null)
const baseThemeId  = ref('dark-imperium')

const { activate, deactivate } = useFocusTrap(dialogEl)
watch(() => props.modelValue, v => v ? nextTick(activate) : deactivate())

// Keys shown as colour swatches in the theme card
const SWATCH_KEYS = ['--bg', '--bg-panel', '--accent', '--text', '--border']

function close() { emit('update:modelValue', false); editingTheme.value = null }

function onKey(e) { if (e.key === 'Escape') close() }
import { onMounted, onUnmounted } from 'vue'
onMounted(()   => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))

// ── Editor ─────────────────────────────────────────────────────────────────

function blankTheme() {
  const base = BUILTIN_THEMES.find(t => t.id === baseThemeId.value) ?? BUILTIN_THEMES[0]
  return {
    id:          '',
    name:        '',
    description: '',
    builtin:     false,
    tokens:      { ...base.tokens },
  }
}

function startNew()    { editingTheme.value = blankTheme() }
function startEdit(t)  {
  baseThemeId.value  = t.baseId ?? 'dark-imperium'
  editingTheme.value = { ...t, tokens: { ...t.tokens } }
}

function applyBase() {
  const base = BUILTIN_THEMES.find(t => t.id === baseThemeId.value) ?? BUILTIN_THEMES[0]
  editingTheme.value.tokens = { ...base.tokens }
}

async function doSave() {
  if (!editingTheme.value.name.trim()) return
  const theme = {
    ...editingTheme.value,
    id:     editingTheme.value.id || `user-${Date.now()}`,
    baseId: baseThemeId.value,
  }
  await themeStore.saveUserTheme(theme)
  themeStore.setTheme(theme.id)
  editingTheme.value = null
}

async function doDelete(id) {
  if (!confirm('Delete this theme?')) return
  await themeStore.deleteUserTheme(id)
}

function doExport(id) {
  const json = themeStore.exportTheme(id)
  if (!json) return
  const a  = document.createElement('a')
  a.href   = `data:application/json,${encodeURIComponent(json)}`
  a.download = `tts-theme-${id}.json`
  a.click()
}

async function doImport(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    await themeStore.importTheme(text)
  } catch {
    alert('Could not import theme — invalid file.')
  }
  e.target.value = ''
}
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
  width: min(600px, 92vw);
  max-height: 88vh;
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

.dialog-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius);
  min-width: 28px; min-height: 28px;
}
.close-btn:hover { color: var(--text); }

.dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
}

/* ── Theme list ────────────────────────────────────────────────────────── */
.theme-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.theme-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  background: var(--bg-item);
}

.theme-card:hover,
.theme-card:focus-visible {
  border-color: var(--accent-dim);
  background: var(--bg-selected);
  outline: none;
}

.theme-card.active {
  border-color: var(--accent);
  background: var(--bg-selected);
}

.swatch-row {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
}

.swatch {
  width: 18px;
  height: 32px;
  border-radius: 3px;
  border: 1px solid rgba(0,0,0,0.15);
}

.theme-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.theme-name { font-size: 0.85rem; font-weight: 600; color: var(--text); }
.theme-desc { font-size: 0.72rem; color: var(--text-dim); }

.theme-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.active-badge {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--accent);
  border: 1px solid var(--accent-dim);
  padding: 1px 6px;
  border-radius: 8px;
  text-transform: uppercase;
}

.action-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 0.78rem;
  padding: 2px 7px;
  border-radius: var(--radius);
  cursor: pointer;
  min-width: 28px; min-height: 28px;
  transition: all 0.12s;
}
.action-btn:hover       { border-color: var(--accent-dim); color: var(--accent); }
.action-btn.danger:hover { border-color: var(--red); color: var(--red); }

/* ── Theme editor ──────────────────────────────────────────────────────── */
.theme-editor {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.editor-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.back-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 0.8rem;
  padding: 0.25rem 0.7rem;
  border-radius: var(--radius);
  cursor: pointer;
  min-height: 30px;
  transition: all 0.12s;
}
.back-btn:hover { border-color: var(--accent-dim); color: var(--text); }

.editor-title { font-size: 0.9rem; font-weight: 600; color: var(--text); }

.editor-fields {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  display: block;
}

.field-hint {
  font-size: 0.68rem;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--text-dim);
  margin-left: 0.4rem;
}

.theme-name-input,
.base-select {
  background: var(--bg-item);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.4rem 0.65rem;
  font-size: 0.85rem;
  width: 100%;
}

.theme-name-input:focus-visible,
.base-select:focus-visible {
  border-color: var(--accent);
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.token-editor {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.token-group { }

.group-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  margin-bottom: 0.5rem;
}

.token-grid {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.token-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.token-label {
  font-size: 0.78rem;
  color: var(--text);
  flex: 1;
  min-width: 0;
}

.token-inputs {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.color-picker {
  width: 36px;
  height: 28px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-item);
  cursor: pointer;
}

.hex-input {
  width: 88px;
  background: var(--bg-item);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.25rem 0.5rem;
  font-size: 0.78rem;
  font-family: monospace;
}

.hex-input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-color: var(--accent);
}

/* ── Footer ────────────────────────────────────────────────────────────── */
.dialog-footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.import-btn {
  font-size: 0.8rem;
  padding: 0.35rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.12s;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
}
.import-btn:hover { border-color: var(--accent-dim); color: var(--text); }

.btn-primary {
  background: var(--accent-dim);
  color: var(--bg);
  border: none;
  border-radius: var(--radius);
  padding: 0.35rem 1rem;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  min-height: 32px;
}
.btn-primary:hover:not(:disabled) { background: var(--accent); }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: var(--radius);
  padding: 0.35rem 1rem;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.12s;
  min-height: 32px;
}
.btn-secondary:hover { border-color: var(--accent-dim); color: var(--text); }

/* Screen-reader only */
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}
</style>
