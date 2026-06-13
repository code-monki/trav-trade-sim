import { describe, it, expect } from 'vitest'
import {
  TRADE_CLASSIFICATIONS,
  TRADE_GOOD_CATEGORIES,
  TRADE_GOOD_DETAIL,
  parseTradeCodes,
  starportFromUWP,
  techFromUWP,
  t5CostOfGoods,
  t5TcAdjustedPrice,
  t5TlAdjustedPrice,
  t5SellingPrice,
  t5ActualValueMultiplier,
  t5ActualPrice,
  t5BrokerDM,
  t5BrokerCommission,
  t5BrokerFee,
  t5CargoId,
  t5TradeResult,
} from '../src/lib/trade-engine-t5.js'

// ── TRADE_CLASSIFICATIONS ─────────────────────────────────────────────────────

describe('TRADE_CLASSIFICATIONS', () => {
  it('contains all 7 groups', () => {
    // Planetary
    for (const c of ['As','De','Fl','Ga','He','Ic','Lk','Oc','Va','Wa']) {
      expect(TRADE_CLASSIFICATIONS).toHaveProperty(c)
    }
    // Population
    for (const c of ['Ba','Di','Hi','Lo','Ni','Ph']) {
      expect(TRADE_CLASSIFICATIONS).toHaveProperty(c)
    }
    // Economic
    for (const c of ['Ag','Fa','In','Na','Pa','Pi','Po','Pr','Ri']) {
      expect(TRADE_CLASSIFICATIONS).toHaveProperty(c)
    }
    // Climate
    for (const c of ['Fr','Tr','Tu','Tz']) {
      expect(TRADE_CLASSIFICATIONS).toHaveProperty(c)
    }
    // Secondary
    expect(TRADE_CLASSIFICATIONS).toHaveProperty('Mi')
    // Political
    for (const c of ['Cp','Cs','Cx','Cy','Pe','Re']) {
      expect(TRADE_CLASSIFICATIONS).toHaveProperty(c)
    }
    // Special
    for (const c of ['Ab','An','Da','Fo','Pz','Sa']) {
      expect(TRADE_CLASSIFICATIONS).toHaveProperty(c)
    }
  })

  it('has human-readable labels', () => {
    expect(TRADE_CLASSIFICATIONS.Ag).toBe('Agricultural')
    expect(TRADE_CLASSIFICATIONS.Fa).toBe('Farming')
    expect(TRADE_CLASSIFICATIONS.Ga).toBe('Garden World')
    expect(TRADE_CLASSIFICATIONS.He).toBe('Hellworld')
  })
})

// ── TRADE_GOOD_CATEGORIES ─────────────────────────────────────────────────────

describe('TRADE_GOOD_CATEGORIES', () => {
  it('has exactly 14 categories', () => {
    expect(TRADE_GOOD_CATEGORIES).toHaveLength(14)
  })

  it('contains all expected types', () => {
    const cats = new Set(TRADE_GOOD_CATEGORIES)
    for (const c of ['Raws','Rares','Consumables','Data','Pharma','Novelties',
                     'Imbalances','Valuta','Samples','Uniques','Manufactureds',
                     'Scrap/Waste','Entertainments','Red Tape']) {
      expect(cats.has(c)).toBe(true)
    }
  })
})

// ── TRADE_GOOD_DETAIL ─────────────────────────────────────────────────────────

describe('TRADE_GOOD_DETAIL', () => {
  it('has entries for the expected TC codes', () => {
    expect(TRADE_GOOD_DETAIL.Ri).toBe('Quality')
    expect(TRADE_GOOD_DETAIL.Hi).toBe('Processed')
    expect(TRADE_GOOD_DETAIL.Ga).toBe('Premium')
    expect(TRADE_GOOD_DETAIL.Ic).toBe('Cryo')
    expect(TRADE_GOOD_DETAIL.Va).toBe('Exotic')
  })
})

// ── parseTradeCodes ───────────────────────────────────────────────────────────

