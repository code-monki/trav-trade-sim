/**
 * Mongoose Traveller 2022 (MgT2022) trade engine.
 *
 * All functions are pure (no side-effects, no randomness injected here) —
 * callers supply dice rolls, mirroring trade-engine-ct7.js's convention so
 * results stay reproducible/testable and pluggable into the same seeded-RNG
 * scheme used by market-tick.js.
 *
 * Pipeline: Find-a-Supplier (starport DM) → Determine Goods Available (D66 +
 * Population DM, re-roll 61-65 unless black market) → Determine Purchase
 * Price (3D + Broker + Purchase DM - supplier's Broker) → Modified Price %
 * table → repeat mirrored for the sale side, deducting the *other* party's
 * Broker skill instead.
 */

import {
  MGT2022_TRADE_GOODS,
  MGT2022_MODIFIED_PRICE_TABLE,
  MGT2022_POPULATION_AVAIL_DM,
  MGT2022_FREIGHT_RATES,
  MGT2022_FREIGHT_LATE_PENALTY_DIE_MOD,
  MGT2022_MAIL_AVAILABLE_ROLL,
  MGT2022_MAIL_PAYMENT_PER_CONTAINER,
  MGT2022_STARPORT_TRAFFIC_DM,
  MGT2022_POPULATION_TRAFFIC_DM,
} from './traveller-data-mgt2022.js'

export { parseTradeCodes, starportFromUWP, techFromUWP } from './trade-engine-ct7.js'

// ── Find-a-Supplier ────────────────────────────────────────────────────────────

/**
 * Starport DM applied to the Find-a-Supplier skill check.
 * @param {string} starportClass — A/B/C/D/E/X
 * @returns {number}
 */
export function starportBrokerDM(starportClass) {
  return MGT2022_STARPORT_TRAFFIC_DM[starportClass?.toUpperCase()] ?? 0
}

// ── Determine Goods Available ──────────────────────────────────────────────────

/**
 * Population DM applied to the D66 goods-available roll.
 * @param {string|number} popDigit — UWP Population digit/letter (0-C)
 * @returns {number}
 */
export function goodsAvailableDM(popDigit) {
  return MGT2022_POPULATION_AVAIL_DM[String(popDigit).toUpperCase()] ?? 0
}

/**
 * Whether a D66 result requires a re-roll (61-65, unless seeking black
 * market goods, which is exactly what that band represents).
 * @param {string} die — two-digit D66 result, e.g. '63'
 * @param {boolean} seekingBlackMarket
 * @returns {boolean}
 */
export function isRerollRequired(die, seekingBlackMarket = false) {
  if (seekingBlackMarket) return false
  const n = parseInt(die, 10)
  return n >= 61 && n <= 65
}

/**
 * Resolve a D66 die result to its trade-good table entry.
 * @param {string} die
 * @returns {object|undefined}
 */
export function resolveGood(die) {
  return MGT2022_TRADE_GOODS.find(g => g.die === die)
}

/** Sum trade-code-keyed DMs (purchaseDMs/saleDMs) against a world's codes. */
export function sumTradeCodeDMs(dmList, worldCodes) {
  let total = 0
  for (const { code, dm } of dmList ?? []) {
    if (worldCodes.has(code)) total += dm
  }
  return total
}

// ── Determine Purchase / Sale Price ────────────────────────────────────────────

/**
 * Purchase roll total: 3D + Broker skill + Purchase DM - supplier's Broker skill.
 * @param {object} opts
 * @param {number} opts.threeDRoll         — pre-rolled 3D6 sum
 * @param {number} [opts.brokerSkill]      — buyer's Broker skill
 * @param {number} [opts.purchaseDM]       — good's trade-code purchase DM
 * @param {number} [opts.supplierBrokerSkill] — assumed 2 if not otherwise specified
 * @returns {number}
 */
export function purchaseRollTotal({ threeDRoll, brokerSkill = 0, purchaseDM = 0, supplierBrokerSkill = 2 }) {
  return threeDRoll + brokerSkill + purchaseDM - supplierBrokerSkill
}

/**
 * Sale roll total: 3D + Broker skill + Sale DM - purchaser's Broker skill.
 * @param {object} opts
 * @param {number} opts.threeDRoll
 * @param {number} [opts.brokerSkill]        — seller's Broker skill
 * @param {number} [opts.saleDM]             — good's trade-code sale DM
 * @param {number} [opts.purchaserBrokerSkill] — assumed 2 if not otherwise specified
 * @returns {number}
 */
export function saleRollTotal({ threeDRoll, brokerSkill = 0, saleDM = 0, purchaserBrokerSkill = 2 }) {
  return threeDRoll + brokerSkill + saleDM - purchaserBrokerSkill
}

