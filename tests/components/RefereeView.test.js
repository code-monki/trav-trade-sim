import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createRouter, createMemoryHistory } from 'vue-router'
import RefereeView from '../../src/views/RefereeView.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/',    name: 'map', component: { template: '<div/>' } },
      { path: '/ref', component: { template: '<div/>' } },
    ],
  })
}

function mountReferee({ tickState = {}, refereeState = {}, mapState = {} } = {}) {
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
            map: { sectors: [], ...mapState },
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

  it('adds a newly assigned event to the grid immediately, without a manual refresh', async () => {
    const wrapper = mountReferee()
    await openEventsTab(wrapper)
    expect(wrapper.findAll('.events-grid tbody tr')).toHaveLength(0)

    wrapper.vm.referee.createEvent.mockResolvedValue({
      id: 'ev1',
      description:       'Pirate raid disrupts supply lines',
      scope:              'local',
      sector:             'Spinward Marches',
      world_hex:          '0101',
      trade_good_die:     null,
      buy_modifier_pct:   30,
      sell_modifier_pct:  null,
      tick:               5,
      expires_tick:       9,
      severity:           'minor',
    })

    const assignForm = wrapper.findAll('.events-col')[1]
    await assignForm.find('input[placeholder="What\'s happening?"]').setValue('Pirate raid disrupts supply lines')
    await assignForm.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.referee.createEvent).toHaveBeenCalledTimes(1)

    const rows = wrapper.findAll('.events-grid tbody tr')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('Pirate raid disrupts supply lines')
    expect(rows[0].find('.status-active').exists()).toBe(true)
    expect(wrapper.findAll('.events-col')[0].find('.placeholder').exists()).toBe(false)
    expect(assignForm.find('.form-success').text()).toBe('Event assigned.')
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

    let rows = wrapper.findAll('.events-grid tbody tr')
    expect(rows[0].find('.status-active').exists()).toBe(true)

    await rows[0].find('.btn-danger').trigger('click')
    await wrapper.vm.$nextTick()

    rows = wrapper.findAll('.events-grid tbody tr')
    expect(rows).toHaveLength(1)
    expect(rows[0].find('.status-expired').exists()).toBe(true)
    expect(rows[0].find('.btn-danger').exists()).toBe(false)
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

describe('RefereeView — Assign Event to World', () => {
  it('fills the form from a built-in definition', async () => {
    const wrapper = mountReferee()
    await openEventsTab(wrapper)
    const assignForm = wrapper.findAll('.events-col')[1]

    const defSelect = assignForm.find('select')
    const builtinOption = defSelect.findAll('option').find(o => o.text() === 'Pirate raid disrupts supply lines')
    await defSelect.setValue(builtinOption.element.value)

    expect(wrapper.vm.newEvent.description).toBe('Pirate raid disrupts supply lines')
    expect(wrapper.vm.newEvent.buyModifierPct).toBe(30)
    expect(wrapper.vm.newEvent.scope).toBe('local')
  })

  it('loads that sector\'s worlds into the World dropdown when a sector is picked', async () => {
    const wrapper = mountReferee({ mapState: { sectors: [{ name: 'Spinward Marches', abbreviation: '', x: 0, y: 0, tags: '' }] } })
    await openEventsTab(wrapper)

    wrapper.vm.map.fetchWorldsForSector.mockResolvedValue([
      { Hex: '0101', Name: 'Regina' },
      { Hex: '0202', Name: 'Efate' },
    ])

    const assignForm = wrapper.findAll('.events-col')[1]
    const sectorSelect = assignForm.findAll('select')[2] // Definition, Scope, Sector, [World]
    await sectorSelect.setValue('Spinward Marches')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.map.fetchWorldsForSector).toHaveBeenCalledWith('Spinward Marches')
    const worldOptions = assignForm.findAll('select')[3].findAll('option')
    expect(worldOptions.map(o => o.text())).toContain('0101 — Regina')
  })
})

describe('RefereeView — Manage Event Definitions', () => {
  it('creates a custom definition and shows it in the list', async () => {
    const wrapper = mountReferee()
    await openEventsTab(wrapper)
    const manageForm = wrapper.findAll('.events-col')[2]

    wrapper.vm.referee.createEventDefinition.mockResolvedValue({
      id: 'def1', description: 'Solar flare disrupts comms', scope: 'local',
      severity: 'minor', buy_modifier_pct: 10, sell_modifier_pct: null,
      duration_ticks: 4, trade_good_die: null,
    })

    await manageForm.find('input[placeholder="What\'s happening?"]').setValue('Solar flare disrupts comms')
    await manageForm.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.referee.createEventDefinition).toHaveBeenCalledTimes(1)
    expect(manageForm.find('.form-success').text()).toBe('Definition saved.')
  })

  it('deletes a custom definition', async () => {
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

    const manageForm = wrapper.findAll('.events-col')[2]
    await manageForm.find('.event-card .btn-danger').trigger('click')

    expect(wrapper.vm.referee.deleteEventDefinition).toHaveBeenCalledWith('def1')
  })
})
