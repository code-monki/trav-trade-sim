/**
 * Traps keyboard focus inside a container element while a modal is open.
 * Tab cycles forward through focusable children; Shift+Tab cycles backward.
 * Focus moves to the first focusable child on activate().
 */

import { nextTick } from 'vue'

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function useFocusTrap(containerRef) {
  let previouslyFocused = null

  function getFocusable() {
    if (!containerRef.value) return []
    return [...containerRef.value.querySelectorAll(FOCUSABLE_SELECTORS)]
      .filter(el => el.offsetParent !== null)
  }

  function handleTab(e) {
    if (e.key !== 'Tab') return
    const focusable = getFocusable()
    if (!focusable.length) { e.preventDefault(); return }

    const first = focusable[0]
    const last  = focusable[focusable.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first || !containerRef.value?.contains(document.activeElement)) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last || !containerRef.value?.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  function activate() {
    previouslyFocused = document.activeElement
    document.addEventListener('keydown', handleTab)
    nextTick(() => {
      const focusable = getFocusable()
      if (focusable.length) focusable[0].focus()
    })
  }

  function deactivate() {
    document.removeEventListener('keydown', handleTab)
    if (previouslyFocused?.focus) previouslyFocused.focus()
    previouslyFocused = null
  }

  return { activate, deactivate }
}
