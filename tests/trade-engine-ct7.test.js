import { describe, it, expect } from 'vitest'
import {
  parseTradeCodes,
  starportFromUWP,
  techFromUWP,
  costOfGoods,
  marketBasePrice,
  tlAdjustment,
  actualValueMultiplier,
  actualPrice,
  brokerDM,
  brokerFee,
  brokerSelfServiceGain,
  rollQty,
  tradeResult,
  rollCT7Availability,
  ct7PassengerPopulationDM,
  ct7CargoPopulationDM,
  ct7PassengerZoneDM,
  ct7PassengerZoneBlocked,
  ct7CargoZoneBlocked,
  ct7TrafficTLDM,
} from '../src/lib/trade-engine-ct7.js'
import { CT7_ALIEN_EFFECTS } from '../src/lib/traveller-data.js'

// ── parseTradeCodes ───────────────────────────────────────────────────────────

describe('parseTradeCodes', () => {
  it('returns empty set for empty string', () => {
    expect(parseTradeCodes('').size).toBe(0)
  })

  it('extracts known codes', () => {
    const codes = parseTradeCodes('Ag Ri In')
    expect(codes.has('Ag')).toBe(true)
    expect(codes.has('Ri')).toBe(true)
    expect(codes.has('In')).toBe(true)
    expect(codes.size).toBe(3)
  })

  it('ignores unknown tokens', () => {
    const codes = parseTradeCodes('Ag XX Cp Ri')
    expect(codes.has('Ag')).toBe(true)
    expect(codes.has('Ri')).toBe(true)
    expect(codes.has('XX')).toBe(false)
    expect(codes.size).toBe(2)
  })

  it('is case-sensitive — lowercase does not match', () => {
    const codes = parseTradeCodes('ag ri AG RI Ag Ri')
    expect(codes.has('Ag')).toBe(true)
    expect(codes.has('Ri')).toBe(true)
    expect(codes.has('ag')).toBe(false)
    expect(codes.size).toBe(2)
  })

  it('handles extra whitespace', () => {
    expect(parseTradeCodes('  Ag   Hi  ').size).toBe(2)
  })
})

// ── starportFromUWP ───────────────────────────────────────────────────────────

describe('starportFromUWP', () => {
  it('extracts the first character', () => {
    expect(starportFromUWP('A123456-7')).toBe('A')
    expect(starportFromUWP('B123456-7')).toBe('B')
    expect(starportFromUWP('X000000-0')).toBe('X')
  })

  it('uppercases the result', () => {
    expect(starportFromUWP('a123456-7')).toBe('A')
  })

  it('returns X for empty string', () => {
    expect(starportFromUWP('')).toBe('X')
  })
})

// ── techFromUWP ───────────────────────────────────────────────────────────────

describe('techFromUWP', () => {
  it('extracts the part after the dash', () => {
    expect(techFromUWP('A234567-8')).toBe('8')
    expect(techFromUWP('A87A9A5-C')).toBe('C')
  })

  it('returns 0 for missing tech level', () => {
    expect(techFromUWP('')).toBe('0')
    expect(techFromUWP('A000000')).toBe('0')
  })
})

// ── costOfGoods ───────────────────────────────────────────────────────────────

describe('costOfGoods', () => {
  it('returns base 4000 with no codes, starport B, TL 0', () => {
    expect(costOfGoods(new Set(), 'B', '0')).toBe(4000)
  })

  it('applies starport modifier: X adds 5000', () => {
    expect(costOfGoods(new Set(), 'X', '0')).toBe(9000)
  })

  it('applies starport modifier: A subtracts 1000', () => {
    expect(costOfGoods(new Set(), 'A', '0')).toBe(3000)
  })

  it('applies TL modifier: TL 5 adds 500', () => {
    expect(costOfGoods(new Set(), 'B', '5')).toBe(4500)
  })

  it('applies hex TL: TL A (10) adds 1000', () => {
    expect(costOfGoods(new Set(), 'B', 'A')).toBe(5000)
  })

  it('applies trade code modifier: Ag subtracts 1000', () => {
    expect(costOfGoods(new Set(['Ag']), 'B', '0')).toBe(3000)
  })

  it('stacks multiple trade code modifiers', () => {
    // Ag: -1000, Hi: -1000 → 4000 - 2000 = 2000 (with B starport, TL 0)
    expect(costOfGoods(new Set(['Ag', 'Hi']), 'B', '0')).toBe(2000)
  })

  it('combines codes, starport, and TL', () => {
    // Ag (-1000), starport A (-1000), TL 7 (+700) → 4000 - 1000 - 1000 + 700 = 2700
    expect(costOfGoods(new Set(['Ag']), 'A', '7')).toBe(2700)
  })

  it('never returns less than 0', () => {
    // Extreme negative scenario
    expect(costOfGoods(new Set(['Ag', 'Hi', 'In']), 'A', '0')).toBeGreaterThanOrEqual(0)
  })

  it('applies Poor trade code as a discount, not a premium (Book 7 table: Po -1000)', () => {
    expect(costOfGoods(new Set(['Po']), 'B', '0')).toBe(3000)
  })

  it('applies Vacuum trade code as a premium (Book 7 table: Va +1000)', () => {
    expect(costOfGoods(new Set(['Va']), 'B', '0')).toBe(5000)
  })
})

