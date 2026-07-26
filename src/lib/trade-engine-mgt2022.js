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
  MGT2022_STARPORT_SUPPLIER_DM,
  MGT2022_POPULATION_TRAFFIC_DM,
} from './traveller-data-mgt2022.js'

export { parseTradeCodes, starportFromUWP, techFromUWP, lawFromUWP } from './trade-engine-ct7.js'

// ── Characteristics ───────────────────────────────────────────────────────────

/**
 * Standard Traveller characteristic-to-DM scale. Used by Mail's "highest
 * SOC DM among the crew" bonus; available for any future characteristic-
 * based check.
 * @param {number|null} value — a characteristic score (2-15+), or null/
 *   undefined if the player hasn't had it recorded yet
 * @returns {number}
 */
export function characteristicDM(value) {
  if (value == null) return 0
  if (value <= 2)  return -2
  if (value <= 5)  return -1
  if (value <= 8)  return 0
  if (value <= 11) return +1
  return +2
}

// ── Find-a-Supplier ────────────────────────────────────────────────────────────

/**
 * Starport DM applied to the Find-a-Supplier skill check. Distinct from
 * MGT2022_STARPORT_TRAFFIC_DM (Freight/Mail's own starport DM) — same
 * starport-class key, different mechanic, different values.
 * @param {string} starportClass — A/B/C/D/E/X
 * @returns {number}
 */
export function starportBrokerDM(starportClass) {
  return MGT2022_STARPORT_SUPPLIER_DM[starportClass?.toUpperCase()] ?? 0
}

/** Average(8+) target for the Find-a-Supplier check. */
export const MGT2022_FIND_SUPPLIER_TARGET = 8

/**
 * Find-a-Supplier roll total: 2D + skill + starport DM - DM-1 per previous
 * attempt on this world this (game) month. A fresh roll each attempt —
 * the seeded 2D6 should vary per attempt at the call site (e.g. seed
 * including the attempt count), not be the same roll reused.
 * @param {object} opts
 * @param {number} opts.twoDRoll          — pre-rolled 2D6 sum
 * @param {number} [opts.skillLevel]      — Broker/Streetwise/Admin skill level
 * @param {number} [opts.starportDM]      — from starportBrokerDM()
 * @param {number} [opts.previousAttempts] — attempts already made this world/month
 * @returns {{ total: number, success: boolean }}
 */
export function findSupplierRoll({ twoDRoll, skillLevel = 0, starportDM = 0, previousAttempts = 0 }) {
  const total = twoDRoll + skillLevel + starportDM - previousAttempts
  return { total, success: total >= MGT2022_FIND_SUPPLIER_TARGET }
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

/**
 * Largest matching trade-code-keyed DM (purchaseDMs/saleDMs) against a
 * world's codes — "in cases where multiple Purchase or Sale DMs apply, use
 * only the largest from each column," not their sum.
 */
export function maxTradeCodeDMs(dmList, worldCodes) {
  let best = 0
  let any  = false
  for (const { code, dm } of dmList ?? []) {
    if (worldCodes.has(code) && (!any || dm > best)) { best = dm; any = true }
  }
  return best
}

// ── Determine Purchase / Sale Price ────────────────────────────────────────────

/**
 * Purchase roll total: 3D + Broker skill + Purchase DM - Sale DM -
 * supplier's Broker skill. Both trade-code DM columns apply when
 * purchasing (added Purchase DM, subtracted Sale DM per the book) — pass
 * `purchaseDM` as the already-combined net value (maxTradeCodeDMs(good.purchaseDMs, codes)
 * - maxTradeCodeDMs(good.saleDMs, codes)), not just the good's raw purchase
 * column.
 * @param {object} opts
 * @param {number} opts.threeDRoll         — pre-rolled 3D6 sum
 * @param {number} [opts.brokerSkill]      — buyer's Broker skill
 * @param {number} [opts.purchaseDM]       — net DM: Purchase column - Sale column
 * @param {number} [opts.supplierBrokerSkill] — assumed 2 if not otherwise specified
 * @returns {number}
 */
export function purchaseRollTotal({ threeDRoll, brokerSkill = 0, purchaseDM = 0, supplierBrokerSkill = 2 }) {
  return threeDRoll + brokerSkill + purchaseDM - supplierBrokerSkill
}

/**
 * Sale roll total: 3D + Broker skill + Sale DM - Purchase DM - purchaser's
 * Broker skill. Mirror of purchaseRollTotal — pass `saleDM` as the
 * already-combined net value (maxTradeCodeDMs(good.saleDMs, codes) -
 * maxTradeCodeDMs(good.purchaseDMs, codes)).
 * @param {object} opts
 * @param {number} opts.threeDRoll
 * @param {number} [opts.brokerSkill]        — seller's Broker skill
 * @param {number} [opts.saleDM]             — net DM: Sale column - Purchase column
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
 * Freight pays a flat rate depending only on distance, not lot size —
 * "Freight shipments pay a fixed rate as shown on the Passage and Freight
 * table."
 * @param {number} parsecs — 1-6
 * @returns {number} Cr/ton
 */
export function freightRate(parsecs) {
  const idx = Math.min(6, Math.max(1, parsecs)) - 1
  return MGT2022_FREIGHT_RATES[idx]
}

/**
 * @param {number} tons
 * @param {number} parsecs
 * @returns {number} total Cr charge
 */
export function freightCharge(tons, parsecs) {
  return tons * freightRate(parsecs)
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

// ── Smuggling risk (banned goods vs. Law Level) ───────────────────────────────

/**
 * Extra Sale DM for a good banned at a specific Law Level: "their Sale DM
 * is the difference between the Law Level they are banned at and the Law
 * Level of the world" — the book's own worked example: Military Weapons
 * banned at LL3, smuggled onto an LL9 world, get Sale DM+6 (= 9 - 3). Zero
 * (not negative) if the world's own Law Level hasn't reached the ban
 * threshold — the good just isn't banned there. Only applies to the
 * handful of goods with a book-given bannedLawLevel (see
 * MGT2022_TRADE_GOODS); other illegal goods keep their flat elevated Sale
 * DM as-is, with no per-good threshold to compute against.
 * @param {number|null} bannedLawLevel — the good's `bannedLawLevel` field
 * @param {number} worldLawLevel       — destination world's Law Level (0-15)
 * @returns {number}
 */
export function smugglingRiskDM(bannedLawLevel, worldLawLevel) {
  if (bannedLawLevel == null) return 0
  return Math.max(0, worldLawLevel - bannedLawLevel)
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