describe('parseTradeCodes', () => {
  it('returns empty set for empty input', () => {
    expect(parseTradeCodes('').size).toBe(0)
  })

  it('extracts known codes', () => {
    const codes = parseTradeCodes('Hi In Ri')
    expect(codes.has('Hi')).toBe(true)
    expect(codes.has('In')).toBe(true)
    expect(codes.has('Ri')).toBe(true)
    expect(codes.size).toBe(3)
  })

  it('now recognises all T5 codes including Cp, Cx, Ga, He, Fa, etc.', () => {
    const codes = parseTradeCodes('Ag Cp Cx Ri Ga He Fa Oc Di Ph')
    expect(codes.has('Ag')).toBe(true)
    expect(codes.has('Cp')).toBe(true)   // political — now recognised
    expect(codes.has('Cx')).toBe(true)
    expect(codes.has('Ri')).toBe(true)
    expect(codes.has('Ga')).toBe(true)
    expect(codes.has('He')).toBe(true)
    expect(codes.has('Fa')).toBe(true)
    expect(codes.size).toBe(10)
  })

  it('still ignores genuinely unknown tokens', () => {
    const codes = parseTradeCodes('Ag Zz Qq Ri')
    expect(codes.has('Ag')).toBe(true)
    expect(codes.has('Ri')).toBe(true)
    expect(codes.has('Zz')).toBe(false)
    expect(codes.size).toBe(2)
  })

  it('handles extra whitespace', () => {
    expect(parseTradeCodes('  Ag   Ni  ').size).toBe(2)
  })
})

// ── UWP helpers ───────────────────────────────────────────────────────────────

describe('starportFromUWP', () => {
  it('extracts first character uppercased', () => {
    expect(starportFromUWP('A646930-D')).toBe('A')
    expect(starportFromUWP('B46789C-A')).toBe('B')
    expect(starportFromUWP('x000000-0')).toBe('X')
  })
  it('returns X for empty string', () => {
    expect(starportFromUWP('')).toBe('X')
  })
})

describe('techFromUWP', () => {
  it('extracts part after dash', () => {
    expect(techFromUWP('A646930-D')).toBe('D')
    expect(techFromUWP('B46789C-A')).toBe('A')
    expect(techFromUWP('A788899-C')).toBe('C')
  })
  it('returns 0 for missing TL', () => {
    expect(techFromUWP('')).toBe('0')
    expect(techFromUWP('A000000')).toBe('0')
  })
})

// ── t5CostOfGoods ─────────────────────────────────────────────────────────────
// Reference: Trade Chart-2, "27 Trade and Commerce" p.13

describe('t5CostOfGoods', () => {
  it('base Cr3,000 with no TCs and TL 0', () => {
    expect(t5CostOfGoods(new Set(), '0')).toBe(3000)
  })

  it('base + TL×100 with no TCs — TL 8 → Cr3,800', () => {
    expect(t5CostOfGoods(new Set(), '8')).toBe(3800)
  })

  it('accepts hex TL — TL A (10) → +1,000', () => {
    expect(t5CostOfGoods(new Set(), 'A')).toBe(4000)
  })

  it('accepts integer TL', () => {
    expect(t5CostOfGoods(new Set(), 10)).toBe(4000)
  })

  // Hi and In both reduce cost (productive/industrial worlds → cheaper goods)
  it('Hi reduces cost by 1,000', () => {
    expect(t5CostOfGoods(new Set(['Hi']), '0')).toBe(2000)
  })

  it('In reduces cost by 1,000', () => {
    expect(t5CostOfGoods(new Set(['In']), '0')).toBe(2000)
  })

  it('Ag reduces cost by 1,000', () => {
    expect(t5CostOfGoods(new Set(['Ag']), '0')).toBe(2000)
  })

  it('As reduces cost by 1,000', () => {
    expect(t5CostOfGoods(new Set(['As']), '0')).toBe(2000)
  })

  it('Po reduces cost by 1,000', () => {
    expect(t5CostOfGoods(new Set(['Po']), '0')).toBe(2000)
  })

  // Fa (Farming) = Ag substitute: same −1,000 buying modifier
  it('Fa reduces cost by 1,000 (same as Ag)', () => {
    expect(t5CostOfGoods(new Set(['Fa']), '0')).toBe(2000)
  })

  // T5 codes with no buying modifier default to 0
  it('Ga has no buying cost effect', () => {
    expect(t5CostOfGoods(new Set(['Ga']), '0')).toBe(3000)
  })

  it('He has no buying cost effect', () => {
    expect(t5CostOfGoods(new Set(['He']), '0')).toBe(3000)
  })

  it('Oc has no buying cost effect', () => {
    expect(t5CostOfGoods(new Set(['Oc']), '0')).toBe(3000)
  })

  it('political codes (Cp, Cx, etc.) have no buying cost effect', () => {
    expect(t5CostOfGoods(new Set(['Cp', 'Cs', 'Cx']), '0')).toBe(3000)
  })

  // Ba, De, Fl, Ic, Lo, Ni, Ri, Va all increase cost
  it('Ba increases cost by 1,000', () => {
    expect(t5CostOfGoods(new Set(['Ba']), '0')).toBe(4000)
  })

  it('De increases cost by 1,000', () => {
    expect(t5CostOfGoods(new Set(['De']), '0')).toBe(4000)
  })

  it('Ni increases cost by 1,000', () => {
    expect(t5CostOfGoods(new Set(['Ni']), '0')).toBe(4000)
  })

  it('Ri increases cost by 1,000', () => {
    expect(t5CostOfGoods(new Set(['Ri']), '0')).toBe(4000)
  })

  it('Va increases cost by 1,000', () => {
    expect(t5CostOfGoods(new Set(['Va']), '0')).toBe(4000)
  })

  // Na and Wa have no modifier
  it('Na has no cost effect', () => {
    expect(t5CostOfGoods(new Set(['Na']), '0')).toBe(3000)
  })

  it('Wa has no cost effect', () => {
    expect(t5CostOfGoods(new Set(['Wa']), '0')).toBe(3000)
  })

  // ── Worked examples from Trade Chart-2 ──────────────────────────────────────

  // "The cargo ID from Efate is D Hi In Cr 2,300"
  // Efate A646930-D: Hi, In, TL D=13
  // 3,000 − 1,000 (Hi) − 1,000 (In) + 1,300 (TL13) = Cr2,300
  it('Efate (Hi In TL-D=13) → Cr2,300', () => {
    expect(t5CostOfGoods(new Set(['Hi', 'In']), 'D')).toBe(2300)
  })

  // "The cargo ID from Alell is A Ri Cr5,000"
  // Alell B46789C-A: Ri, TL A=10
  // 3,000 + 1,000 (Ri) + 1,000 (TL10) = Cr5,000
  it('Alell (Ri TL-A=10) → Cr5,000', () => {
    expect(t5CostOfGoods(new Set(['Ri']), 'A')).toBe(5000)
  })

  it('never returns less than 0', () => {
    // Many negative TCs + TL 0
    expect(t5CostOfGoods(new Set(['Hi', 'In', 'Ag', 'As', 'Po']), '0'))
      .toBeGreaterThanOrEqual(0)
  })
})