// ── marketBasePrice ───────────────────────────────────────────────────────────

describe('marketBasePrice', () => {
  it('returns base 5000 with no trade codes', () => {
    expect(marketBasePrice(new Set(), new Set())).toBe(5000)
  })

  it('adds 1000 for Ag source sold in Ag market', () => {
    expect(marketBasePrice(new Set(['Ag']), new Set(['Ag']))).toBe(6000)
  })

  it('adds 1000 for In source sold in Ag market', () => {
    expect(marketBasePrice(new Set(['In']), new Set(['Ag']))).toBe(6000)
  })

  it('subtracts 1000 for Ni source in Ni market (negative entry)', () => {
    expect(marketBasePrice(new Set(['Ni']), new Set(['Ni']))).toBe(4000)
  })

  it('stacks multiple matching pairs', () => {
    // Ag→Ag (+1000) and Ag→In (+1000) → 5000 + 2000 = 7000
    expect(marketBasePrice(new Set(['Ag']), new Set(['Ag', 'In']))).toBe(7000)
  })

  it('Ic source only modifies the In market column, not Ic (Book 7 table row is Ic -> In +1)', () => {
    expect(marketBasePrice(new Set(['Ic']), new Set(['In']))).toBe(6000)
    expect(marketBasePrice(new Set(['Ic']), new Set(['Ic']))).toBe(5000)
  })
})

// ── CT7_ALIEN_EFFECTS ────────────────────────────────────────────────────────
// Currently dead data (zero callers anywhere in the app — no alienEffect()
// helper exists, and no world/campaign data tracks race/nationality), but the
// table itself should still match Book 7's Alien Market Effects Table.

describe('CT7_ALIEN_EFFECTS', () => {
  it('matches the Book 7 Alien Market Effects Table exactly', () => {
    expect(CT7_ALIEN_EFFECTS).toEqual({
      As: { Kk: -2, Va: +1 },
      Dr: { Zh: +2 },
      Hv: { As: +1, Im: -2 },
      Im: { Zh: -1 },
      Kk: { Va: -2 },
      So: { Hv: +1, Im: -1 },
      Va: { Kk: -4 },
      Zh: { As: +1, Dr: +1, Im: -2 },
    })
  })
})

// ── tlAdjustment ──────────────────────────────────────────────────────────────

describe('tlAdjustment', () => {
  it('returns base price unchanged when TLs are equal', () => {
    expect(tlAdjustment('7', '7', 10000)).toBe(10000)
  })

  it('decreases price when source TL is lower than market TL (disadvantageous)', () => {
    // delta = 5-9 = -4: 10000 × (1 - 0.4) = 6000
    expect(tlAdjustment('5', '9', 10000)).toBe(6000)
  })

  it('increases price when source TL exceeds market TL (advantageous)', () => {
    // delta = 2: 10000 × (1 + 0.2) = 12000
    expect(tlAdjustment('9', '7', 10000)).toBe(12000)
  })

  it('accepts integer TL values', () => {
    expect(tlAdjustment(9, 7, 10000)).toBe(12000)
  })

  it('handles hex TL correctly: A (10) vs 7 → delta 3 → +30%', () => {
    expect(tlAdjustment('A', '7', 10000)).toBe(13000)
  })

  it('a decrease of 100% or more floors at 0 (goods have no value at that market)', () => {
    // delta = -10: pct = -100%
    expect(tlAdjustment('2', 'C', 10000)).toBe(0)
    // delta = -15: pct = -150%, still floors at 0 (not negative)
    expect(tlAdjustment('0', 'F', 10000)).toBe(0)
  })

  it('matches the Book 7 worked example: TL 15 source, TL 1 market → +140%', () => {
    expect(tlAdjustment('F', '1', 10000)).toBeCloseTo(24000)
  })

  it('matches the Book 7 worked example: TL 10 source, TL 15 market → -50%', () => {
    expect(tlAdjustment('A', 'F', 10000)).toBe(5000)
  })

  it('reproduces the Regina worked example exactly (base+trade-class subtotal 7000, delta -3 → -30% → 4900)', () => {
    expect(tlAdjustment('7', 'A', 7000)).toBe(4900)
  })
})

