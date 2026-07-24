import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EventPresetsDialog from '../../src/components/EventPresetsDialog.vue'
import { EVENT_CATALOGUE } from '../../src/lib/event-catalogue.js'

// Stub Teleport so content renders inline (no actual portal to body needed)
const teleportStub = { template: '<div><slot /></div>' }

function mountDialog() {
  return mount(EventPresetsDialog, {
    global: { stubs: { Teleport: teleportStub } },
  })
}

describe('EventPresetsDialog', () => {
  it('renders every built-in preset', () => {
    const wrapper = mountDialog()
    expect(wrapper.findAll('.cat-entry')).toHaveLength(EVENT_CATALOGUE.length)
    expect(wrapper.text()).toContain('Pirate raid disrupts supply lines')
  })

  it('shows buy/sell modifier badges for a preset that has them', () => {
    const wrapper = mountDialog()
    const entry = wrapper.findAll('.cat-entry').find(e => e.text().includes('Trade embargo imposed'))
    expect(entry.text()).toContain('Buy +20%')
    expect(entry.text()).toContain('Sell -20%')
  })

  it('emits close when the close button is clicked', async () => {
    const wrapper = mountDialog()
    await wrapper.find('.close-btn').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
