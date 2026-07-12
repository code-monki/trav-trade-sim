import { describe, it, expect } from 'vitest'
import { activeEventsForWorld } from '../src/lib/market-events.js'

// ── activeEventsForWorld ────────────────────────────────────────────────────────

describe('activeEventsForWorld — local scope', () => {
  const localEvent = {
    tick: 10, world_hex: '1010', sector: 'Spinward Marches',
    scope: 'local', expires_tick: 15,
  }

  it('is active between its start tick and expiry', () => {
    expect(activeEventsForWorld([localEvent], '1010', 10, 'Spinward Marches')).toEqual([localEvent])
    expect(activeEventsForWorld([localEvent], '1010', 14, 'Spinward Marches')).toEqual([localEvent])
  })

  it('is not active before its start tick — future event guard', () => {
    expect(activeEventsForWorld([localEvent], '1010', 9, 'Spinward Marches')).toEqual([])
  })

  it('is not active at or after its expiry tick', () => {
    expect(activeEventsForWorld([localEvent], '1010', 15, 'Spinward Marches')).toEqual([])
  })

  it('does not apply to a different world', () => {
    expect(activeEventsForWorld([localEvent], '1011', 10, 'Spinward Marches')).toEqual([])
  })

  it('an event with expires_tick null never expires', () => {
    const permanent = { ...localEvent, expires_tick: null }
    expect(activeEventsForWorld([permanent], '1010', 9999, 'Spinward Marches')).toEqual([permanent])
  })
})

describe('activeEventsForWorld — subsector scope', () => {
  const subsectorEvent = {
    tick: 10, world_hex: null, sector: 'Spinward Marches',
    scope: 'subsector', expires_tick: 20,
  }

  it('applies to any world in the matching sector', () => {
    expect(activeEventsForWorld([subsectorEvent], '1010', 12, 'Spinward Marches')).toEqual([subsectorEvent])
    expect(activeEventsForWorld([subsectorEvent], '1099', 12, 'Spinward Marches')).toEqual([subsectorEvent])
  })

  it('does not apply to a different sector', () => {
    expect(activeEventsForWorld([subsectorEvent], '1010', 12, 'Deneb')).toEqual([])
  })

  it('still respects the future-tick guard', () => {
    expect(activeEventsForWorld([subsectorEvent], '1010', 9, 'Spinward Marches')).toEqual([])
  })
})

describe('activeEventsForWorld — backfill replay ordering', () => {
  it('an event generated mid-backfill is active for later ticks in the same pass', () => {
    const pool = [{ tick: 5, world_hex: '1010', sector: 'Spinward Marches', scope: 'local', expires_tick: 8 }]
    expect(activeEventsForWorld(pool, '1010', 5, 'Spinward Marches')).toHaveLength(1)
    expect(activeEventsForWorld(pool, '1010', 7, 'Spinward Marches')).toHaveLength(1)
    expect(activeEventsForWorld(pool, '1010', 8, 'Spinward Marches')).toHaveLength(0)
  })

  it('filters a mixed pool to only what is active at the given tick', () => {
    const pool = [
      { tick: 0,  world_hex: '1010', sector: 'Spinward Marches', scope: 'local', expires_tick: 3 },
      { tick: 5,  world_hex: '1010', sector: 'Spinward Marches', scope: 'local', expires_tick: 9 },
      { tick: 12, world_hex: '1010', sector: 'Spinward Marches', scope: 'local', expires_tick: 14 },
    ]
    expect(activeEventsForWorld(pool, '1010', 6, 'Spinward Marches')).toEqual([pool[1]])
  })
})