// ── t5TcAdjustedPrice ─────────────────────────────────────────────────────────

describe('t5TcAdjustedPrice', () => {
  it('base Cr5,000 with no matching pairs', () => {
    expect(t5TcAdjustedPrice(new Set(), new Set())).toBe(5000)
  })

  it('In source → Ri market: +1,000', () => {
    expect(t5TcAdjustedPrice(new Set(['In']), new Set(['Ri']))).toBe(6000)
  })

  it('Ri source → Hi market: +1,000', () => {
    expect(t5TcAdjustedPrice(new Set(['Ri']), new Set(['Hi']))).toBe(6000)
  })

  it('Ri source → In market: +1,000', () => {
    expect(t5TcAdjustedPrice(new Set(['Ri']), new Set(['In']))).toBe(6000)
  })

  it('Ri source → Hi + In market: +2,000 (two matches)', () => {
    // From worked example 3: Ri→Hi (+1,000) + Ri→In (+1,000) = +2,000
    expect(t5TcAdjustedPrice(new Set(['Ri']), new Set(['Hi', 'In']))).toBe(7000)
  })

  it('Ag source → In market: +1,000', () => {
    expect(t5TcAdjustedPrice(new Set(['Ag']), new Set(['In']))).toBe(6000)
  })

  it('In source → all listed market codes: +1,000 each (8 matches)', () => {
    const markets = new Set(['Ag', 'As', 'De', 'Fl', 'Hi', 'In', 'Ri', 'Va'])
    expect(t5TcAdjustedPrice(new Set(['In']), markets)).toBe(5000 + 8000)
  })

  it('Po source → Ag market: −1,000 (poor-world discount)', () => {
    expect(t5TcAdjustedPrice(new Set(['Po']), new Set(['Ag']))).toBe(4000)
  })

  it('Po source → all four penalised markets: −4,000 total', () => {
    const markets = new Set(['Ag', 'Hi', 'In', 'Ri'])
    expect(t5TcAdjustedPrice(new Set(['Po']), markets)).toBe(1000)
  })

  it('Ni source → any market: 0 (no entries in table)', () => {
    expect(t5TcAdjustedPrice(new Set(['Ni']), new Set(['In', 'Ri']))).toBe(5000)
  })

  it('Wa source → any market: 0', () => {
    expect(t5TcAdjustedPrice(new Set(['Wa']), new Set(['In', 'Hi']))).toBe(5000)
  })

  // Fa (Farming) = Ag substitute: identical selling cross-reference
  it('Fa source → Ag market: +1,000 (same as Ag)', () => {
    expect(t5TcAdjustedPrice(new Set(['Fa']), new Set(['Ag']))).toBe(6000)
  })

  it('Fa source → same 7-market set as Ag: +7,000', () => {
    const markets = new Set(['Ag', 'As', 'De', 'Hi', 'In', 'Ri', 'Va'])
    expect(t5TcAdjustedPrice(new Set(['Fa']), markets)).toBe(12000)
  })

  // Other new codes with no selling entries should contribute 0
  it('Ga source → any market: 0 (no selling entry)', () => {
    expect(t5TcAdjustedPrice(new Set(['Ga']), new Set(['Hi', 'In', 'Ri']))).toBe(5000)
  })

  it('He source → any market: 0 (no selling entry)', () => {
    expect(t5TcAdjustedPrice(new Set(['He']), new Set(['In', 'Ri']))).toBe(5000)
  })
})

