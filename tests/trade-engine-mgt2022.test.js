import { describe, it, expect } from 'vitest'
import {
  starportBrokerDM,
  goodsAvailableDM,
  isRerollRequired,
  resolveGood,
  sumTradeCodeDMs,
  purchaseRollTotal,
  saleRollTotal,
  modifiedPricePct,
  purchasePrice,
  salePrice,
  freightRate,
  freightCharge,
  freightLatePenaltyPct,
  freightNetAfterPenalty,
  mailAvailable,
  mailContainerCount,
  mailPaymentMgT2022,
  smugglingRiskDM,
  trafficCount,
  parseTradeCodes,
  starportFromUWP,
  techFromUWP,
} from '../src/lib/trade-engine-mgt2022.js'

// ── Find-a-Supplier ────────────────────────────────────────────────────────────

describe('starportBrokerDM', () => {
  it('A/B/C/D starports give +6/+4/+2/0', () => {
    expect(starportBrokerDM('A')).toBe(6)
    expect(starportBrokerDM('B')).toBe(4)
    expect(starportBrokerDM('C')).toBe(2)
    expect(starportBrokerDM('D')).toBe(0)
  })

  it('E/X starports give no DM', () => {
    expect(starportBrokerDM('E')).toBe(0)
    expect(starportBrokerDM('X')).toBe(0)
  })

  it('lowercase input accepted', () => {
    expect(starportBrokerDM('a')).toBe(6)
  })
})

// ── Determine Goods Available ──────────────────────────────────────────────────

describe('goodsAvailableDM', () => {
  it('low population reduces availability', () => {
    expect(goodsAvailableDM(0)).toBeLessThan(0)
    expect(goodsAvailableDM('1')).toBeLessThan(0)
  })

  it('high population increases availability', () => {
    expect(goodsAvailableDM('A')).toBeGreaterThan(0)
    expect(goodsAvailableDM('C')).toBeGreaterThan(goodsAvailableDM('A'))
  })

  it('unknown population digit defaults to 0', () => {
    expect(goodsAvailableDM('Z')).toBe(0)
  })
})

describe('isRerollRequired', () => {
  it('requires re-roll for 61-65 by default', () => {
    for (const die of ['61', '62', '63', '64', '65']) {
      expect(isRerollRequired(die)).toBe(true)
    }
  })

  it('does not require re-roll outside 61-65', () => {
    expect(isRerollRequired('11')).toBe(false)
    expect(isRerollRequired('60')).toBe(false)
    expect(isRerollRequired('66')).toBe(false)
  })

  it('skips re-roll when seeking black market goods', () => {
    expect(isRerollRequired('63', true)).toBe(false)
  })
})

describe('resolveGood', () => {
  it('resolves a known die to its table entry', () => {
    const good = resolveGood('11')
    expect(good).toBeDefined()
    expect(good.name).toBe('Common Electronics')
  })

  it('returns undefined for an unknown die', () => {
    expect(resolveGood('99')).toBeUndefined()
  })

  it('has exactly 36 entries covering the full D66 range', () => {
    const dice = ['1', '2', '3', '4', '5', '6'].flatMap(a => ['1', '2', '3', '4', '5', '6'].map(b => a + b))
    for (const die of dice) {
      expect(resolveGood(die)).toBeDefined()
    }
  })
})

describe('sumTradeCodeDMs', () => {
  it('sums DMs for matching codes only', () => {
    const codes = new Set(['Ag', 'Ri'])
    const dms = [{ code: 'Ag', dm: -3 }, { code: 'In', dm: +2 }, { code: 'Ri', dm: +1 }]
    expect(sumTradeCodeDMs(dms, codes)).toBe(-2)
  })

  it('returns 0 for no matches', () => {
    expect(sumTradeCodeDMs([{ code: 'Ag', dm: -3 }], new Set(['In']))).toBe(0)
  })

  it('handles an empty DM list', () => {
    expect(sumTradeCodeDMs([], new Set(['Ag']))).toBe(0)
    expect(sumTradeCodeDMs(undefined, new Set(['Ag']))).toBe(0)
  })
})

// ── Determine Purchase / Sale Price ────────────────────────────────────────────

describe('purchaseRollTotal', () => {
  it('3D + broker skill + purchase DM - supplier broker skill (default 2)', () => {
    expect(purchaseRollTotal({ threeDRoll: 10, brokerSkill: 2, purchaseDM: -3 })).toBe(10 + 2 - 3 - 2)
  })

  it('defaults brokerSkill and purchaseDM to 0', () => {
    expect(purchaseRollTotal({ threeDRoll: 10 })).toBe(10 - 2)
  })

  it('respects a custom supplier broker skill', () => {
    expect(purchaseRollTotal({ threeDRoll: 10, supplierBrokerSkill: 0 })).toBe(10)
  })
})

describe('saleRollTotal', () => {
  it('3D + broker skill + sale DM - purchaser broker skill (default 2)', () => {
    expect(saleRollTotal({ threeDRoll: 10, brokerSkill: 1, saleDM: 4 })).toBe(10 + 1 + 4 - 2)
  })
})

