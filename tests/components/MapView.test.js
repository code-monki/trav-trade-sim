import { describe, it, expect, vi, afterEach } from 'vitest'
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

function mountMap(mapState = {}, shipState = {}, { authState = {}, stubs = {} } = {}) {
  return mount(MapView, {
    shallow: true,
    global: {
      stubs,
      plugins: [
        createTestingPinia({
          initialState: {
            auth: {
              campaign: { label: 'Test Campaign', trade_rules: 'CT7' },
              player: {},
              ...authState,
            },
            tick: { currentTick: 1 },
            map: {
              sectors: [], worlds: [], selectedWorld: null,
              usingCachedData: false, cachedAt: null, error: null,
              ...mapState,
            },
            ship: {
              passengers: [], mailContracts: [], freight: [],
              ...shipState,
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

describe('MapView — pending delivery indicator', () => {
  const WORLD  = { Hex: '0101', UWP: 'A788899-C', Name: 'Testworld' }
  const SECTOR = 'Spinward Marches'

  it('is hidden when nothing is pending for the selected world', () => {
    const wrapper = mountMap({ selectedWorld: WORLD, selectedSectorName: SECTOR })
    expect(wrapper.find('.delivery-badge').exists()).toBe(false)
  })

  it('is hidden when a pending obligation targets a different world', () => {
    const wrapper = mountMap(
      { selectedWorld: WORLD, selectedSectorName: SECTOR },
      { mailContracts: [{ id: 'm1', dest_world_hex: '0202', dest_sector: SECTOR }] }
    )
    expect(wrapper.find('.delivery-badge').exists()).toBe(false)
  })

  it('shows a singular count for one pending obligation at the selected world', () => {
    const wrapper = mountMap(
      { selectedWorld: WORLD, selectedSectorName: SECTOR },
      { mailContracts: [{ id: 'm1', dest_world_hex: '0101', dest_sector: SECTOR }] }
    )
    const badge = wrapper.find('.delivery-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('1 pending delivery here')
  })

  it('sums pending obligations across passengers, mail, and freight, with plural wording', () => {
    const wrapper = mountMap(
      { selectedWorld: WORLD, selectedSectorName: SECTOR },
      {
        passengers:    [{ id: 'p1', dest_world_hex: '0101', dest_sector: SECTOR }],
        mailContracts: [{ id: 'm1', dest_world_hex: '0101', dest_sector: SECTOR }],
        freight:       [{ id: 'f1', dest_world_hex: '0101', dest_sector: SECTOR }],
      }
    )
    const badge = wrapper.find('.delivery-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('3 pending deliveries here')
  })
})

describe('MapView — decluttered header (mobile)', () => {
  // Renders the mobile-extras slot so the menu-carried controls are testable
  // even under shallow mounting.
  const menuStub = {
    HamburgerMenu: { template: '<div class="hm-stub"><slot name="mobile-extras" /></div>' },
  }

  it('renders the full title plus a short variant for narrow screens', () => {
    const wrapper = mountMap()
    expect(wrapper.find('.app-title .title-full').text()).toBe('Traveller Trade Simulator')
    expect(wrapper.find('.app-title .title-short').text()).toBe('TTS')
  })

  it('splits the tick readout so the trade-rules tag can drop on narrow screens', () => {
    const wrapper = mountMap()
    expect(wrapper.find('.date-sub').text()).toContain('Tick 1')
    expect(wrapper.find('.date-rules').text()).toContain('CT7')
  })

  it('gives referees both wide and narrow advance-button labels', () => {
    const wrapper = mountMap({}, {}, { authState: { player: { role: 'referee' } } })
    const btn = wrapper.find('.advance-btn')
    expect(btn.exists()).toBe(true)
    expect(btn.find('.advance-full').text()).toBe('Advance Tick ›')
    expect(btn.find('.advance-short').text()).toBe('Advance ›')
  })

  it('keeps the milieu select in the header and mirrors it into the menu', () => {
    const wrapper = mountMap({}, {}, { stubs: menuStub })
    expect(wrapper.find('#milieu-select').exists()).toBe(true)
    expect(wrapper.find('.hm-stub #milieu-select-mobile').exists()).toBe(true)
  })

  it('hands the session readout to the menu', () => {
    const wrapper = mountMap({}, {}, {
      stubs: menuStub,
      authState: {
        player: { character_name: 'Zho Baraki', role: 'referee' },
        campaign: { label: 'Test Campaign', trade_rules: 'CT7', code: 'ABC123' },
      },
    })
    const session = wrapper.find('.hm-stub .hm-session')
    expect(session.exists()).toBe(true)
    expect(session.text()).toContain('Zho Baraki')
    expect(session.text()).toContain('ABC123')
    expect(session.find('.hm-role-badge').exists()).toBe(true)
  })
})

describe('MapView — dialog mutual exclusion', () => {
  it('opening one dialog closes any other that was open', () => {
    const wrapper = mountMap()

    wrapper.vm.showThemes = true
    expect(wrapper.vm.showThemes).toBe(true)
    expect(wrapper.vm.showAbout).toBe(false)

    wrapper.vm.showAbout = true
    expect(wrapper.vm.showAbout).toBe(true)
    expect(wrapper.vm.showThemes).toBe(false)
  })

  it('setting a dialog to false clears the shared active-dialog state', () => {
    const wrapper = mountMap()

    wrapper.vm.showHelp = true
    expect(wrapper.vm.showHelp).toBe(true)

    wrapper.vm.showHelp = false
    expect(wrapper.vm.showHelp).toBe(false)
    expect(wrapper.vm.showThemes).toBe(false)
    expect(wrapper.vm.showAbout).toBe(false)
    expect(wrapper.vm.showTutorials).toBe(false)
    expect(wrapper.vm.showCharacter).toBe(false)
    expect(wrapper.vm.showBuyDialog).toBe(false)
  })
})

describe('MapView — collapsible sidebar (mobile)', () => {
  const realMatchMedia = window.matchMedia

  afterEach(() => { window.matchMedia = realMatchMedia })

  function setViewport({ narrow }) {
    window.matchMedia = vi.fn().mockReturnValue({ matches: narrow })
  }

  it('starts expanded on wide viewports', () => {
    setViewport({ narrow: false })
    const wrapper = mountMap()
    expect(wrapper.find('.sidebar').classes()).not.toContain('collapsed')
    expect(wrapper.find('.sidebar-toggle').attributes('aria-expanded')).toBe('true')
  })

  it('starts collapsed on narrow viewports', () => {
    setViewport({ narrow: true })
    const wrapper = mountMap()
    expect(wrapper.find('.sidebar').classes()).toContain('collapsed')
    expect(wrapper.find('.sidebar-toggle').attributes('aria-expanded')).toBe('false')
  })

  it('toggle button expands and re-collapses the sidebar', async () => {
    setViewport({ narrow: true })
    const wrapper = mountMap()

    await wrapper.find('.sidebar-toggle').trigger('click')
    expect(wrapper.find('.sidebar').classes()).not.toContain('collapsed')
    expect(wrapper.find('.sidebar-toggle').attributes('aria-expanded')).toBe('true')

    await wrapper.find('.sidebar-toggle').trigger('click')
    expect(wrapper.find('.sidebar').classes()).toContain('collapsed')
  })

  it('selecting a world on a narrow viewport collapses the sidebar', async () => {
    setViewport({ narrow: true })
    const wrapper = mountMap({
      selectedSectorName: 'Spinward Marches',
      worlds: [{ Hex: '0101', Name: 'Testworld' }],
    })

    await wrapper.find('.sidebar-toggle').trigger('click')
    await wrapper.find('.world-list li').trigger('click')
    expect(wrapper.find('.sidebar').classes()).toContain('collapsed')
  })

  it('selecting a world on a wide viewport leaves the sidebar expanded', async () => {
    setViewport({ narrow: false })
    const wrapper = mountMap({
      selectedSectorName: 'Spinward Marches',
      worlds: [{ Hex: '0101', Name: 'Testworld' }],
    })

    await wrapper.find('.world-list li').trigger('click')
    expect(wrapper.find('.sidebar').classes()).not.toContain('collapsed')
  })
})