// ── actualValueMultiplier ─────────────────────────────────────────────────────

describe('actualValueMultiplier', () => {
  it('returns correct table values', () => {
    expect(actualValueMultiplier(2)).toBe(0.40)
    expect(actualValueMultiplier(7)).toBe(1.00)
    expect(actualValueMultiplier(12)).toBe(1.70)
    expect(actualValueMultiplier(15)).toBe(4.00)
  })

  it('clamps below 2 to the roll-2 entry', () => {
    expect(actualValueMultiplier(0)).toBe(0.40)
    expect(actualValueMultiplier(-5)).toBe(0.40)
  })

  it('clamps above 15 to the roll-15 entry', () => {
    expect(actualValueMultiplier(16)).toBe(4.00)
    expect(actualValueMultiplier(99)).toBe(4.00)
  })
})

// ── actualPrice ───────────────────────────────────────────────────────────────

describe('actualPrice', () => {
  it('base × multiplier at roll 7 (1.00) = base', () => {
    expect(actualPrice(10000, 7)).toBe(10000)
  })

  it('base × multiplier at roll 12 (1.70)', () => {
    expect(actualPrice(10000, 12)).toBe(17000)
  })

  it('base × multiplier at roll 2 (0.40)', () => {
    expect(actualPrice(10000, 2)).toBe(4000)
  })

  it('rounds to nearest Credit', () => {
    // 10001 × 1.10 = 11001.1 → 11001
    expect(actualPrice(10001, 8)).toBe(11001)
  })
})

// ── brokerDM ──────────────────────────────────────────────────────────────────

describe('brokerDM', () => {
  it('returns skill directly for 0–4', () => {
    expect(brokerDM(0)).toBe(0)
    expect(brokerDM(2)).toBe(2)
    expect(brokerDM(4)).toBe(4)
  })

  it('clamps to 4 for skill > 4', () => {
    expect(brokerDM(5)).toBe(4)
    expect(brokerDM(10)).toBe(4)
  })

  it('clamps to 0 for negative skill', () => {
    expect(brokerDM(-1)).toBe(0)
    expect(brokerDM(-99)).toBe(0)
  })
})

// ── brokerFee ─────────────────────────────────────────────────────────────────

describe('brokerFee', () => {
  it('is 0 for skill 0', () => {
    expect(brokerFee(0, 100000)).toBe(0)
  })

  it('calculates 5% × skill × price', () => {
    // skill 2, price 10000 → 0.05 × 2 × 10000 = 1000
    expect(brokerFee(2, 10000)).toBe(1000)
  })

  it('clamps skill at 4', () => {
    // skill 6 treated as 4 → 0.05 × 4 × 20000 = 4000
    expect(brokerFee(6, 20000)).toBe(4000)
    expect(brokerFee(4, 20000)).toBe(4000)
  })
})

// ── brokerSelfServiceGain ────────────────────────────────────────────────────
// A player-character using their OWN Broker skill (this app's only case —
// no NPC-hiring flow exists) keeps HALF the standard brokerage fee as pure
// profit, rather than paying the full fee out as a hired broker would.

describe('brokerSelfServiceGain', () => {
  it('is 0 for skill 0', () => {
    expect(brokerSelfServiceGain(0, 100000)).toBe(0)
  })

  it('is half of brokerFee for the same inputs', () => {
    expect(brokerSelfServiceGain(2, 10000)).toBe(brokerFee(2, 10000) / 2)
    expect(brokerSelfServiceGain(4, 20000)).toBe(brokerFee(4, 20000) / 2)
  })

  it('clamps skill at 4, same as brokerFee', () => {
    expect(brokerSelfServiceGain(6, 20000)).toBe(brokerSelfServiceGain(4, 20000))
  })
})

// ── rollQty ───────────────────────────────────────────────────────────────────

