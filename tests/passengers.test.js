import { describe, it, expect } from 'vitest'
import {
  passengerFare,
  passageCapacityNeeded,
  availableFuelTypes,
  jumpFuelTons,
  fuelCost,
  mailPayment,
  PASSAGE_TYPES,
  FUEL_PRICES,
} from '../src/lib/passengers.js'

// ── passengerFare ─────────────────────────────────────────────────────────────

describe('passengerFare — CT7 (flat per jump)', () => {
  it('high passage: Cr10,000 per head flat regardless of parsecs', () => {
    expect(passengerFare('high', 1, 'CT7', 1)).toEqual({ farePerHead: 10_000, fareTotal: 10_000 })
    expect(passengerFare('high', 1, 'CT7', 3)).toEqual({ farePerHead: 10_000, fareTotal: 10_000 })
  })

  it('middle passage: Cr8,000 per head flat', () => {
    expect(passengerFare('middle', 1, 'CT7', 2)).toEqual({ farePerHead: 8_000, fareTotal: 8_000 })
  })

  it('low passage: Cr1,000 per head flat', () => {
    expect(passengerFare('low', 1, 'CT7', 1)).toEqual({ farePerHead: 1_000, fareTotal: 1_000 })
  })

  it('scales fareTotal by count', () => {
    expect(passengerFare('high', 3, 'CT7', 1)).toEqual({ farePerHead: 10_000, fareTotal: 30_000 })
    expect(passengerFare('middle', 2, 'CT7', 1)).toEqual({ farePerHead: 8_000, fareTotal: 16_000 })
    expect(passengerFare('low', 4, 'CT7', 1)).toEqual({ farePerHead: 1_000, fareTotal: 4_000 })
  })
})

describe('passengerFare — T5 (per parsec for High/Middle; Low flat)', () => {
  it('high passage scales with parsecs', () => {
    expect(passengerFare('high', 1, 'T5', 1)).toEqual({ farePerHead: 10_000, fareTotal: 10_000 })
    expect(passengerFare('high', 1, 'T5', 2)).toEqual({ farePerHead: 20_000, fareTotal: 20_000 })
    expect(passengerFare('high', 1, 'T5', 3)).toEqual({ farePerHead: 30_000, fareTotal: 30_000 })
  })

  it('middle passage scales with parsecs', () => {
    expect(passengerFare('middle', 1, 'T5', 2)).toEqual({ farePerHead: 16_000, fareTotal: 16_000 })
  })

  it('low passage remains flat regardless of parsecs', () => {
    expect(passengerFare('low', 1, 'T5', 1)).toEqual({ farePerHead: 1_000, fareTotal: 1_000 })
    expect(passengerFare('low', 1, 'T5', 3)).toEqual({ farePerHead: 1_000, fareTotal: 1_000 })
  })

  it('scales fareTotal by count (T5)', () => {
    expect(passengerFare('high', 3, 'T5', 2)).toEqual({ farePerHead: 20_000, fareTotal: 60_000 })
  })

  it('clamps parsecs to minimum 1', () => {
    expect(passengerFare('high', 1, 'T5', 0)).toEqual({ farePerHead: 10_000, fareTotal: 10_000 })
    expect(passengerFare('high', 1, 'T5', -1)).toEqual({ farePerHead: 10_000, fareTotal: 10_000 })
  })
})

// ── passageCapacityNeeded ─────────────────────────────────────────────────────

describe('passageCapacityNeeded', () => {
  it('high passengers consume staterooms, not low berths', () => {
    expect(passageCapacityNeeded('high', 2)).toEqual({ stateroomsNeeded: 2, lowBerthsNeeded: 0 })
  })

  it('middle passengers consume staterooms, not low berths', () => {
    expect(passageCapacityNeeded('middle', 3)).toEqual({ stateroomsNeeded: 3, lowBerthsNeeded: 0 })
  })

  it('low passengers consume low berths, not staterooms', () => {
    expect(passageCapacityNeeded('low', 4)).toEqual({ stateroomsNeeded: 0, lowBerthsNeeded: 4 })
  })

  it('count of 1', () => {
    expect(passageCapacityNeeded('high', 1)).toEqual({ stateroomsNeeded: 1, lowBerthsNeeded: 0 })
    expect(passageCapacityNeeded('low',  1)).toEqual({ stateroomsNeeded: 0, lowBerthsNeeded: 1 })
  })
})

