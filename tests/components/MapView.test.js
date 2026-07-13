import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createRouter, createMemoryHistory } from 'vue-router'
import MapView from '../../src/views/MapView.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div/>' } }],
  })
}

function mountMap(mapState = {}) {
  return mount(MapView, {
    shallow: true,
    global: {
      plugins: [
        createTestingPinia({
          initialState: {
            auth: { campaign: { label: 'Test Campaign', trade_rules: 'CT7' }, player: {} },
            tick: { currentTick: 1 },
            map: {
              sectors: [], worlds: [], selectedWorld: null,
              usingCachedData: false, cachedAt: null, error: null,
              ...mapState,
            },
          },
          stubActions: true,
          createSpy: vi.fn,
        }),
        makeRouter(),
      ],
    },
  })
}

describe('MapView — Traveller Map cache notice', () => {
  it('is hidden when not serving cached data', () => {
    const wrapper = mountMap({ usingCachedData: false })
    expect(wrapper.find('.cache-notice').exists()).toBe(false)
  })

  it('shows a notice with the cached timestamp when serving cached data', () => {
    const cachedAt = Date.now()
    const wrapper = mountMap({ usingCachedData: true, cachedAt })
    const notice = wrapper.find('.cache-notice')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toContain("couldn't reach travellermap.com")
  })

  it('does not warn about staleness for a recently cached copy', () => {
    const wrapper = mountMap({ usingCachedData: true, cachedAt: Date.now() })
    expect(wrapper.find('.cache-notice').text()).not.toContain('missing recent additions')
  })

  it('warns that recent additions may be missing for a stale (30+ day old) cached copy', () => {
    const cachedAt = Date.now() - 31 * 24 * 60 * 60 * 1000
    const wrapper = mountMap({ usingCachedData: true, cachedAt })
    expect(wrapper.find('.cache-notice').text()).toContain('missing recent additions')
  })

  it('dismisses the notice when the close button is clicked', async () => {
    const wrapper = mountMap({ usingCachedData: true, cachedAt: Date.now() })
    expect(wrapper.find('.cache-notice').exists()).toBe(true)

    await wrapper.find('.cache-notice button').trigger('click')
    expect(wrapper.find('.cache-notice').exists()).toBe(false)
  })
})
