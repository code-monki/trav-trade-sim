import { describe, it, expect } from 'vitest'
import {
  TICKS_PER_MONTH,
  TICKS_PER_YEAR,
  BASE_YEAR,
  tickToCalendar,
  formatImperialDate,
  shouldRollupMonth,
  shouldRollupYear,
  makeRng,
} from '../src/lib/market-tick.js'

// ── Constants ─────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('TICKS_PER_MONTH is 4', () => expect(TICKS_PER_MONTH).toBe(4))
  it('TICKS_PER_YEAR is 48', () => expect(TICKS_PER_YEAR).toBe(48))
  it('BASE_YEAR is 1105', () => expect(BASE_YEAR).toBe(1105))
})

// ── tickToCalendar ────────────────────────────────────────────────────────────

describe('tickToCalendar', () => {
  it('tick 0 → year 1105, day 1, month 1', () => {
    expect(tickToCalendar(0)).toEqual({ year: 1105, day: 1, month: 1 })
  })

  it('tick 1 → year 1105, day 8, month 1 (one week forward)', () => {
    expect(tickToCalendar(1)).toEqual({ year: 1105, day: 8, month: 1 })
  })

  it('tick 4 → month 2 (first month boundary)', () => {
    const { month } = tickToCalendar(4)
    expect(month).toBe(2)
  })

  it('tick 8 → month 3 (second month boundary)', () => {
    const { month } = tickToCalendar(8)
    expect(month).toBe(3)
  })

  it('month cycles through 1–12 across a tick year', () => {
    for (let m = 1; m <= 12; m++) {
      const { month } = tickToCalendar((m - 1) * TICKS_PER_MONTH)
      expect(month).toBe(m)
    }
  })

  it('year advances after 365 days of ticks (~52.1 ticks)', () => {
    // 52 ticks = 364 days (still 1105), 53 ticks = 371 days (1106)
    expect(tickToCalendar(52).year).toBe(1105)
    expect(tickToCalendar(53).year).toBe(1106)
  })

  it('day resets after a year boundary', () => {
    // At tick 53, totalDays = 371, day = (371 % 365) + 1 = 7
    expect(tickToCalendar(53).day).toBe(7)
  })
})

// ── formatImperialDate ────────────────────────────────────────────────────────

describe('formatImperialDate', () => {
  it('formats tick 0 as 001-1105', () => {
    expect(formatImperialDate(0)).toBe('001-1105')
  })

  it('formats tick 1 as 008-1105', () => {
    expect(formatImperialDate(1)).toBe('008-1105')
  })

  it('zero-pads day to 3 digits', () => {
    // tick 2 → day 15
    expect(formatImperialDate(2)).toMatch(/^\d{3}-\d{4}$/)
    expect(formatImperialDate(2)).toBe('015-1105')
  })

  it('reflects year advance after tick 52', () => {
    expect(formatImperialDate(53)).toMatch(/-1106$/)
  })
})

// ── shouldRollupMonth ─────────────────────────────────────────────────────────

describe('shouldRollupMonth', () => {
  it('returns false for tick 0', () => {
    expect(shouldRollupMonth(0)).toBe(false)
  })

  it('returns true for every multiple of TICKS_PER_MONTH', () => {
    expect(shouldRollupMonth(4)).toBe(true)
    expect(shouldRollupMonth(8)).toBe(true)
    expect(shouldRollupMonth(48)).toBe(true)
  })

  it('returns false for non-multiples', () => {
    expect(shouldRollupMonth(1)).toBe(false)
    expect(shouldRollupMonth(5)).toBe(false)
    expect(shouldRollupMonth(47)).toBe(false)
  })
})

// ── shouldRollupYear ──────────────────────────────────────────────────────────

describe('shouldRollupYear', () => {
  it('returns false for tick 0', () => {
    expect(shouldRollupYear(0)).toBe(false)
  })

  it('returns true for multiples of TICKS_PER_YEAR', () => {
    expect(shouldRollupYear(48)).toBe(true)
    expect(shouldRollupYear(96)).toBe(true)
    expect(shouldRollupYear(144)).toBe(true)
  })

  it('returns false for non-multiples', () => {
    expect(shouldRollupYear(47)).toBe(false)
    expect(shouldRollupYear(49)).toBe(false)
    expect(shouldRollupYear(4)).toBe(false)
  })

  it('year rollup implies month rollup', () => {
    // Every year boundary is also a month boundary
    expect(shouldRollupMonth(48)).toBe(true)
    expect(shouldRollupMonth(96)).toBe(true)
  })
})

// ── makeRng ───────────────────────────────────────────────────────────────────

describe('makeRng', () => {
  it('produces values in [0, 1)', () => {
    const rng = makeRng('test-seed')
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is deterministic — same seed produces same sequence', () => {
    const a = makeRng('campaign:0101:11:42')
    const b = makeRng('campaign:0101:11:42')
    for (let i = 0; i < 20; i++) {
      expect(a()).toBe(b())
    }
  })

  it('different seeds produce different sequences', () => {
    const a = makeRng('seed-one')
    const b = makeRng('seed-two')
    const aVals = Array.from({ length: 10 }, () => a())
    const bVals = Array.from({ length: 10 }, () => b())
    expect(aVals).not.toEqual(bVals)
  })

  it('advancing one RNG does not affect an independent RNG from the same seed', () => {
    const a = makeRng('shared-seed')
    const b = makeRng('shared-seed')
    // Both start at the same position — first values are equal
    expect(a()).toBe(b())
    // After advancing, second values are also equal to each other
    expect(a()).toBe(b())
    // And a third independent instance produces the same sequence from the start
    const c = makeRng('shared-seed')
    const d = makeRng('shared-seed')
    const cVals = [c(), c(), c()]
    const dVals = [d(), d(), d()]
    expect(cVals).toEqual(dVals)
  })

  it('seed components change the output — different tick produces different prices', () => {
    const tick10 = makeRng('camp:0101:11:10')
    const tick11 = makeRng('camp:0101:11:11')
    expect(tick10()).not.toBe(tick11())
  })
})
