/**
 * Passenger, fuel, and mail contract engine.
 *
 * All functions are pure (no side-effects, no randomness).
 * Covers CT7 (Classic Traveller Book 7), T5 (Traveller 5th Edition), and
 * MgT2022 (Mongoose Traveller 2022).
 *
 * Key rule differences:
 *   CT7     passage fares — flat per jump regardless of parsec distance
 *   T5      passage fares — per parsec (High/Middle scale with distance)
 *   MgT2022 passage fares — per parsec, 4 tiers (adds Basic, which consumes
 *           general cargo tonnage instead of a dedicated stateroom/berth)
 *   Fuel pricing      — identical in all three; starport class determines availability
 *   Mail payment      — CT7 flat Cr25,000; T5 Cr25,000/parsec; MgT2022 flat
 *           Cr25,000 per 5-ton container, container count rolled separately
 *           (see trade-engine-mgt2022.js's mailAvailable/mailContainerCount)
 */

import { MGT2022_PASSAGE_FARES, MGT2022_BASIC_PASSAGE_TONS } from './traveller-data-mgt2022.js'
import { mailPaymentMgT2022 } from './trade-engine-mgt2022.js'

// ── Passage types ─────────────────────────────────────────────────────────────

export const PASSAGE_TYPES = ['high', 'middle', 'low']
export const PASSAGE_TYPES_MGT2022 = ['high', 'middle', 'basic', 'low']

export const PASSAGE_TYPE_LABELS = {
  high:   'High Passage',
  middle: 'Middle Passage',
  basic:  'Basic Passage',
  low:    'Low Passage',
}

// ── Passage fares ─────────────────────────────────────────────────────────────

/**
 * CT7 (Book 2) fares — flat per jump, not per parsec.
 * Source: Classic Traveller Book 2, Starships.
 */
const CT7_PASSAGE_FARES = {
  high:   10_000,
  middle:  8_000,
  low:     1_000,
}

/**
 * T5 fares — per parsec for High and Middle; Low is flat per berth.
 * Source: T5 "27 Trade and Commerce".
 */
const T5_PASSAGE_FARES_PER_PARSEC = {
  high:   10_000,
  middle:  8_000,
  low:     1_000,  // T5: Low passage is flat per berth, not scaled by parsecs
}

/**
 * Compute total fare for a passenger booking.
 *
 * @param {string} passageType  — 'high' | 'middle' | 'basic' | 'low'
 * @param {number} count        — number of passengers
 * @param {string} tradeRules   — 'CT7' | 'T5' | 'MgT2022'
 * @param {number} parsecs      — jump distance in parsecs (CT7: ignored except for low)
 * @returns {{ farePerHead: number, fareTotal: number }}
 */
export function passengerFare(passageType, count, tradeRules, parsecs = 1) {
  const safeParsecs = Math.max(1, Math.min(6, parsecs))
  let farePerHead

  if (tradeRules === 'MgT2022') {
    const table = MGT2022_PASSAGE_FARES[passageType] ?? []
    farePerHead = table[safeParsecs - 1] ?? 0
  } else if (tradeRules === 'T5') {
    const base = T5_PASSAGE_FARES_PER_PARSEC[passageType] ?? 0
    // Low passage is flat; High and Middle scale with parsecs
    farePerHead = passageType === 'low' ? base : base * safeParsecs
  } else {
    // CT7: all passage types are flat per jump
    farePerHead = CT7_PASSAGE_FARES[passageType] ?? 0
  }

  return {
    farePerHead,
    fareTotal: farePerHead * count,
  }
}

// ── Stateroom / berth capacity ─────────────────────────────────────────────────

/**
 * Tons/berths consumed by this passage booking.
 * High and Middle use staterooms (tracked separately from cargo hold).
 * Low uses low berths (also tracked separately).
 * Basic (MgT2022 only) uses general cargo tonnage instead of a dedicated
 * stateroom or berth — 2 tons of spare room per passenger.
 * These are counted against stateroom_capacity / low_berth_capacity /
 * cargo_capacity, never against each other.
 *
 * @param {string} passageType
 * @param {number} count
 * @returns {{ stateroomsNeeded: number, lowBerthsNeeded: number, cargoTonsNeeded: number }}
 */
export function passageCapacityNeeded(passageType, count) {
  if (passageType === 'low') {
    return { stateroomsNeeded: 0, lowBerthsNeeded: count, cargoTonsNeeded: 0 }
  }
  if (passageType === 'basic') {
    return { stateroomsNeeded: 0, lowBerthsNeeded: 0, cargoTonsNeeded: count * MGT2022_BASIC_PASSAGE_TONS }
  }
  return { stateroomsNeeded: count, lowBerthsNeeded: 0, cargoTonsNeeded: 0 }
}

// ── Fuel ──────────────────────────────────────────────────────────────────────

/**
 * Fuel availability and pricing by starport class.
 * A/B: refined fuel only (Cr500/ton)
 * C/D: unrefined fuel only (Cr100/ton)
 * E/X: no commercial fuel — wilderness refuelling or gas giant skimming only
 */
export const FUEL_PRICES = {
  A: { refined: 500,  unrefined: null },
  B: { refined: 500,  unrefined: null },
  C: { refined: null, unrefined: 100  },
  D: { refined: null, unrefined: 100  },
  E: { refined: null, unrefined: null },
  X: { refined: null, unrefined: null },
}

/**
 * Return the available fuel types (and their prices) at a given starport class.
 * Returns an empty object for classes without commercial fuel.
 *
 * @param {string} starportClass  — single letter A–X
 * @returns {{ refined?: number, unrefined?: number }}
 */
export function availableFuelTypes(starportClass) {
  const entry = FUEL_PRICES[starportClass?.toUpperCase()] ?? { refined: null, unrefined: null }
  const result = {}
  if (entry.refined   != null) result.refined   = entry.refined
  if (entry.unrefined != null) result.unrefined = entry.unrefined
  return result
}

/**
 * Jump fuel required for a given hull and parsec count.
 * Formula: 10% of hull tonnage per parsec.
 *
 * @param {number} hullTons
 * @param {number} parsecs
 * @returns {number} tons of fuel needed
 */
export function jumpFuelTons(hullTons, parsecs = 1) {
  return Math.ceil(hullTons * 0.1 * parsecs)
}

/**
 * Total cost for a fuel purchase.
 *
 * @param {number} tons         — tons being purchased
 * @param {number} pricePerTon  — Cr500 refined or Cr100 unrefined
 * @returns {number} total cost in Credits
 */
export function fuelCost(tons, pricePerTon) {
  return Math.round(tons * pricePerTon)
}

// ── Mail contracts ─────────────────────────────────────────────────────────────

/**
 * Mail payment per contract.
 * CT7:     Cr25,000 flat per consignment (one mail bag = 5 tons).
 * T5:      Cr25,000 per parsec.
 * MgT2022: Cr25,000 per 5-ton container, container count rolled separately
 *          (see trade-engine-mgt2022.js's mailContainerCount) — pass the
 *          rolled container count via `containerCount` for MgT2022.
 *
 * @param {string} tradeRules  — 'CT7' | 'T5' | 'MgT2022'
 * @param {number} parsecs
 * @param {number} [containerCount]  — MgT2022 only
 * @returns {number} payment in Credits
 */
export function mailPayment(tradeRules, parsecs = 1, containerCount = 1) {
  if (tradeRules === 'MgT2022') return mailPaymentMgT2022(containerCount)
  if (tradeRules === 'T5') return 25_000 * Math.max(1, parsecs)
  return 25_000  // CT7: flat
}
