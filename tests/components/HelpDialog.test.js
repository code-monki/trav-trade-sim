import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import HelpDialog from '../../src/components/HelpDialog.vue'

// Stub Teleport so content renders inline (no actual portal to body needed)
const teleportStub = { template: '<div><slot /></div>' }

function mountDialog(modelValue = true) {
  return mount(HelpDialog, {
    props: { modelValue },
    global: {
      plugins: [createTestingPinia({ stubActions: true, createSpy: vi.fn })],
      stubs: { Teleport: teleportStub },
    },
    attachTo: document.body,
  })
}

describe('HelpDialog', () => {
  it('renders nothing when modelValue is false', () => {
    const wrapper = mountDialog(false)
    expect(wrapper.find('.dialog').exists()).toBe(false)
  })

  it('renders the dialog when modelValue is true', () => {
    const wrapper = mountDialog(true)
    expect(wrapper.find('.dialog').exists()).toBe(true)
  })

  it('shows User Manual content by default', () => {
    const wrapper = mountDialog()
    expect(wrapper.find('.dialog-body').text()).toContain('Overview')
  })

  it('has four tabs for non-referee users', () => {
    const wrapper = mountDialog()
    const tabs = wrapper.findAll('.htab')
    expect(tabs).toHaveLength(4)
    expect(tabs[0].text()).toContain('Getting Started')
    expect(tabs[3].text()).toContain('Shortcuts')
  })

  it('Getting Started tab is active by default', () => {
    const wrapper = mountDialog()
    expect(wrapper.findAll('.htab')[0].classes()).toContain('active')
    expect(wrapper.findAll('.htab')[3].classes()).not.toContain('active')
  })

  it('switching to Shortcuts tab shows the shortcuts table', async () => {
    const wrapper = mountDialog()
    await wrapper.findAll('.htab')[3].trigger('click')
    expect(wrapper.find('.shortcuts-table').exists()).toBe(true)
    expect(wrapper.find('.dialog-body').text()).toContain('Esc')
  })

  it('switching back to Getting Started hides the shortcuts table', async () => {
    const wrapper = mountDialog()
    await wrapper.findAll('.htab')[3].trigger('click')
    await wrapper.findAll('.htab')[0].trigger('click')
    expect(wrapper.find('.shortcuts-table').exists()).toBe(false)
    expect(wrapper.find('.dialog-body').text()).toContain('Overview')
  })

  it('close button emits update:modelValue false', async () => {
    const wrapper = mountDialog()
    await wrapper.find('.close-btn').trigger('click')
    expect(wrapper.emitted()['update:modelValue']).toEqual([[false]])
  })

  it('footer Close button also emits update:modelValue false', async () => {
    const wrapper = mountDialog()
    await wrapper.find('.btn-primary').trigger('click')
    expect(wrapper.emitted()['update:modelValue']).toEqual([[false]])
  })

  it('Escape key emits update:modelValue false', async () => {
    const wrapper = mountDialog()
    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted()['update:modelValue']).toEqual([[false]])
  })

  it('Market Tab section contains the column definitions table', async () => {
    const wrapper = mountDialog()
    await wrapper.findAll('.htab')[2].trigger('click')
    const body = wrapper.find('.dialog-body').text()
    expect(body).toContain('Market Tab')
    expect(body).toContain('Buy (Cr/t)')
    expect(body).toContain('Qty (t)')
    expect(body).toContain('expired')
  })

  it('Imperial Calendar section mentions referee starting year', () => {
    const wrapper = mountDialog()
    const body = wrapper.find('.dialog-body').text()
    expect(body).toContain('Imperial Calendar')
    expect(body).toContain('starting year')
  })
})
