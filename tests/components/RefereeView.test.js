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

function mountReferee(tickState = {}) {
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
            tick: { currentTick: 5, activeEvents: [], ...tickState },
          },
          stubActions: true,
          createSpy: vi.fn,
        }),
        makeRouter(),
      ],
    },
  })
}

describe('RefereeView — Events tab live update', () => {
  it('shows no active events before any are created', async () => {
    const wrapper = mountReferee()
    await wrapper.find('.rtab:nth-of-type(4)').trigger('click') // Events tab
    expect(wrapper.find('.placeholder').text()).toBe('No active events')
  })

  it('adds a newly created event to the Active Events list immediately, without a manual refresh', async () => {
    const wrapper = mountReferee()
    await wrapper.find('.rtab:nth-of-type(4)').trigger('click') // Events tab
    expect(wrapper.findAll('.event-card')).toHaveLength(0)

    wrapper.vm.referee.createEvent.mockResolvedValue({
      id: 'ev1',
      description:       'Pirate raid disrupts supply lines',
      scope:              'local',
      world_hex:          '0101',
      buy_modifier_pct:   30,
      sell_modifier_pct:  null,
      expires_tick:       9,
      severity:           'minor',
    })

    await wrapper.find('.detail-form input[placeholder="What\'s happening?"]').setValue('Pirate raid disrupts supply lines')
    await wrapper.find('.detail-form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.referee.createEvent).toHaveBeenCalledTimes(1)

    const cards = wrapper.findAll('.event-card')
    expect(cards).toHaveLength(1)
    expect(cards[0].text()).toContain('Pirate raid disrupts supply lines')
    expect(wrapper.find('.placeholder').exists()).toBe(false)
    expect(wrapper.find('.form-success').text()).toBe('Event created.')
  })
})
