import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createRouter, createMemoryHistory } from 'vue-router'
import RefereeView from '../../src/views/RefereeView.vue'
import AssignEventDialog from '../../src/components/AssignEventDialog.vue'
import EventDefinitionDialog from '../../src/components/EventDefinitionDialog.vue'
import EventPresetsDialog from '../../src/components/EventPresetsDialog.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/',    name: 'map', component: { template: '<div/>' } },
      { path: '/ref', component: { template: '<div/>' } },
    ],
  })
}

function mountReferee({ tickState = {}, refereeState = {} } = {}) {
  return mount(RefereeView, {
    shallow: true,
    global: {
      plugins: [
        createTestingPinia({
          initialState: {
            auth: {
              campaign: { id: 'c1', label: 'Test Campaign', code: 'ABC123', trade_rules: 'CT7' },
              player:   { role: 'referee' },
            },
            tick: { currentTick: 5, activeEvents: [], allEvents: [], ...tickState },
            referee: { eventDefinitions: [], ...refereeState },
            map: { sectors: [] },
          },
          stubActions: true,
          createSpy: vi.fn,
        }),
        makeRouter(),
      ],
    },
  })
}

async function openEventsTab(wrapper) {
  await wrapper.find('.rtab:nth-of-type(4)').trigger('click') // Events tab
}

describe('RefereeView — Events grid', () => {
  it('shows no events before any are assigned', async () => {
    const wrapper = mountReferee()
    await openEventsTab(wrapper)
    expect(wrapper.find('.placeholder').text()).toBe('No events yet')
  })

  it('renders assigned events with Expire (active) and Delete actions', async () => {
    const wrapper = mountReferee({
      tickState: {
        allEvents: [{
          id: 'ev1', description: 'Trade embargo imposed', scope: 'local',
          sector: 'Spinward Marches', world_hex: '0101', trade_good_die: null,
          buy_modifier_pct: 20, sell_modifier_pct: -20, tick: 1, expires_tick: 9,
          severity: 'minor',
        }],
      },
    })
    await openEventsTab(wrapper)

    const row = wrapper.find('.events-grid tbody tr')
    expect(row.find('.status-active').exists()).toBe(true)
    const buttons = row.findAll('.row-actions button')
    expect(buttons.map(b => b.text())).toEqual(['Expire', 'Delete'])
  })

  it('flips a row to Expired in place, rather than removing it, when expired', async () => {
    const wrapper = mountReferee({
      tickState: {
        allEvents: [{
          id: 'ev1', description: 'Trade embargo imposed', scope: 'local',
          sector: 'Spinward Marches', world_hex: '0101', trade_good_die: null,
          buy_modifier_pct: 20, sell_modifier_pct: -20, tick: 1, expires_tick: 9,
          severity: 'minor',
        }],
      },
    })
    await openEventsTab(wrapper)
    wrapper.vm.referee.expireEvent.mockResolvedValue(undefined)

    await wrapper.find('.row-actions .btn-secondary').trigger('click') // Expire
    await wrapper.vm.$nextTick()

    const rows = wrapper.findAll('.events-grid tbody tr')
    expect(rows).toHaveLength(1)
    expect(rows[0].find('.status-expired').exists()).toBe(true)
    expect(rows[0].findAll('.row-actions button').map(b => b.text())).toEqual(['Delete'])
  })

  it('removes the row entirely when deleted', async () => {
    const wrapper = mountReferee({
      tickState: {
        allEvents: [{
          id: 'ev1', description: 'Trade embargo imposed', scope: 'local',
          sector: 'Spinward Marches', world_hex: '0101', trade_good_die: null,
          buy_modifier_pct: 20, sell_modifier_pct: -20, tick: 1, expires_tick: 9,
          severity: 'minor',
        }],
      },
    })
    await openEventsTab(wrapper)
    wrapper.vm.referee.deleteEvent.mockResolvedValue(undefined)

    await wrapper.find('.row-actions .btn-danger').trigger('click') // Delete
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.referee.deleteEvent).toHaveBeenCalledWith('ev1')
    expect(wrapper.findAll('.events-grid tbody tr')).toHaveLength(0)
    expect(wrapper.find('.placeholder').text()).toBe('No events yet')
  })

  it('narrows the grid with the Sector and World filters', async () => {
    const wrapper = mountReferee({
      tickState: {
        allEvents: [
          { id: 'ev1', description: 'Event A', scope: 'local', sector: 'Spinward Marches', world_hex: '0101', tick: 1, expires_tick: null, severity: 'minor' },
          { id: 'ev2', description: 'Event B', scope: 'local', sector: 'Deneb',            world_hex: '0202', tick: 2, expires_tick: null, severity: 'minor' },
        ],
      },
    })
    await openEventsTab(wrapper)
    expect(wrapper.findAll('.events-grid tbody tr')).toHaveLength(2)

    const sectorSelect = wrapper.findAll('.grid-filters select')[0]
    await sectorSelect.setValue('Deneb')

    const rows = wrapper.findAll('.events-grid tbody tr')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('Event B')
  })
})

