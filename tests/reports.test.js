import { describe, it, expect } from 'vitest'
import { aggregateByType, yearToTickRange } from '../src/lib/reports.js'

// ── aggregateByType ───────────────────────────────────────────────────────────

describe('aggregateByType', () => {
  it('returns empty object for no rows', () => {
    expect(aggregateByType([])).toEqual({})
  })

  it('sums total_cr by type', () => {
    const rows = [
      { type: 'sell', total_cr:  50000 },
      { type: 'sell', total_cr:  30000 },
      { type: 'buy',  total_cr: -20000 },
    ]
    expect(aggregateByType(rows)).toEqual({ sell: 80000, buy: -20000 })
  })

  it('handles all transaction types', () => {
    const rows = [
      { type: 'sell',             total_cr:  10000 },
      { type: 'buy',              total_cr: -8000  },
      { type: 'fuel',             total_cr: -500   },
      { type: 'passenger_fare',   total_cr:  8000  },
      { type: 'passenger_refund', total_cr: -8000  },
      { type: 'mail',             total_cr:  25000 },
      { type: 'fee',              total_cr: -100   },
      { type: 'event',            total_cr:  200   },
    ]
    const result = aggregateByType(rows)
    expect(result.sell).toBe(10000)
    expect(result.buy).toBe(-8000)
    expect(result.fuel).toBe(-500)
    expect(result.passenger_fare).toBe(8000)
    expect(result.passenger_refund).toBe(-8000)
    expect(result.mail).toBe(25000)
    expect(result.fee).toBe(-100)
    expect(result.event).toBe(200)
  })

  it('accumulates multiple rows of the same type', () => {
    const rows = [
      { type: 'sell', total_cr: 10000 },
      { type: 'sell', total_cr: 5000  },
      { type: 'sell', total_cr: 3000  },
    ]
    expect(aggregateByType(rows)).toEqual({ sell: 18000 })
  })

  it('treats missing total_cr as 0', () => {
    const rows = [
      { type: 'sell', total_cr: 5000 },
      { type: 'buy'  },
    ]
    const result = aggregateByType(rows)
    expect(result.sell).toBe(5000)
    expect(result.buy).toBe(0)
  })
})

// ── yearToTickRange ───────────────────────────────────────────────────────────

describe('yearToTickRange', () => {
  it('base year 1105 single year: ticks 0–47', () => {
    expect(yearToTickRange(1105, 1105)).toEqual({ gte: 0, lt: 48 })
  })

  it('year 1106 single year: ticks 48–95', () => {
    expect(yearToTickRange(1106, 1106)).toEqual({ gte: 48, lt: 96 })
  })

  it('two-year span 1105–1106: ticks 0–95', () => {
    expect(yearToTickRange(1105, 1106)).toEqual({ gte: 0, lt: 96 })
  })

  it('three-year span 1106–1108', () => {
    expect(yearToTickRange(1106, 1108)).toEqual({ gte: 48, lt: 192 })
  })

  it('lt is exclusive upper bound', () => {
    const { gte, lt } = yearToTickRange(1105, 1105)
    expect(lt - gte).toBe(48)
  })
})
