// @vitest-environment happy-dom
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { api } from '../src/lib/api.js'
import { useAuthStore } from '../src/stores/auth.js'
import { useTickStore } from '../src/stores/tick.js'
import * as marketEvents from '../src/lib/market-events.js'

vi.mock('../src/lib/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setUnauthorizedHandler: vi.fn(),
}))

vi.mock('../src/lib/market-events.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, maybeGenerateEvent: vi.fn(actual.maybeGenerateEvent) }
})

const WORLD = { Hex: '0101', UWP: 'B434450-8', Remarks: 'Ag Ni' }
const SECTOR = 'Spinward Marches'

// Backfill/event api.post calls are all distinguished by path suffix; default
// every call to a harmless success so a test only needs to override the one
// endpoint it's exercising.
function mockApiDefaults() {
  api.get.mockImplementation((path) => {
    if (path.endsWith('/snapshots')) return Promise.resolve({ data: { count: 0 }, error: null })
    if (path.endsWith('/snapshots/last-tick')) return Promise.resolve({ data: { lastTick: null }, error: null })
    if (path.endsWith('/events')) return Promise.resolve({ data: [], error: null })
    return Promise.resolve({ data: null, error: null })
  })
  api.post.mockImplementation((path) => {
    if (path.endsWith('/events')) return Promise.resolve({ data: { count: 0 }, error: null })
    return Promise.resolve({ data: {}, error: null })
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mockApiDefaults()
  marketEvents.maybeGenerateEvent.mockReset()
  marketEvents.maybeGenerateEvent.mockReturnValue(null) // no event fires by default

  const auth = useAuthStore()
  auth.campaign = { id: 'c1', trade_rules: 'CT7' }
})

describe('ensureWorldSnapshot backfill error handling', () => {
  it('stops and surfaces an error when the backfill snapshot insert fails, without reaching rollup-repair', async () => {
    const tick = useTickStore()
    tick.currentTick = 2 // backfillStart=0, so t=0,1 get backfilled before tick 2's own row

    api.post.mockImplementation((path) => {
      if (path.endsWith('/events')) return Promise.resolve({ data: { count: 0 }, error: null })
      if (path.endsWith('/snapshots')) return Promise.resolve({ data: null, error: 'D1 write failed' })
      if (path.endsWith('/rollup-repair')) return Promise.resolve({ data: {}, error: null })
      return Promise.resolve({ data: {}, error: null })
    })

    const rows = await tick.ensureWorldSnapshot(WORLD, SECTOR)

    expect(rows).toEqual([])
    expect(tick.error).toBe('D1 write failed')
    // Only the (failed) backfill insert should have been attempted — never
    // reaches rollup-repair or the current-tick's own snapshot insert.
    const rollupCalls = api.post.mock.calls.filter(([path]) => path.endsWith('/rollup-repair'))
    expect(rollupCalls).toHaveLength(0)
    const snapshotCalls = api.post.mock.calls.filter(([path]) => path.endsWith('/snapshots'))
    expect(snapshotCalls).toHaveLength(1)
  })

  it('surfaces an error when the event duplicate-check call fails', async () => {
    const tick = useTickStore()
    tick.currentTick = 0 // no backfill range — isolates the maybeInsertEvent(currentTick) call

    marketEvents.maybeGenerateEvent.mockReturnValue({
      campaign_id: 'c1', tick: 0, scope: 'local', world_hex: WORLD.Hex, sector: SECTOR,
      trade_good_die: null, buy_modifier_pct: 10, sell_modifier_pct: null,
      description: 'Test event', expires_tick: 4, severity: 'minor',
    })
    api.post.mockImplementation((path) => {
      if (path.endsWith('/events')) return Promise.resolve({ data: null, error: 'Network error' })
      return Promise.resolve({ data: {}, error: null })
    })

    const rows = await tick.ensureWorldSnapshot(WORLD, SECTOR)

    expect(rows).toEqual([])
    expect(tick.error).toBe('Network error')
  })

  it('completes normally and caches the snapshot when nothing fails', async () => {
    const tick = useTickStore()
    tick.currentTick = 0

    const rows = await tick.ensureWorldSnapshot(WORLD, SECTOR)

    expect(tick.error).toBeNull()
    expect(rows.length).toBeGreaterThan(0)
    expect(Object.keys(tick.worldSnapshots).length).toBe(rows.length)
  })
})
