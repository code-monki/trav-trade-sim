import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ChartSheet from '../../src/components/ChartSheet.vue'

// The sheet teleports to <body>, so assertions go through document queries.
function mountSheet(props = {}) {
  return mount(ChartSheet, {
    props,
    slots: { default: '<div class="slot-content">chart here</div>' },
    attachTo: document.body,
  })
}

function sheetEl()  { return document.body.querySelector('.chart-sheet') }
function handleEl() { return document.body.querySelector('.sheet-handle') }

async function settle() {
  // entry animation is started on the next animation frame
  await new Promise(r => requestAnimationFrame(r))
  await nextTick()
}

describe('ChartSheet — structure & accessibility', () => {
  it('renders a labelled dialog with a ≥44px drag handle and the slotted chart', async () => {
    const wrapper = mountSheet()
    await settle()

    const sheet = sheetEl()
    expect(sheet).toBeTruthy()
    expect(sheet.getAttribute('role')).toBe('dialog')
    expect(sheet.getAttribute('aria-labelledby')).toBe('chart-sheet-title')
    expect(document.body.querySelector('.slot-content')).toBeTruthy()

    const handle = handleEl()
    expect(handle.getAttribute('role')).toBe('separator')
    expect(handle.getAttribute('tabindex')).toBe('0')

    wrapper.unmount()
  })

  it('opens at the half detent by default and moves focus to the handle', async () => {
    const wrapper = mountSheet()
    await settle()
    expect(handleEl().getAttribute('aria-valuenow')).toBe('1')  // peek=0 half=1 full=2
    expect(document.activeElement).toBe(handleEl())
    wrapper.unmount()
  })

  it('honours initialDetent', async () => {
    const wrapper = mountSheet({ initialDetent: 'peek' })
    await settle()
    expect(handleEl().getAttribute('aria-valuenow')).toBe('0')
    wrapper.unmount()
  })
})

describe('ChartSheet — keyboard', () => {
  it('arrow keys step between detents on the handle', async () => {
    const wrapper = mountSheet()
    await settle()
    const handle = handleEl()

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    await nextTick()
    expect(handle.getAttribute('aria-valuenow')).toBe('2')     // half → full

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await nextTick()
    expect(handle.getAttribute('aria-valuenow')).toBe('1')     // full → half

    wrapper.unmount()
  })

  it('ArrowDown below peek dismisses', async () => {
    const wrapper = mountSheet({ initialDetent: 'peek' })
    await settle()
    handleEl().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('dismiss')).toBeTruthy()
    wrapper.unmount()
  })

  it('Escape dismisses', async () => {
    const wrapper = mountSheet()
    await settle()
    sheetEl().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('dismiss')).toBeTruthy()
    wrapper.unmount()
  })
})

describe('ChartSheet — detents & scrim', () => {
  it('shows the scrim only at the full detent, and clicking it dismisses', async () => {
    const wrapper = mountSheet()
    await settle()
    expect(document.body.querySelector('.sheet-scrim')).toBeFalsy()

    handleEl().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    await nextTick()
    const scrim = document.body.querySelector('.sheet-scrim')
    expect(scrim).toBeTruthy()
    expect(sheetEl().getAttribute('aria-modal')).toBe('true')

    scrim.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('dismiss')).toBeTruthy()
    wrapper.unmount()
  })

  it('reports its visible height so the layout can pad past it, and 0 on unmount', async () => {
    const wrapper = mountSheet()
    await settle()
    const events = wrapper.emitted('inset-change')
    expect(events.length).toBeGreaterThan(0)
    expect(events[events.length - 1][0]).toBeGreaterThan(0)

    wrapper.unmount()
    const after = wrapper.emitted('inset-change')
    expect(after[after.length - 1][0]).toBe(0)
  })
})