/**
 * Look up the Modified Price % band for a roll total.
 * @param {number} rollTotal
 * @returns {{ purchasePct: number, salePct: number }}
 */
export function modifiedPricePct(rollTotal) {
  for (const band of MGT2022_MODIFIED_PRICE_TABLE) {
    const min = band.min ?? -Infinity
    const max = band.max ?? Infinity
    if (rollTotal >= min && rollTotal <= max) {
      return { purchasePct: band.purchasePct, salePct: band.salePct }
    }
  }
  // Fallback (should be unreachable — the table covers the full range)
  return { purchasePct: 100, salePct: 100 }
}

/**
 * Purchase price per ton.
 * @param {number} basePriceCr
 * @param {number} rollTotal
 * @returns {number}
 */
export function purchasePrice(basePriceCr, rollTotal) {
  return Math.round(basePriceCr * modifiedPricePct(rollTotal).purchasePct / 100)
}

/**
 * Sale price per ton.
 * @param {number} basePriceCr
 * @param {number} rollTotal
 * @returns {number}
 */
export function salePrice(basePriceCr, rollTotal) {
  return Math.round(basePriceCr * modifiedPricePct(rollTotal).salePct / 100)
}

// ── Freight ─────────────────────────────────────────────────────────────────────

/**
 * @param {string} lotSize — 'major' | 'minor' | 'incidental'
 * @param {number} parsecs — 1-6
 * @returns {number} Cr/ton
 */
export function freightRate(lotSize, parsecs) {
  const table = MGT2022_FREIGHT_RATES[lotSize]
  if (!table) return 0
  const idx = Math.min(6, Math.max(1, parsecs)) - 1
  return table[idx]
}

/**
 * @param {number} tons
 * @param {string} lotSize
 * @param {number} parsecs
 * @returns {number} total Cr charge
 */
export function freightCharge(tons, lotSize, parsecs) {
  return tons * freightRate(lotSize, parsecs)
}

/**
 * Late-delivery penalty percentage from a pre-rolled 1D.
 * Formula: (1D + 4) × 10%.
 * @param {number} oneDRoll — pre-rolled 1D6 (1-6)
 * @returns {number} percentage (e.g. 80 = 80%)
 */
export function freightLatePenaltyPct(oneDRoll) {
  return (oneDRoll + MGT2022_FREIGHT_LATE_PENALTY_DIE_MOD) * 10
}

/**
 * Net freight charge after applying a late-delivery penalty.
 * @param {number} charge      — full agreed freight charge
 * @param {number} penaltyPct  — from freightLatePenaltyPct()
 * @returns {number} net amount owed (may be 0 if the penalty exceeds 100%)
 */
export function freightNetAfterPenalty(charge, penaltyPct) {
  return Math.max(0, Math.round(charge * (1 - penaltyPct / 100)))
}

// ── Mail ────────────────────────────────────────────────────────────────────────

/** @param {number} twoDRoll — pre-rolled 2D6 @returns {boolean} */
export function mailAvailable(twoDRoll) {
  return twoDRoll >= MGT2022_MAIL_AVAILABLE_ROLL
}

/** @param {number} oneDRoll — pre-rolled 1D6 @returns {number} container count */
export function mailContainerCount(oneDRoll) {
  return oneDRoll
}

/** @param {number} containerCount @returns {number} total Cr payment */
export function mailPaymentMgT2022(containerCount) {
  return containerCount * MGT2022_MAIL_PAYMENT_PER_CONTAINER
}

// ── Smuggling risk (illegal goods vs. Law Level) ──────────────────────────────

/**
 * Detection-risk DM for selling an illegal good: higher Law Level makes
 * smuggling riskier; a higher Sale DM (better fences/contacts) offsets it.
 * Positive result = greater detection risk.
 * @param {number} saleDM     — the good's sale DM at this transaction
 * @param {number} lawLevel   — destination world's Law Level (0-9+)
 * @returns {number}
 */
export function smugglingRiskDM(saleDM, lawLevel) {
  return lawLevel - saleDM
}

// ── Traffic availability (passenger/freight/mail scarcity) ───────────────────

/**
 * Resolve a 2D6+DM roll into an availability count for one traffic category.
 * Baseline: a roll of 6 or less yields 0; each point above 6 yields one more
 * unit available (tier/lot-size differences are expressed via the DM table,
 * not this formula).
 * @param {number} twoDRoll
 * @param {number} dm
 * @returns {number}
 */
export function trafficCount(twoDRoll, dm) {
  return Math.max(0, twoDRoll + dm - 6)
}

export { MGT2022_STARPORT_TRAFFIC_DM, MGT2022_POPULATION_TRAFFIC_DM }
