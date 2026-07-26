import { describe, it, expect } from 'vitest'
import {
  characteristicDM,
  starportBrokerDM,
  MGT2022_FIND_SUPPLIER_TARGET,
  findSupplierRoll,
  goodsAvailableDM,
  isRerollRequired,
  resolveGood,
  maxTradeCodeDMs,
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
  parseTradeCodes,
  starportFromUWP,
  techFromUWP,
  lawFromUWP,
} from '../src/lib/trade-engine-mgt2022.js'

// ── Characteristics ───────────────────────────────────────────────────────────

describe('characteristicDM', () => {
  it('matches the standard Traveller characteristic-to-DM scale', () => {
    expect(characteristicDM(1)).toBe(-2)
    expect(characteristicDM(2)).toBe(-2)
    expect(characteristicDM(3)).toBe(-1)
    expect(characteristicDM(5)).toBe(-1)
    expect(characteristicDM(6)).toBe(0)
    expect(characteristicDM(8)).toBe(0)
    expect(characteristicDM(9)).toBe(1)
    expect(characteristicDM(11)).toBe(1)
    expect(characteristicDM(12)).toBe(2)
    expect(characteristicDM(15)).toBe(2)
  })

  it('returns 0 for an unrecorded characteristic', () => {
    expect(characteristicDM(null)).toBe(0)
    expect(characteristicDM(undefined)).toBe(0)
  })
})

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

describe('findSupplierRoll', () => {
  it('target is Average (8+)', () => {
    expect(MGT2022_FIND_SUPPLIER_TARGET).toBe(8)
  })

  it('succeeds when total meets the target exactly', () => {
    expect(findSupplierRoll({ twoDRoll: 8 })).toEqual({ total: 8, success: true })
  })

  it('fails when total is one short of the target', () => {
    expect(findSupplierRoll({ twoDRoll: 7 })).toEqual({ total: 7, success: false })
  })

  it('adds skill level and starport DM to the roll', () => {
    // 2 + 1 (skill) + 2 (starport C) = 5, still short of 8
    expect(findSupplierRoll({ twoDRoll: 2, skillLevel: 1, starportDM: 2 })).toEqual({ total: 5, success: false })
    // 6 + 1 + 2 = 9, meets the target
    expect(findSupplierRoll({ twoDRoll: 6, skillLevel: 1, starportDM: 2 })).toEqual({ total: 9, success: true })
  })

  it('applies DM-1 per previous attempt this world/month', () => {
    // A roll that would succeed cold fails after 3 prior attempts
    expect(findSupplierRoll({ twoDRoll: 8, previousAttempts: 0 })).toEqual({ total: 8, success: true })
    expect(findSupplierRoll({ twoDRoll: 8, previousAttempts: 3 })).toEqual({ total: 5, success: false })
  })
})

// ── Determine Goods Available ──────────────────────────────────────────────────