// ── availableFuelTypes ────────────────────────────────────────────────────────

describe('availableFuelTypes', () => {
  it('Class A: refined only at Cr500/ton', () => {
    expect(availableFuelTypes('A')).toEqual({ refined: 500 })
  })

  it('Class B: refined only at Cr500/ton', () => {
    expect(availableFuelTypes('B')).toEqual({ refined: 500 })
  })

  it('Class C: unrefined only at Cr100/ton', () => {
    expect(availableFuelTypes('C')).toEqual({ unrefined: 100 })
  })

  it('Class D: unrefined only at Cr100/ton', () => {
    expect(availableFuelTypes('D')).toEqual({ unrefined: 100 })
  })

  it('Class E: no commercial fuel', () => {
    expect(availableFuelTypes('E')).toEqual({})
  })

  it('Class X: no commercial fuel', () => {
    expect(availableFuelTypes('X')).toEqual({})
  })

  it('lowercase input is accepted', () => {
    expect(availableFuelTypes('a')).toEqual({ refined: 500 })
    expect(availableFuelTypes('c')).toEqual({ unrefined: 100 })
  })

  it('unknown class returns no fuel', () => {
    expect(availableFuelTypes('Z')).toEqual({})
    expect(availableFuelTypes('')).toEqual({})
    expect(availableFuelTypes(null)).toEqual({})
  })
})

// ── jumpFuelTons ──────────────────────────────────────────────────────────────

describe('jumpFuelTons', () => {
  it('200-ton hull, J-1: 20 tons', () => {
    expect(jumpFuelTons(200, 1)).toBe(20)
  })

  it('200-ton hull, J-2: 40 tons', () => {
    expect(jumpFuelTons(200, 2)).toBe(40)
  })

  it('100-ton hull, J-2: 20 tons', () => {
    expect(jumpFuelTons(100, 2)).toBe(20)
  })

  it('rounds up fractional tons', () => {
    // 99-ton hull, J-1: 9.9 → ceil → 10
    expect(jumpFuelTons(99, 1)).toBe(10)
  })

  it('defaults to 1 parsec', () => {
    expect(jumpFuelTons(200)).toBe(20)
  })
})

// ── fuelCost ──────────────────────────────────────────────────────────────────

describe('fuelCost', () => {
  it('refined: 20 tons × Cr500 = Cr10,000', () => {
    expect(fuelCost(20, 500)).toBe(10_000)
  })

  it('unrefined: 20 tons × Cr100 = Cr2,000', () => {
    expect(fuelCost(20, 100)).toBe(2_000)
  })

  it('rounds to nearest credit', () => {
    expect(fuelCost(3, 100)).toBe(300)
  })
})

// ── mailPayment ───────────────────────────────────────────────────────────────

describe('mailPayment', () => {
  it('CT7: flat Cr25,000 regardless of parsecs', () => {
    expect(mailPayment('CT7', 1)).toBe(25_000)
    expect(mailPayment('CT7', 3)).toBe(25_000)
  })

  it('T5: Cr25,000 per parsec', () => {
    expect(mailPayment('T5', 1)).toBe(25_000)
    expect(mailPayment('T5', 2)).toBe(50_000)
    expect(mailPayment('T5', 3)).toBe(75_000)
  })

  it('T5: clamps parsecs to minimum 1', () => {
    expect(mailPayment('T5', 0)).toBe(25_000)
    expect(mailPayment('T5', -1)).toBe(25_000)
  })

  it('CT7: defaults parsecs to 1', () => {
    expect(mailPayment('CT7')).toBe(25_000)
  })
})

// ── PASSAGE_TYPES constant ────────────────────────────────────────────────────

describe('PASSAGE_TYPES', () => {
  it('contains the three standard types', () => {
    expect(PASSAGE_TYPES).toContain('high')
    expect(PASSAGE_TYPES).toContain('middle')
    expect(PASSAGE_TYPES).toContain('low')
    expect(PASSAGE_TYPES).toHaveLength(3)
  })
})

// ── FUEL_PRICES constant ──────────────────────────────────────────────────────

describe('FUEL_PRICES', () => {
  it('covers starport classes A through X', () => {
    for (const cls of ['A', 'B', 'C', 'D', 'E', 'X']) {
      expect(FUEL_PRICES).toHaveProperty(cls)
    }
  })
})