// ── t5TlAdjustedPrice ─────────────────────────────────────────────────────────

describe('t5TlAdjustedPrice', () => {
  it('no delta (equal TLs) → price unchanged', () => {
    expect(t5TlAdjustedPrice('A', 'A', 6000)).toBe(6000)
  })

  it('positive delta adds a premium (source higher tech)', () => {
    // delta 3 (+30%): 6,000 × 1.30 = 7,800
    expect(t5TlAdjustedPrice('D', 'A', 6000)).toBe(7800)
  })

  it('negative delta reduces price (source lower tech)', () => {
    // delta −3 (−30%): 7,000 × 0.70 = 4,900
    expect(t5TlAdjustedPrice('A', 'D', 7000)).toBe(4900)
  })

  it('accepts integer TL values', () => {
    expect(t5TlAdjustedPrice(13, 10, 6000)).toBe(7800)
  })

  it('result is never negative', () => {
    // Extreme: source TL 0 vs market TL F (15) → −150% of price
    expect(t5TlAdjustedPrice('0', 'F', 5000)).toBeGreaterThanOrEqual(0)
  })

  it('rounds to nearest credit', () => {
    // delta 1 (+10%): 3,333 × 1.10 = 3,666.3 → 3,666
    expect(t5TlAdjustedPrice('1', '0', 3333)).toBe(3666)
  })
})

// ── t5SellingPrice (combined) ─────────────────────────────────────────────────

describe('t5SellingPrice', () => {
  // Worked example 1: Efate (In, TL-D=13) cargo → Alell (Ri, TL-A=10) market
  // TC adj: 5,000 + In→Ri (+1,000) = 6,000
  // TL delta: 13−10 = +3 → 6,000 × 1.30 = 7,800
  it('Efate cargo (In) at Alell (Ri TL-A=10), source TL-D=13 → Cr7,800', () => {
    expect(t5SellingPrice(new Set(['Hi', 'In']), new Set(['Ri']), 'D', 'A')).toBe(7800)
  })

  // Worked example 3: Alell (Ri, TL-A=10) cargo → Efate (Hi In, TL-D=13) market
  // TC adj: 5,000 + Ri→Hi (+1,000) + Ri→In (+1,000) = 7,000
  // TL delta: 10−13 = −3 → 7,000 × 0.70 = 4,900
  it('Alell cargo (Ri) at Efate (Hi In TL-D=13), source TL-A=10 → Cr4,900', () => {
    expect(t5SellingPrice(new Set(['Ri']), new Set(['Hi', 'In']), 'A', 'D')).toBe(4900)
  })
})

// ── t5ActualValueMultiplier ───────────────────────────────────────────────────

describe('t5ActualValueMultiplier', () => {
  it.each([
    [-5, 0.40],
    [-4, 0.50],
    [-3, 0.70],
    [-2, 0.80],
    [-1, 0.90],
    [ 0, 1.00],
    [ 1, 1.10],
    [ 2, 1.20],
    [ 3, 1.30],
    [ 4, 1.50],
    [ 5, 1.70],
    [ 6, 2.00],
    [ 7, 3.00],
    [ 8, 4.00],
  ])('flux %i → %f', (flux, mult) => {
    expect(t5ActualValueMultiplier(flux)).toBe(mult)
  })

  it('clamps below −5 to 0.40', () => {
    expect(t5ActualValueMultiplier(-99)).toBe(0.40)
  })

  it('clamps above +8 to 4.00', () => {
    expect(t5ActualValueMultiplier(99)).toBe(4.00)
  })

  // From worked example 1: flux 0 → 100% → price × 1.00
  it('flux 0 (as in example) → 1.00', () => {
    expect(t5ActualValueMultiplier(0)).toBe(1.00)
  })
})