describe('goodsAvailableDM', () => {
  it('Population 3 or less: DM-3', () => {
    expect(goodsAvailableDM(0)).toBe(-3)
    expect(goodsAvailableDM('3')).toBe(-3)
  })

  it('Population 4-8: no DM', () => {
    expect(goodsAvailableDM(4)).toBe(0)
    expect(goodsAvailableDM(8)).toBe(0)
  })

  it('Population 9 or more: DM+3', () => {
    expect(goodsAvailableDM('9')).toBe(3)
    expect(goodsAvailableDM('C')).toBe(3)
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

  it('has exactly 30 priced entries covering D66 11-65', () => {
    const dice = ['1', '2', '3', '4', '5', '6'].flatMap(a => ['1', '2', '3', '4', '5'].map(b => a + b))
    for (const die of dice) {
      expect(resolveGood(die)).toBeDefined()
    }
  })

  it('excludes Exotics (66) — outside the normal trade rules, not a priced commodity', () => {
    expect(resolveGood('66')).toBeUndefined()
  })
})

describe('maxTradeCodeDMs', () => {
  it('takes the single largest matching DM, not the sum', () => {
    const codes = new Set(['Ag', 'Ri'])
    const dms = [{ code: 'Ag', dm: -3 }, { code: 'In', dm: +2 }, { code: 'Ri', dm: +1 }]
    expect(maxTradeCodeDMs(dms, codes)).toBe(1)
  })

  it('returns 0 for no matches', () => {
    expect(maxTradeCodeDMs([{ code: 'Ag', dm: -3 }], new Set(['In']))).toBe(0)
  })

  it('handles an empty DM list', () => {
    expect(maxTradeCodeDMs([], new Set(['Ag']))).toBe(0)
    expect(maxTradeCodeDMs(undefined, new Set(['Ag']))).toBe(0)
  })
})

// ── Determine Purchase / Sale Price ────────────────────────────────────────────

describe('purchaseRollTotal', () => {
  it('3D + broker skill + net purchase DM - supplier broker skill (default 2)', () => {
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
  it('3D + broker skill + net sale DM - purchaser broker skill (default 2)', () => {
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

  it('0: 175% purchase, 40% sale (the unmodified baseline)', () => {
    expect(modifiedPricePct(0)).toEqual({ purchasePct: 175, salePct: 40 })
  })

  it('one band per roll result, not coarser bands', () => {
    expect(modifiedPricePct(15)).toEqual({ purchasePct: 65, salePct: 120 })
    expect(modifiedPricePct(16)).toEqual({ purchasePct: 60, salePct: 125 })
    expect(modifiedPricePct(17)).toEqual({ purchasePct: 55, salePct: 130 })
  })

  it('purchase% decreases and sale% increases monotonically across rolls', () => {
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
  it('increases with parsecs', () => {
    expect(freightRate(6)).toBeGreaterThan(freightRate(1))
  })

  it('matches the Passage and Freight table (Cr/ton)', () => {
    expect(freightRate(1)).toBe(1000)
    expect(freightRate(6)).toBe(32000)
  })

  it('clamps parsecs to the 1-6 table range', () => {
    expect(freightRate(0)).toBe(freightRate(1))
    expect(freightRate(10)).toBe(freightRate(6))
  })
})

describe('freightCharge', () => {
  it('tons × rate, independent of lot size', () => {
    const rate = freightRate(2)
    expect(freightCharge(10, 2)).toBe(10 * rate)
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

// ── Smuggling risk (banned goods vs. Law Level) ───────────────────────────────

describe('smugglingRiskDM', () => {
  it('matches the book\'s worked example: banned at LL3, smuggled onto an LL9 world = Sale DM+6', () => {
    expect(smugglingRiskDM(3, 9)).toBe(6)
  })

  it('is zero (not negative) when the world\'s Law Level is below the ban threshold', () => {
    expect(smugglingRiskDM(8, 3)).toBe(0)
  })

  it('is zero when the good has no bannedLawLevel', () => {
    expect(smugglingRiskDM(null, 9)).toBe(0)
  })

  it('increases with the world\'s Law Level once past the threshold', () => {
    expect(smugglingRiskDM(1, 9)).toBeGreaterThan(smugglingRiskDM(1, 5))
  })
})


// ── Re-exported UWP helpers (from trade-engine-ct7.js) ────────────────────────

describe('re-exported UWP helpers', () => {
  it('parseTradeCodes/starportFromUWP/techFromUWP/lawFromUWP are usable', () => {
    expect(parseTradeCodes('Ag Ri')).toEqual(new Set(['Ag', 'Ri']))
    expect(starportFromUWP('A788899-C')).toBe('A')
    expect(techFromUWP('A788899-C')).toBe('C')
    expect(lawFromUWP('A788899-C')).toBe(9)
  })

  it('parseTradeCodes recognizes Ga/Ht/Lt (added for the Trade Goods table)', () => {
    expect(parseTradeCodes('Ga Ht Lt')).toEqual(new Set(['Ga', 'Ht', 'Lt']))
  })
})
