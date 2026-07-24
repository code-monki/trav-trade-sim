import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import EventDefinitionDialog from '../../src/components/EventDefinitionDialog.vue'

// Stub Teleport so content renders inline (no actual portal to body needed)
const teleportStub = { template: '<div><slot /></div>' }

function mountDialog(props = {}) {
  return mount(EventDefinitionDialog, {
    props,
    global: {
      plugins: [createTestingPinia({
        initialState: { auth: { campaign: { id: 'c1' } } },
        stubActions: true,
        createSpy: vi.fn,
      })],
      stubs: { Teleport: teleportStub },
    },
  })
}

const EXISTING_DEF = {
  id: 'def1', description: 'Solar flare disrupts comms', scope: 'subsector',
  severity: 'major', buy_modifier_pct: 10, sell_modifier_pct: -5,
  duration_ticks: 6, trade_good_die: '36',
}

describe('EventDefinitionDialog', () => {
  it('shows "New Definition" with a blank form when not editing', () => {
    const wrapper = mountDialog()
    expect(wrapper.find('.dialog-title').text()).toBe('New Definition')
    expect(wrapper.find('input[placeholder="What\'s happening?"]').element.value).toBe('')
  })

  it('pre-fills from the editing definition and shows "Edit Definition"', () => {
    const wrapper = mountDialog({ editing: EXISTING_DEF })
    expect(wrapper.find('.dialog-title').text()).toBe('Edit Definition')
    expect(wrapper.find('input[placeholder="What\'s happening?"]').element.value).toBe('Solar flare disrupts comms')
    expect(wrapper.vm.defForm.scope).toBe('subsector')
    expect(wrapper.vm.defForm.severity).toBe('major')
  })

  it('creating calls referee.createEventDefinition and emits saved + close', async () => {
    const wrapper = mountDialog()
    wrapper.vm.referee.createEventDefinition.mockResolvedValue({ id: 'def1' })

    await wrapper.find('input[placeholder="What\'s happening?"]').setValue('New event')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.referee.createEventDefinition).toHaveBeenCalledWith(
      'c1', expect.objectContaining({ description: 'New event' }),
    )
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('editing calls referee.updateEventDefinition with the editing id', async () => {
    const wrapper = mountDialog({ editing: EXISTING_DEF })
    wrapper.vm.referee.updateEventDefinition.mockResolvedValue({ ...EXISTING_DEF })

    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.referee.updateEventDefinition).toHaveBeenCalledWith(
      'def1', expect.objectContaining({ description: 'Solar flare disrupts comms', scope: 'subsector' }),
    )
  })

  it('shows an error and does not close on failure', async () => {
    const wrapper = mountDialog()
    wrapper.vm.referee.createEventDefinition.mockRejectedValue(
      new Error('A definition with this description already exists'),
    )

    await wrapper.find('input[placeholder="What\'s happening?"]').setValue('Dup')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.form-error').text()).toBe('A definition with this description already exists')
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})