// ── t5ActualPrice ─────────────────────────────────────────────────────────────

describe('t5ActualPrice', () => {
  it('flux 0 → price unchanged', () => {
    expect(t5ActualPrice(7800, 0)).toBe(7800)
  })

  it('flux +4 (150%) → 7,800 × 1.50 = 11,700', () => {
    expect(t5ActualPrice(7800, 4)).toBe(11700)
  })

  it('rounds to nearest credit', () => {
    // 1,001 × 1.10 = 1,101.1 → 1,101
    expect(t5ActualPrice(1001, 1)).toBe(1101)
  })
})

// ── t5BrokerDM ────────────────────────────────────────────────────────────────

describe('t5BrokerDM', () => {
  it('skill 0 → DM 0', () => {
    expect(t5BrokerDM(0)).toBe(0)
  })

  it.each([
    [1, 1], [2, 1],  // ⌈1/2⌉=1, ⌈2/2⌉=1
    [3, 2], [4, 2],  // ⌈3/2⌉=2, ⌈4/2⌉=2
    [5, 3], [6, 3],  // ⌈5/2⌉=3, ⌈6/2⌉=3
    [7, 4], [8, 4],  // capped at 4
  ])('skill %i → DM %i', (skill, dm) => {
    expect(t5BrokerDM(skill)).toBe(dm)
  })

  it('caps at +4 regardless of skill', () => {
    expect(t5BrokerDM(99)).toBe(4)
  })

  it('negative skill → DM 0', () => {
    expect(t5BrokerDM(-1)).toBe(0)
  })
})

// ── t5BrokerCommission / t5BrokerFee ─────────────────────────────────────────

describe('t5BrokerCommission', () => {
  it('skill 0 → 0% commission', () => {
    expect(t5BrokerCommission(0)).toBe(0)
  })

  it.each([
    [1, 0.05], [2, 0.05],
    [3, 0.10], [4, 0.10],
    [5, 0.15], [6, 0.15],
    [7, 0.20], [8, 0.20],
  ])('skill %i → %f commission', (skill, comm) => {
    expect(t5BrokerCommission(skill)).toBeCloseTo(comm, 10)
  })
})

describe('t5BrokerFee', () => {
  it('skill 0 → fee 0', () => {
    expect(t5BrokerFee(0, 100000)).toBe(0)
  })

  // From worked example 3: Broker-4, final price Cr7,350
  // commission = 20% (but text says 20%... actually broker-4 is 10%, not 20%)
  // The example says "minus 20% commission". Let me re-read:
  // "The Selling price is 150% of the Price = Cr7,350 (minus 20% commission = 1,470 = ) Cr5,880"
  // Broker-4 → DM 2, commission 10% × Cr7,350 = Cr735? But the example says 1,470.
  // 1,470 / 7,350 = 0.20 = 20%. But broker table shows Broker-4 = 10%...
  // The example text may have an inconsistency. The broker table clearly shows
  // Broker-4 = 10% commission, but the example uses 20%.
  // We implement what the TABLE says (DM = ⌈skill/2⌉, commission = 5% × DM).
  it('Broker-4 (DM 2) on Cr7,350 → 10% = Cr735', () => {
    expect(t5BrokerFee(4, 7350)).toBe(735)
  })

  it('Broker-7 (DM 4) on Cr10,000 → 20% = Cr2,000', () => {
    expect(t5BrokerFee(7, 10000)).toBe(2000)
  })

  it('rounds to nearest credit', () => {
    // Broker-1 (5%) on 333 Cr = 16.65 → 17
    expect(t5BrokerFee(1, 333)).toBe(17)
  })
})

// ── t5CargoId ─────────────────────────────────────────────────────────────────