describe('rollQty', () => {
  it('resolves NDs × multiplier', () => {
    expect(rollQty('3Dx5', [1, 2, 3])).toBe(30)   // (1+2+3) × 5
    expect(rollQty('2Dx10', [3, 4])).toBe(70)      // (3+4) × 10
  })

  it('resolves ND with no multiplier', () => {
    expect(rollQty('1D', [4])).toBe(4)
    expect(rollQty('3D', [2, 2, 2])).toBe(6)
  })

  it('uses only the required number of dice from the array', () => {
    expect(rollQty('1D', [6, 6, 6])).toBe(6)
  })

  it('handles 8D (largest qty expression in CT2 table)', () => {
    expect(rollQty('8Dx5', [1, 1, 1, 1, 1, 1, 1, 1])).toBe(40)
  })

  it('returns 0 for unrecognised expression', () => {
    expect(rollQty('', [])).toBe(0)
    expect(rollQty('bad', [])).toBe(0)
  })
})

// ── rollCT7Availability (Book 7 Passengers/Cargo Available tables) ──────────

describe('rollCT7Availability', () => {
  it("'-' is always 0, regardless of DM, consuming no dice", () => {
    expect(rollCT7Availability('-', [], 99)).toBe(0)
  })

  it('flat "XD" sums X dice', () => {
    expect(rollCT7Availability('3D', [2, 2, 2])).toBe(6)
  })

  it('flat "XD+N" adds a flat modifier', () => {
    expect(rollCT7Availability('1D+4', [3])).toBe(7)
  })

  it('flat "XD-N" subtracts a flat modifier, floored at 0', () => {
    expect(rollCT7Availability('1D-4', [3])).toBe(0) // 3 - 4 = -1 -> 0
    expect(rollCT7Availability('1D-2', [5])).toBe(3)
  })

  it('"XD-YD" rolls two separate dice pools and subtracts, floored at 0', () => {
    // 2D (rolls[0..1]=3,3 -> 6) - 2D (rolls[2..3]=1,1 -> 2) = 4
    expect(rollCT7Availability('2D-2D', [3, 3, 1, 1])).toBe(4)
    // 1D (rolls[0]=2) - 1D (rolls[1]=6) = -4 -> floors at 0
    expect(rollCT7Availability('1D-1D', [2, 6])).toBe(0)
  })

  it('applies an additional flat DM on top of the expression result, still floored at 0', () => {
    expect(rollCT7Availability('3D', [2, 2, 2], 5)).toBe(11)
    expect(rollCT7Availability('1D', [1], -10)).toBe(0)
  })

  it('returns 0 for an unrecognised expression', () => {
    expect(rollCT7Availability('bad', [])).toBe(0)
  })
})

describe('CT7 traffic DM helpers', () => {
  it('ct7PassengerPopulationDM: -3 at pop 4-, +3 at pop 8+, else 0', () => {
    expect(ct7PassengerPopulationDM('4')).toBe(-3)
    expect(ct7PassengerPopulationDM('0')).toBe(-3)
    expect(ct7PassengerPopulationDM('6')).toBe(0)
    expect(ct7PassengerPopulationDM('8')).toBe(3)
    expect(ct7PassengerPopulationDM('A')).toBe(3)
  })

  it('ct7CargoPopulationDM: -3 at pop 4-, +1 at pop 8+, else 0', () => {
    expect(ct7CargoPopulationDM('4')).toBe(-3)
    expect(ct7CargoPopulationDM('6')).toBe(0)
    expect(ct7CargoPopulationDM('8')).toBe(1)
  })

  it('ct7PassengerZoneDM: Red -12, Amber -6, else 0', () => {
    expect(ct7PassengerZoneDM('R')).toBe(-12)
    expect(ct7PassengerZoneDM('A')).toBe(-6)
    expect(ct7PassengerZoneDM(null)).toBe(0)
  })

  it('ct7PassengerZoneBlocked: Red blocks Middle/Low but not High', () => {
    expect(ct7PassengerZoneBlocked('R', 'high')).toBe(false)
    expect(ct7PassengerZoneBlocked('R', 'middle')).toBe(true)
    expect(ct7PassengerZoneBlocked('R', 'low')).toBe(true)
    expect(ct7PassengerZoneBlocked('A', 'middle')).toBe(false)
  })

  it('ct7CargoZoneBlocked: Red blocks everything, Amber blocks Major only', () => {
    expect(ct7CargoZoneBlocked('R', 'major')).toBe(true)
    expect(ct7CargoZoneBlocked('R', 'minor')).toBe(true)
    expect(ct7CargoZoneBlocked('R', 'incidental')).toBe(true)
    expect(ct7CargoZoneBlocked('A', 'major')).toBe(true)
    expect(ct7CargoZoneBlocked('A', 'minor')).toBe(false)
    expect(ct7CargoZoneBlocked('A', 'incidental')).toBe(false)
  })

  it('ct7TrafficTLDM: source TL minus market TL', () => {
    expect(ct7TrafficTLDM('9', '7')).toBe(2)
    expect(ct7TrafficTLDM('7', '9')).toBe(-2)
    expect(ct7TrafficTLDM('A', '7')).toBe(3)
  })
})

