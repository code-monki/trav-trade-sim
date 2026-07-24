import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import AssignEventDialog from '../../src/components/AssignEventDialog.vue'
import { EVENT_CATALOGUE } from '../../src/lib/event-catalogue.js'

// Stub Teleport so content renders inline (no actual portal to body needed)
const teleportStub = { template: '<div><slot /></div>' }

function mountDialog(props = {}, { tickState = {}, refereeState = {}, mapState = {} } = {}) {
  return mount(AssignEventDialog, {
    props,
    global: {
      plugins: [createTestingPinia({
        initialState: {
          auth: { campaign: { id: 'c1' } },
          tick: { currentTick: 5, activeEvents: [], allEvents: [], ...tickState },
          referee: { eventDefinitions: [], ...refereeState },
          map: { sectors: [], ...mapState },
        },
        stubActions: true,
        createSpy: vi.fn,
      })],
      stubs: { Teleport: teleportStub },
    },
  })
}

describe('AssignEventDialog', () => {
  it('lists built-in presets in the definition picker by default', () => {
    const wrapper = mountDialog()
    const options = wrapper.findAll('select')[0].findAll('option')
    expect(options.map(o => o.text())).toContain(EVENT_CATALOGUE[0].description)
  })

  it('pre-fills the form from a custom initialDefinitionKey', () => {
    const wrapper = mountDialog(
      { initialDefinitionKey: 'custom:def1' },
      {
        refereeState: {
          eventDefinitions: [{
            id: 'def1', description: 'Solar flare disrupts comms', scope: 'subsector',
            severity: 'major', buy_modifier_pct: 10, sell_modifier_pct: -5,
            duration_ticks: 6, trade_good_die: '36',
          }],
        },
      },
    )
    expect(wrapper.vm.newEvent.description).toBe('Solar flare disrupts comms')
    expect(wrapper.vm.newEvent.scope).toBe('subsector')
    expect(wrapper.vm.newEvent.buyModifierPct).toBe(10)
  })

  it('pre-fills the form from a builtin initialDefinitionKey', () => {
    const wrapper = mountDialog({ initialDefinitionKey: 'builtin:0' })
    expect(wrapper.vm.newEvent.description).toBe(EVENT_CATALOGUE[0].description)
    expect(wrapper.vm.newEvent.scope).toBe('local')
  })

  it('loads a sector\'s worlds into the World Hex dropdown', async () => {
    const wrapper = mountDialog({}, {
      mapState: { sectors: [{ name: 'Spinward Marches', abbreviation: '', x: 0, y: 0, tags: '' }] },
    })
    wrapper.vm.map.fetchWorldsForSector.mockResolvedValue([{ Hex: '0101', Name: 'Regina' }])

    const sectorSelect = wrapper.findAll('select')[2] // Definition, Scope, Sector
    await sectorSelect.setValue('Spinward Marches')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.map.fetchWorldsForSector).toHaveBeenCalledWith('Spinward Marches')
    const worldOptions = wrapper.findAll('select')[3].findAll('option')
    expect(worldOptions.map(o => o.text())).toContain('0101 — Regina')
  })

  it('submitting calls referee.createEvent, updates tick lists, and emits assigned + close', async () => {
    const wrapper = mountDialog()
    const created = {
      id: 'ev1', description: 'New event', scope: 'subsector', sector: 'X',
      tick: 5, expires_tick: 9,
    }
    wrapper.vm.referee.createEvent.mockResolvedValue(created)

    await wrapper.find('input[placeholder="What\'s happening?"]').setValue('New event')
    wrapper.vm.newEvent.sector = 'X'
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.referee.createEvent).toHaveBeenCalledWith(
      'c1', expect.objectContaining({ description: 'New event', currentTick: 5 }),
    )
    expect(wrapper.vm.tick.allEvents).toContainEqual(created)
    expect(wrapper.vm.tick.activeEvents).toContainEqual(created)
    expect(wrapper.emitted('assigned')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('shows an error and does not close on failure', async () => {
    const wrapper = mountDialog()
    wrapper.vm.referee.createEvent.mockRejectedValue(new Error('boom'))

    await wrapper.find('input[placeholder="What\'s happening?"]').setValue('X')
    wrapper.vm.newEvent.sector = 'X'
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.form-error').text()).toBe('boom')
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})