describe('t5CargoId', () => {
  it('formats hex TL correctly', () => {
    expect(t5CargoId('D', new Set(['Hi', 'In']), 2300)).toBe('D Hi In Cr2,300')
  })

  it('numeric TL is converted to hex string', () => {
    expect(t5CargoId(13, new Set(['Hi', 'In']), 2300)).toBe('D Hi In Cr2,300')
  })

  it('TL A formats correctly', () => {
    expect(t5CargoId('A', new Set(['Ri']), 5000)).toBe('A Ri Cr5,000')
  })

  it('no trade codes produces clean ID', () => {
    expect(t5CargoId('8', new Set(), 3800)).toBe('8 Cr3,800')
  })
})

// ── t5TradeResult (end-to-end) ────────────────────────────────────────────────

describe('t5TradeResult', () => {
  // Worked example 1 from Trade Chart-2:
  // Efate A646930-D (Hi In) → Alell B46789C-A (Ri), no broker, flux 0
  it('Efate Hi+In → Alell Ri, TL-D→A, flux 0, 10 tons', () => {
    const r = t5TradeResult({
      sourceCodes:  new Set(['Hi', 'In']),
      sourceTL:     'D',
      marketCodes:  new Set(['Ri']),
      marketTL:     'A',
      tons:         10,
      purchaseFlux: 0,
      saleFlux:     0,
      brokerSkill:  0,
    })

    expect(r.costPerTon).toBe(2300)
    expect(r.totalCost).toBe(23000)
    expect(r.tcAdjustedPerTon).toBe(6000)
    expect(r.tradePricePerTon).toBe(7800)
    expect(r.effectiveFlux).toBe(0)
    expect(r.avMultiplier).toBe(1.00)
    expect(r.salePricePerTon).toBe(7800)
    expect(r.totalRevenue).toBe(78000)
    expect(r.brokerFeeTotal).toBe(0)
    expect(r.netProfit).toBe(55000)
    expect(r.cargoId).toBe('D Hi In Cr2,300')
  })

  // Worked example 3: Alell (Ri TL-A) → Efate (Hi In TL-D), Broker-4, flux+DM=+4
  // The PDF example uses AVT result +4 (150% of Cr4,900 = Cr7,350)
  // Note: the 20% commission in the original text appears to conflict with the
  // Broker-4 = 10% in the broker table; we follow the table.
  it('Alell Ri → Efate Hi+In, TL-A→D, broker-4, effective flux +4', () => {
    const r = t5TradeResult({
      sourceCodes:  new Set(['Ri']),
      sourceTL:     'A',
      marketCodes:  new Set(['Hi', 'In']),
      marketTL:     'D',
      tons:         1,
      purchaseFlux: 0,
      saleFlux:     2,      // raw flux 2 + broker DM 2 = effective +4
      brokerSkill:  4,
    })

    expect(r.costPerTon).toBe(5000)
    expect(r.tcAdjustedPerTon).toBe(7000)
    expect(r.tradePricePerTon).toBe(4900)
    expect(r.brokerMod).toBe(2)
    expect(r.effectiveFlux).toBe(4)
    expect(r.avMultiplier).toBe(1.50)
    expect(r.salePricePerTon).toBe(7350)
    expect(r.brokerFeeTotal).toBe(735)   // 10% × Cr7,350
    expect(r.netProfit).toBe(7350 - 5000 - 735)  // Cr1,615
  })

  it('broker DM is clamped at +4 even with high skill', () => {
    const r = t5TradeResult({
      sourceCodes:  new Set(['In']),
      sourceTL:     'A',
      marketCodes:  new Set(['Ri']),
      marketTL:     'A',
      tons:         1,
      saleFlux:     0,
      brokerSkill:  10,  // very high skill
    })
    expect(r.brokerMod).toBe(4)
    expect(r.effectiveFlux).toBe(4)
  })

  it('effective flux is clamped to max +8', () => {
    const r = t5TradeResult({
      sourceCodes:  new Set(),
      sourceTL:     '0',
      marketCodes:  new Set(),
      marketTL:     '0',
      tons:         1,
      saleFlux:     5,      // max raw flux
      brokerSkill:  7,      // DM +4
    })
    // raw 5 + DM 4 = 9, clamped to 8
    expect(r.effectiveFlux).toBe(8)
    expect(r.avMultiplier).toBe(4.00)
  })

  it('effective flux is clamped to min −5', () => {
    const r = t5TradeResult({
      sourceCodes:  new Set(),
      sourceTL:     '0',
      marketCodes:  new Set(),
      marketTL:     '0',
      tons:         1,
      saleFlux:     -5,
      brokerSkill:  0,
    })
    expect(r.effectiveFlux).toBe(-5)
    expect(r.avMultiplier).toBe(0.40)
  })
})