// ── tradeResult (end-to-end) ──────────────────────────────────────────────────

describe('tradeResult', () => {
  it('produces correct figures for a known Ag→In trade', () => {
    // Source: Ag world, starport B, TL 7
    // Market: In world, starport A, TL 9
    // No broker, purchase roll 7, sale roll 7, 10 tons

    const result = tradeResult({
      sourceCodes:  new Set(['Ag']),
      sourceUWP:    'B000000-7',
      marketCodes:  new Set(['In']),
      marketUWP:    'A000000-9',
      tons:         10,
      purchaseRoll: 7,
      saleRoll:     7,
      brokerSkill:  0,
    })

    // costPerTon: 4000 (base) - 1000 (Ag) + 0 (starport B) + 700 (TL 7) = 3700
    expect(result.costPerTon).toBe(3700)
    expect(result.purchaseMultiplier).toBe(1.00)
    expect(result.purchasePricePerTon).toBe(3700)
    expect(result.totalCost).toBe(37000)

    // marketBase: 5000 + 1000 (Ag→In) = 6000
    expect(result.marketBasePerTon).toBe(6000)

    // TL adjustment: source 7, market 9 → delta -2 → -20% → 6000 × 0.8 = 4800
    expect(result.tlAdjustedPerTon).toBe(4800)

    expect(result.salePricePerTon).toBe(4800)
    expect(result.totalRevenue).toBe(48000)
    expect(result.brokerGainTotal).toBe(0)
    expect(result.netProfit).toBe(11000)
  })

  it('applies broker self-service gain and DM correctly', () => {
    const result = tradeResult({
      sourceCodes:  new Set(),
      sourceUWP:    'B000000-7',
      marketCodes:  new Set(),
      marketUWP:    'B000000-7',
      tons:         1,
      purchaseRoll: 7,
      saleRoll:     7,   // base roll; broker adds DM 2 → effective roll 9
      brokerSkill:  2,
    })

    // saleRoll 7 + brokerDM 2 = 9 → multiplier 1.20
    // marketBase = 5000, no TL adj
    expect(result.salePricePerTon).toBe(6000)   // 5000 × 1.20
    // brokerFee = 0.05 × 2 × 6000 = 600; self-service gain = half = 300
    expect(result.brokerGainTotal).toBe(300)
  })

  it('applies TL advantage when source TL exceeds market TL (high-tech source, low-tech market)', () => {
    const result = tradeResult({
      sourceCodes:  new Set(),
      sourceUWP:    'B000000-A',   // TL A = 10
      marketCodes:  new Set(),
      marketUWP:    'B000000-7',   // TL 7
      tons:         1,
      purchaseRoll: 7,
      saleRoll:     7,
      brokerSkill:  0,
    })

    // delta = 10 - 7 = 3; advantage = 3 × 10% = +30%
    // marketBase 5000 → tlAdjusted = 5000 × 1.30 = 6500
    expect(result.tlAdjustedPerTon).toBe(6500)
  })

  it('applies TL disadvantage when market TL exceeds source TL (low-tech source, high-tech market)', () => {
    const result = tradeResult({
      sourceCodes:  new Set(),
      sourceUWP:    'B000000-7',   // TL 7
      marketCodes:  new Set(),
      marketUWP:    'B000000-A',   // TL A = 10
      tons:         1,
      purchaseRoll: 7,
      saleRoll:     7,
      brokerSkill:  0,
    })

    // delta = 7 - 10 = -3; penalty = 3 × 10% = -30%
    // marketBase 5000 → tlAdjusted = 5000 × 0.70 = 3500
    expect(result.tlAdjustedPerTon).toBe(3500)
  })
})