describe('modifiedPricePct', () => {
  it('-3 or less: 300% purchase, 10% sale', () => {
    expect(modifiedPricePct(-3)).toEqual({ purchasePct: 300, salePct: 10 })
    expect(modifiedPricePct(-10)).toEqual({ purchasePct: 300, salePct: 10 })
  })

  it('25+: 15% purchase, 400% sale', () => {
    expect(modifiedPricePct(25)).toEqual({ purchasePct: 15, salePct: 400 })
    expect(modifiedPricePct(40)).toEqual({ purchasePct: 15, salePct: 400 })
  })

  it('15-17 band is the balanced middle (both 110%)', () => {
    expect(modifiedPricePct(16)).toEqual({ purchasePct: 110, salePct: 110 })
  })

  it('purchase% decreases and sale% increases monotonically across bands', () => {
    const rolls = [-3, -1, 1, 4, 7, 10, 13, 16, 19, 22, 24, 25]
    const pcts = rolls.map(modifiedPricePct)
    for (let i = 1; i < pcts.length; i++) {
      expect(pcts[i].purchasePct).toBeLessThanOrEqual(pcts[i - 1].purchasePct)
      expect(pcts[i].salePct).toBeGreaterThanOrEqual(pcts[i - 1].salePct)
    }
  })
})

describe('purchasePrice / salePrice', () => {
  it('purchasePrice applies the purchase% band to base price', () => {
    expect(purchasePrice(10000, -3)).toBe(30000) // 300%
    expect(purchasePrice(10000, 25)).toBe(1500)  // 15%
  })

  it('salePrice applies the sale% band to base price', () => {
    expect(salePrice(10000, -3)).toBe(1000)  // 10%
    expect(salePrice(10000, 25)).toBe(40000) // 400%
  })
})

// ── Freight ─────────────────────────────────────────────────────────────────────

describe('freightRate', () => {
  it('increases with parsecs for each lot size', () => {
    expect(freightRate('major', 6)).toBeGreaterThan(freightRate('major', 1))
  })

  it('incidental lots pay a higher per-ton rate than major lots', () => {
    expect(freightRate('incidental', 1)).toBeGreaterThan(freightRate('minor', 1))
    expect(freightRate('minor', 1)).toBeGreaterThan(freightRate('major', 1))
  })

  it('clamps parsecs to the 1-6 table range', () => {
    expect(freightRate('major', 0)).toBe(freightRate('major', 1))
    expect(freightRate('major', 10)).toBe(freightRate('major', 6))
  })

  it('unknown lot size returns 0', () => {
    expect(freightRate('bogus', 1)).toBe(0)
  })
})

describe('freightCharge', () => {
  it('tons × rate', () => {
    const rate = freightRate('major', 2)
    expect(freightCharge(10, 'major', 2)).toBe(10 * rate)
  })
})

describe('freightLatePenaltyPct', () => {
  it('(1D + 4) × 10%', () => {
    expect(freightLatePenaltyPct(1)).toBe(50)
    expect(freightLatePenaltyPct(6)).toBe(100)
  })
})

describe('freightNetAfterPenalty', () => {
  it('deducts the penalty percentage from the charge', () => {
    expect(freightNetAfterPenalty(1000, 50)).toBe(500)
  })

  it('never goes below 0 even if penalty exceeds 100%', () => {
    expect(freightNetAfterPenalty(1000, 150)).toBe(0)
  })
})

// ── Mail ────────────────────────────────────────────────────────────────────────

describe('mailAvailable', () => {
  it('requires 12 or better on 2D', () => {
    expect(mailAvailable(12)).toBe(true)
    expect(mailAvailable(11)).toBe(false)
  })
})

describe('mailContainerCount', () => {
  it('equals the 1D roll', () => {
    expect(mailContainerCount(3)).toBe(3)
  })
})

describe('mailPaymentMgT2022', () => {
  it('Cr25,000 per container', () => {
    expect(mailPaymentMgT2022(1)).toBe(25_000)
    expect(mailPaymentMgT2022(5)).toBe(125_000)
  })
})

// ── Smuggling risk ─────────────────────────────────────────────────────────────

describe('smugglingRiskDM', () => {
  it('higher law level increases risk', () => {
    expect(smugglingRiskDM(0, 9)).toBeGreaterThan(smugglingRiskDM(0, 1))
  })

  it('higher sale DM (better fences) reduces risk', () => {
    expect(smugglingRiskDM(5, 5)).toBeLessThan(smugglingRiskDM(0, 5))
  })
})

// ── Traffic availability ───────────────────────────────────────────────────────

describe('trafficCount', () => {
  it('roll of 6 with no DM yields 0', () => {
    expect(trafficCount(6, 0)).toBe(0)
  })

  it('never goes negative', () => {
    expect(trafficCount(2, -10)).toBe(0)
  })

  it('scales with roll and DM above baseline', () => {
    expect(trafficCount(10, 2)).toBe(10 + 2 - 6)
  })
})

// ── Re-exported UWP helpers (from trade-engine-ct7.js) ────────────────────────

describe('re-exported UWP helpers', () => {
  it('parseTradeCodes/starportFromUWP/techFromUWP are usable', () => {
    expect(parseTradeCodes('Ag Ri')).toEqual(new Set(['Ag', 'Ri']))
    expect(starportFromUWP('A788899-C')).toBe('A')
    expect(techFromUWP('A788899-C')).toBe('C')
  })
})
