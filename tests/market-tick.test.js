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
  generateWorldSnapshot,
  mgt2022PlayerGoodPrice,
  ct7PlayerSalePrice,
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

  it('year advances after 48 ticks (TICKS_PER_YEAR)', () => {
    // 1 year = 48 ticks (12 months × 4 ticks/month)
    expect(tickToCalendar(47).year).toBe(1105)
    expect(tickToCalendar(48).year).toBe(1106)
  })

  it('day resets after a year boundary', () => {
    // At tick 48 weekInYear = 0, so day = 0*7+1 = 1
    expect(tickToCalendar(48).day).toBe(1)
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

// ── generateWorldSnapshot dispatch ─────────────────────────────────────────────

const testWorld = { Hex: '0101', UWP: 'A788899-C', Remarks: 'Ag Ri' }

describe('generateWorldSnapshot dispatch', () => {
  it('defaults to CT7 when tradeRules is omitted', () => {
    const rows = generateWorldSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 1 })
    expect(rows).toHaveLength(36)
    expect(rows[0].trade_good_name).toBe('Textiles') // CT2_TRADE_GOODS[0]
  })

  it('MgT2022 uses its own goods table, not CT2', () => {
    const rows = generateWorldSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 1, tradeRules: 'MgT2022' })
    expect(rows.some(r => r.trade_good_name === 'Common Electronics')).toBe(true) // MGT2022_TRADE_GOODS[0]
    // 'Liquor' (CT2 die 13) has no MgT2022 equivalent — confirms the CT2
    // table isn't being used under the hood.
    expect(rows.every(r => r.trade_good_name !== 'Liquor')).toBe(true)
  })

  it('MgT2022 composition never exceeds all 35 priced goods and excludes Exotics (66)', () => {
    const rows = generateWorldSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 1, tradeRules: 'MgT2022' })
    expect(rows.length).toBeLessThanOrEqual(35)
    expect(rows.every(r => r.trade_good_name !== 'Exotics')).toBe(true)
  })

  it('MgT2022 composition always includes all 6 Common Goods regardless of trade codes', () => {
    const noCodesWorld = { Hex: '0202', UWP: 'A788899-C', Remarks: '' }
    const rows = generateWorldSnapshot({ world: noCodesWorld, sectorName: 'Test', campaignId: 'c1', tick: 1, tradeRules: 'MgT2022' })
    const commonNames = ['Common Electronics', 'Common Industrial Goods', 'Common Manufactured Goods',
                          'Common Raw Materials', 'Common Consumables', 'Common Ore']
    for (const name of commonNames) {
      expect(rows.some(r => r.trade_good_name === name)).toBe(true)
    }
  })

  it('MgT2022 composition includes Trade Goods matching the world\'s trade codes', () => {
    // testWorld has Remarks 'Ag Ri' — Biochemicals' availability includes 'Ag'
    const rows = generateWorldSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 1, tradeRules: 'MgT2022' })
    expect(rows.some(r => r.trade_good_name === 'Biochemicals')).toBe(true)
  })

  it('MgT2022 composition on Population 0 with no matching trade codes is just the 6 Common Goods', () => {
    const emptyWorld = { Hex: '0303', UWP: 'A788000-C', Remarks: '' } // pop digit (index 4) '0' -> 0 random extras
    const rows = generateWorldSnapshot({ world: emptyWorld, sectorName: 'Test', campaignId: 'c1', tick: 1, tradeRules: 'MgT2022' })
    expect(rows).toHaveLength(6)
  })

  it('is deterministic — same inputs produce identical rows across calls', () => {
    const a = generateWorldSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 5, tradeRules: 'MgT2022' })
    const b = generateWorldSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 5, tradeRules: 'MgT2022' })
    expect(a).toEqual(b)
  })

  it('fixes the pre-existing bug where T5 silently used CT7 pricing — T5 and CT7 now diverge', () => {
    const ct7Rows = generateWorldSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 7, tradeRules: 'CT7' })
    const t5Rows  = generateWorldSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 7, tradeRules: 'T5' })
    // Both use the same 36-entry CT2 goods table (T5 has no goods table of its
    // own in this codebase), but the pricing formulas differ, so at least
    // some purchase prices must differ given the same seed.
    const anyDifferent = ct7Rows.some((r, i) => r.purchase_price !== t5Rows[i].purchase_price)
    expect(anyDifferent).toBe(true)
  })

  it('every row has positive purchase/sale prices and non-negative qty for all three rulesets', () => {
    for (const tradeRules of ['CT7', 'T5', 'MgT2022']) {
      const rows = generateWorldSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 3, tradeRules })
      for (const row of rows) {
        expect(row.purchase_price).toBeGreaterThan(0)
        expect(row.sale_price).toBeGreaterThan(0)
        expect(row.qty_available).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('generateWorldSnapshot dispatch — black market (seekingBlackMarket)', () => {
  // No trade codes at all, so none of the illegal-band goods' own
  // availability arrays (e.g. Illegal Biochemicals: Ag/Wa) can match —
  // any die 61-65 row seen here can only have come from the black-market
  // extra-roll mechanic, not the guaranteed common/trade-code baseline.
  const noCodesWorld = { Hex: '0404', UWP: 'A788899-C', Remarks: '' } // pop digit '8' -> 8 random extras/tick

  it('surfaces illegal-band goods (die 61-65) across many ticks, unlike the normal market', () => {
    let blackMarketHits = 0
    let normalHits      = 0
    for (let t = 0; t < 40; t++) {
      const bmRows     = generateWorldSnapshot({ world: noCodesWorld, sectorName: 'Test', campaignId: 'c1', tick: t, tradeRules: 'MgT2022', seekingBlackMarket: true })
      const normalRows = generateWorldSnapshot({ world: noCodesWorld, sectorName: 'Test', campaignId: 'c1', tick: t, tradeRules: 'MgT2022', seekingBlackMarket: false })
      if (bmRows.some(r => { const n = parseInt(r.trade_good_die, 10); return n >= 61 && n <= 65 })) blackMarketHits++
      if (normalRows.some(r => { const n = parseInt(r.trade_good_die, 10); return n >= 61 && n <= 65 })) normalHits++
    }
    expect(blackMarketHits).toBeGreaterThan(0)
    expect(normalHits).toBe(0)
  })

  it('never surfaces Exotics (die 66) even when seeking the black market', () => {
    for (let t = 0; t < 40; t++) {
      const rows = generateWorldSnapshot({ world: noCodesWorld, sectorName: 'Test', campaignId: 'c1', tick: t, tradeRules: 'MgT2022', seekingBlackMarket: true })
      expect(rows.every(r => r.trade_good_die !== '66' && r.trade_good_name !== 'Exotics')).toBe(true)
    }
  })

  it('still includes the 6 Common Goods baseline, same as the normal market', () => {
    const rows = generateWorldSnapshot({ world: noCodesWorld, sectorName: 'Test', campaignId: 'c1', tick: 1, tradeRules: 'MgT2022', seekingBlackMarket: true })
    const commonNames = ['Common Electronics', 'Common Industrial Goods', 'Common Manufactured Goods',
                          'Common Raw Materials', 'Common Consumables', 'Common Ore']
    for (const name of commonNames) {
      expect(rows.some(r => r.trade_good_name === name)).toBe(true)
    }
  })

  it('is deterministic and independent from the normal composition seed', () => {
    const a1 = generateWorldSnapshot({ world: noCodesWorld, sectorName: 'Test', campaignId: 'c1', tick: 9, tradeRules: 'MgT2022', seekingBlackMarket: true })
    const a2 = generateWorldSnapshot({ world: noCodesWorld, sectorName: 'Test', campaignId: 'c1', tick: 9, tradeRules: 'MgT2022', seekingBlackMarket: true })
    expect(a1).toEqual(a2)

    const normal = generateWorldSnapshot({ world: noCodesWorld, sectorName: 'Test', campaignId: 'c1', tick: 9, tradeRules: 'MgT2022', seekingBlackMarket: false })
    expect(a1).not.toEqual(normal)
  })
})

// ── Per-player live pricing (Phase 4) ───────────────────────────────────────────

describe('mgt2022PlayerGoodPrice', () => {
  // Common Electronics (die '11') is always present per "Determine Goods
  // Available" — safe to assume it's on offer regardless of composition.
  const goodDie = '11'

  it('with brokerSkill 0 reproduces the shared baseline snapshot exactly', () => {
    const rows = generateWorldSnapshot({
      world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 5, tradeRules: 'MgT2022',
    })
    const baseline = rows.find(r => r.trade_good_die === goodDie)

    const priced = mgt2022PlayerGoodPrice({
      campaignId: 'c1', world: testWorld, tick: 5, goodDie, brokerSkill: 0,
    })

    expect(priced.purchasePrice).toBe(baseline.purchase_price)
    expect(priced.salePrice).toBe(baseline.sale_price)
  })

  it('a higher Broker skill lowers the purchase price and raises the sale price', () => {
    const unskilled = mgt2022PlayerGoodPrice({ campaignId: 'c1', world: testWorld, tick: 5, goodDie, brokerSkill: 0 })
    const skilled   = mgt2022PlayerGoodPrice({ campaignId: 'c1', world: testWorld, tick: 5, goodDie, brokerSkill: 4 })

    expect(skilled.purchasePrice).toBeLessThanOrEqual(unskilled.purchasePrice)
    expect(skilled.salePrice).toBeGreaterThanOrEqual(unskilled.salePrice)
  })

  it('is deterministic across calls with the same inputs', () => {
    const a = mgt2022PlayerGoodPrice({ campaignId: 'c1', world: testWorld, tick: 5, goodDie, brokerSkill: 2 })
    const b = mgt2022PlayerGoodPrice({ campaignId: 'c1', world: testWorld, tick: 5, goodDie, brokerSkill: 2 })
    expect(a).toEqual(b)
  })

  it('returns null for an unknown goodDie', () => {
    expect(mgt2022PlayerGoodPrice({ campaignId: 'c1', world: testWorld, tick: 5, goodDie: '99' })).toBeNull()
  })
})

describe('ct7PlayerSalePrice', () => {
  const goodDie = '11'

  it('with brokerSkill 0 reproduces the shared baseline snapshot exactly', () => {
    const rows = generateWorldSnapshot({
      world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 5, tradeRules: 'CT7',
    })
    const baseline = rows.find(r => r.trade_good_die === goodDie)

    const salePrice = ct7PlayerSalePrice({
      campaignId: 'c1', world: testWorld, tick: 5, goodDie, brokerSkill: 0,
    })

    expect(salePrice).toBe(baseline.sale_price)
  })

  it('a higher Broker skill raises the sale price', () => {
    const unskilled = ct7PlayerSalePrice({ campaignId: 'c1', world: testWorld, tick: 5, goodDie, brokerSkill: 0 })
    const skilled   = ct7PlayerSalePrice({ campaignId: 'c1', world: testWorld, tick: 5, goodDie, brokerSkill: 4 })
    expect(skilled).toBeGreaterThanOrEqual(unskilled)
  })

  it('skill above the brokerDM cap (4) has the same effect as skill 4', () => {
    const capped   = ct7PlayerSalePrice({ campaignId: 'c1', world: testWorld, tick: 5, goodDie, brokerSkill: 4 })
    const overCap  = ct7PlayerSalePrice({ campaignId: 'c1', world: testWorld, tick: 5, goodDie, brokerSkill: 10 })
    expect(overCap).toBe(capped)
  })

  it('returns null for an unknown goodDie', () => {
    expect(ct7PlayerSalePrice({ campaignId: 'c1', world: testWorld, tick: 5, goodDie: 'ZZ' })).toBeNull()
  })
})