describe('RefereeView — dialog wiring', () => {
  it('"+ Assign Event" opens AssignEventDialog with no initial definition', async () => {
    const wrapper = mountReferee()
    await openEventsTab(wrapper)
    expect(wrapper.findComponent(AssignEventDialog).exists()).toBe(false)

    await wrapper.findAll('.events-actions')[0].find('.btn-primary').trigger('click')

    const dialog = wrapper.findComponent(AssignEventDialog)
    expect(dialog.exists()).toBe(true)
    expect(dialog.props('initialDefinitionKey')).toBe('')
  })

  it('closes AssignEventDialog on its close event', async () => {
    const wrapper = mountReferee()
    await openEventsTab(wrapper)
    await wrapper.findAll('.events-actions')[0].find('.btn-primary').trigger('click')

    await wrapper.findComponent(AssignEventDialog).vm.$emit('close')
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent(AssignEventDialog).exists()).toBe(false)
  })

  it('a definition row\'s Assign button opens AssignEventDialog pre-filled with that definition', async () => {
    const wrapper = mountReferee({
      refereeState: {
        eventDefinitions: [{
          id: 'def1', description: 'Solar flare disrupts comms', scope: 'local',
          severity: 'minor', buy_modifier_pct: 10, sell_modifier_pct: null,
          duration_ticks: 4, trade_good_die: null,
        }],
      },
    })
    await openEventsTab(wrapper)

    await wrapper.find('.event-card .event-card-actions .btn-secondary').trigger('click') // Assign

    const dialog = wrapper.findComponent(AssignEventDialog)
    expect(dialog.exists()).toBe(true)
    expect(dialog.props('initialDefinitionKey')).toBe('custom:def1')
  })

  it('"+ New Definition" opens EventDefinitionDialog with no editing target', async () => {
    const wrapper = mountReferee()
    await openEventsTab(wrapper)

    await wrapper.findAll('.events-actions')[1].find('.btn-primary').trigger('click')

    const dialog = wrapper.findComponent(EventDefinitionDialog)
    expect(dialog.exists()).toBe(true)
    expect(dialog.props('editing')).toBeNull()
  })

  it('a definition row\'s Edit button opens EventDefinitionDialog with that definition', async () => {
    const def = {
      id: 'def1', description: 'Solar flare disrupts comms', scope: 'local',
      severity: 'minor', buy_modifier_pct: 10, sell_modifier_pct: null,
      duration_ticks: 4, trade_good_die: null,
    }
    const wrapper = mountReferee({ refereeState: { eventDefinitions: [def] } })
    await openEventsTab(wrapper)

    const buttons = wrapper.findAll('.event-card .event-card-actions button')
    await buttons[1].trigger('click') // Edit

    const dialog = wrapper.findComponent(EventDefinitionDialog)
    expect(dialog.exists()).toBe(true)
    expect(dialog.props('editing')).toEqual(def)
  })

  it('a definition row\'s Delete button calls referee.deleteEventDefinition', async () => {
    const wrapper = mountReferee({
      refereeState: {
        eventDefinitions: [{
          id: 'def1', description: 'Solar flare disrupts comms', scope: 'local',
          severity: 'minor', buy_modifier_pct: 10, sell_modifier_pct: null,
          duration_ticks: 4, trade_good_die: null,
        }],
      },
    })
    await openEventsTab(wrapper)
    wrapper.vm.referee.deleteEventDefinition.mockResolvedValue(undefined)

    const buttons = wrapper.findAll('.event-card .event-card-actions button')
    await buttons[2].trigger('click') // Delete

    expect(wrapper.vm.referee.deleteEventDefinition).toHaveBeenCalledWith('def1')
  })

  it('"View Built-in Presets" opens EventPresetsDialog', async () => {
    const wrapper = mountReferee()
    await openEventsTab(wrapper)
    expect(wrapper.findComponent(EventPresetsDialog).exists()).toBe(false)

    await wrapper.findAll('.events-actions')[0].find('.btn-secondary').trigger('click')

    expect(wrapper.findComponent(EventPresetsDialog).exists()).toBe(true)
  })
})
