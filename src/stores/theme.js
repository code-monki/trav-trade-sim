import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { BUILTIN_THEMES } from '../lib/themes-builtin.js'
import { THEME_TOKENS }   from '../lib/theme-tokens.js'
import { dbGetAllThemes, dbSaveTheme, dbDeleteTheme } from '../lib/theme-db.js'

const LS_KEY = 'tts-theme-id'

export const useThemeStore = defineStore('theme', () => {

  const currentId  = ref(localStorage.getItem(LS_KEY) ?? 'dark-imperium')
  const userThemes = ref([])

  const allThemes = computed(() => [...BUILTIN_THEMES, ...userThemes.value])

  const currentTheme = computed(() =>
    allThemes.value.find(t => t.id === currentId.value) ?? BUILTIN_THEMES[0]
  )

  // ── Apply ──────────────────────────────────────────────────────────────────

  function applyTheme(theme) {
    const root = document.documentElement
    for (const { key } of THEME_TOKENS) {
      const val = theme.tokens[key]
      if (val) root.style.setProperty(key, val)
    }
  }

  function setTheme(id) {
    const theme = allThemes.value.find(t => t.id === id)
    if (!theme) return
    currentId.value = id
    localStorage.setItem(LS_KEY, id)
    applyTheme(theme)
  }

  // ── Init: load user themes from IndexedDB then apply saved preference ──────

  async function init() {
    try {
      userThemes.value = await dbGetAllThemes()
    } catch {
      userThemes.value = []
    }
    applyTheme(currentTheme.value)
  }

  // ── User theme management ──────────────────────────────────────────────────

  async function saveUserTheme(theme) {
    await dbSaveTheme(theme)
    const idx = userThemes.value.findIndex(t => t.id === theme.id)
    if (idx >= 0) userThemes.value[idx] = theme
    else userThemes.value.push(theme)
  }

  async function deleteUserTheme(id) {
    await dbDeleteTheme(id)
    userThemes.value = userThemes.value.filter(t => t.id !== id)
    if (currentId.value === id) setTheme('dark-imperium')
  }

  // ── Export / Import ────────────────────────────────────────────────────────

  function exportTheme(id) {
    const theme = allThemes.value.find(t => t.id === id)
    if (!theme) return null
    return JSON.stringify({ ...theme, builtin: false }, null, 2)
  }

  async function importTheme(json) {
    const theme = JSON.parse(json)
    if (!theme.id || !theme.name || !theme.tokens) throw new Error('Invalid theme file')
    theme.id = `user-${Date.now()}`   // always assign a fresh id on import
    theme.builtin = false
    await saveUserTheme(theme)
    return theme
  }

  return {
    currentId, userThemes, allThemes, currentTheme,
    init, setTheme, saveUserTheme, deleteUserTheme, exportTheme, importTheme,
  }
})
