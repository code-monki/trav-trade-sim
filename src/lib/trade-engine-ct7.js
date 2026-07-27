/**
 * Classic Traveller Book 7 — Merchant Prince trade engine.
 *
 * All functions are pure (no side-effects, no randomness injected here).
 * Callers supply dice rolls so results are reproducible and testable.
 *
 * Key references:
 *   costOfGoods()      — Cost of Goods table (source world)
 *   marketBasePrice()  — Market Price table (source × market trade codes)
 *   actualValue()      — Actual Value table (2d6 roll → % of base)
 *   brokerEffect()     — Broker skill DM and fee
 *   tlAdjustment()     — TL delta effect on selling price
 *   parseTradeCodes()  — Extract trade code set from UWP Remarks string
 *   rollQty()          — Resolve a Book 2 qty expression (e.g. "3Dx5") given rolls
 */

import {
  CT7_COST_MODS,
  CT7_STARPORT_COST_MODS,
  CT7_MARKET_PRICE_TABLE,
  CT7_ACTUAL_VALUE,
} from './traveller-data.js'

// ── Trade code parsing ────────────────────────────────────────────────────────

const KNOWN_TRADE_CODES = new Set([
  'Ag','As','Ba','De','Fl','Ga','Hi','Ht','Ic','In','Lo','Lt','Na','Ni','Po','Ri','Va','Wa',
])

/**
 * Extract the set of T5/CT trade codes from a world's Remarks field.
 * Returns a Set<string> of uppercase codes, e.g. Set{'Ag','Ri'}.
 */
export function parseTradeCodes(remarks = '') {
  const codes = new Set()
  for (const token of remarks.trim().split(/\s+/)) {
    const t = token.trim()
    if (KNOWN_TRADE_CODES.has(t)) codes.add(t)
  }
  return codes
}

/**
 * Extract the starport class (single letter) from a UWP string.
 * UWP format: SABCDEF-T  (first char = starport)
 */
export function starportFromUWP(uwp = '') {
  return uwp[0]?.toUpperCase() ?? 'X'
}

/**
 * Extract the tech level digit/letter from a UWP string.
 * UWP format: SABCDEF-T  (after the dash)
 */
export function techFromUWP(uwp = '') {
  const parts = uwp.split('-')
  return parts[1]?.trim() ?? '0'
}

/**
 * Extract the Law Level (0-9, A-F hex glyph per UWP_LAW) as an integer from
 * a UWP string. UWP format: SABCDEF-T (Law Level is the 7th character,
 * index 6, before the dash).
 */
export function lawFromUWP(uwp = '') {
  const main = uwp.split('-')[0] ?? ''
  const n = parseInt(main[6], 16)
  return isNaN(n) ? 0 : n
}

// Convert TL glyph (0–9, A–Z) to integer
function tlToInt(tl) {
  const n = parseInt(tl, 16)
  return isNaN(n) ? 0 : n
}

// ── Cost of Goods (source world purchase price) ───────────────────────────────

/**
 * Compute the cost-of-goods per ton for freight purchased at a source world.
 *
 * Formula (Book 7):
 *   base Cr4,000
 *   + Σ CT7_COST_MODS for each matching source trade code
 *   + CT7_STARPORT_COST_MODS for source starport class
 *   + sourceTL × 100
 *
 * @param {Set<string>} sourceCodes  — trade codes of the source world
 * @param {string}      starport     — starport class letter (A–X)
 * @param {string|number} tl         — tech level of source world
 * @returns {number} cost in Credits per ton (never < 0)
 */
export function costOfGoods(sourceCodes, starport, tl) {
  let cost = 4000
  for (const code of sourceCodes) {
    cost += CT7_COST_MODS[code] ?? 0
  }
  cost += CT7_STARPORT_COST_MODS[starport?.toUpperCase()] ?? 0
  cost += tlToInt(tl) * 100
  return Math.max(0, cost)
}

// ── Market base price (destination world) ────────────────────────────────────

/**
 * Compute the base market price per ton at a destination world.
 *
 * Formula (Book 7):
 *   base Cr5,000
 *   + Σ CT7_MARKET_PRICE_TABLE[srcCode][mktCode] × 1000
 *     for every (srcCode, mktCode) pair where both worlds have those codes
 *
 * @param {Set<string>} sourceCodes  — trade codes of the source (purchase) world
 * @param {Set<string>} marketCodes  — trade codes of the market (sale) world
 * @returns {number} base market price in Credits per ton
 */
export function marketBasePrice(sourceCodes, marketCodes) {
  let price = 5000
  for (const src of sourceCodes) {
    const row = CT7_MARKET_PRICE_TABLE[src]
    if (!row) continue
    for (const mkt of marketCodes) {
      price += (row[mkt] ?? 0) * 1000
    }
  }
  return Math.max(0, price)
}

// ── TL adjustment ─────────────────────────────────────────────────────────────

/**
 * TL adjustment: a high-tech source selling into a low-tech market is
 * advantageous (price increases); a low-tech source selling into a
 * high-tech market is disadvantageous (price decreases). Applies in both
 * directions — unlike a simple "no effect unless advantageous" rule.
 *
 * Formula: pct = (sourceTL - marketTL) × 10%; adjusted = basePrice × (1 + pct)
 * A decrease of 100% or more means the goods have no value at that market
 * (floored at 0 here; callers apply their own "must be worth something"
 * minimum on top, same as every other price floor in this codebase).
 *
 * @param {string|number} sourceTL
 * @param {string|number} marketTL
 * @param {number}        basePrice
 * @returns {number} adjusted price (may be more or less than basePrice, never negative)
 */
export function tlAdjustment(sourceTL, marketTL, basePrice) {
  const delta = tlToInt(sourceTL) - tlToInt(marketTL)
  const pct   = delta * 0.1
  return Math.max(0, basePrice * (1 + pct))
}

// ── Actual Value table ────────────────────────────────────────────────────────

/**
 * Look up the actual-value multiplier for a given 2d6 roll total.
 * Clamps to the table range [2, 15].
 *
 * @param {number} roll2d6  — raw 2d6 result (2–12) plus any DMs
 * @returns {number} multiplier (e.g. 1.0 = 100%, 1.5 = 150%)
 */
export function actualValueMultiplier(roll2d6) {
  const clamped = Math.max(2, Math.min(15, roll2d6))
  return CT7_ACTUAL_VALUE[clamped] ?? 1.0
}

/**
 * Compute the actual sale price per ton.
 *
 * @param {number} basePrice   — from marketBasePrice() after tlAdjustment()
 * @param {number} roll2d6     — 2d6 roll + all DMs (broker, trade codes, etc.)
 * @returns {number} actual price per ton (rounded to nearest Credit)
 */
export function actualPrice(basePrice, roll2d6) {
  return Math.round(basePrice * actualValueMultiplier(roll2d6))
}

// ── Broker ────────────────────────────────────────────────────────────────────

/**
 * Broker DM added to the Actual Value roll.
 * Max skill applied is 4.
 *
 * @param {number} brokerSkill — broker's skill level (0–4+)
 * @returns {number} DM to add to 2d6 roll
 */
export function brokerDM(brokerSkill) {
  return Math.min(4, Math.max(0, brokerSkill))
}

/**
 * Broker fee: 5% × skill × final transaction price — what a HIRED NPC
 * broker charges, paid regardless of profit/loss. This app has no NPC-
 * hiring flow (every Broker skill used is the acting player's own), so
 * this raw formula isn't charged directly anywhere — see
 * `brokerSelfServiceGain` below for what actually applies.
 *
 * @param {number} brokerSkill  — broker's skill level
 * @param {number} finalPrice   — total transaction value (price × tons)
 * @returns {number} fee in Credits
 */
export function brokerFee(brokerSkill, finalPrice) {
  const skill = Math.min(4, Math.max(0, brokerSkill))
  return Math.round(0.05 * skill * finalPrice)
}

/**
 * A player-character using their OWN Broker skill to arrange a sale
 * (rather than hiring an NPC) receives the standard brokerage fee for
 * doing so, but is assumed to spend half of it arranging the sale — net
 * effect: they keep half of `brokerFee()` as pure profit on top of the
 * sale, rather than paying the full fee out as a hired broker would.
 *
 * @param {number} brokerSkill
 * @param {number} finalPrice
 * @returns {number} net gain in Credits, added to sale proceeds
 */
export function brokerSelfServiceGain(brokerSkill, finalPrice) {
  return Math.round(0.5 * brokerFee(brokerSkill, finalPrice))
}

// ── Quantity resolver (Book 2) ────────────────────────────────────────────────

/**
 * Resolve a Book 2 quantity expression against pre-rolled dice.
 *
 * Expression format examples: "3Dx5", "1D", "2Dx10", "8Dx5"
 * Each "D" represents one d6 roll supplied in the `rolls` array.
 *
 * @param {string}   expr   — qty expression from CT2_TRADE_GOODS[n].qty
 * @param {number[]} rolls  — array of d6 results (must have at least <numDice> entries)
 * @param {number}   [dm]   — DM applied to the dice sum before the ×multiplier
 *                            (MgT2022's population availability DM; unused by CT7/T5 callers)
 * @returns {number} quantity in tons
 */
export function rollQty(expr, rolls, dm = 0) {
  const match = expr.match(/^(\d+)D(?:x(\d+))?$/i)
  if (!match) return 0
  const numDice = parseInt(match[1], 10)
  const multiplier = match[2] ? parseInt(match[2], 10) : 1
  let total = dm
  for (let i = 0; i < numDice; i++) {
    total += rolls[i] ?? 1
  }
  return total * multiplier
}

// ── Full purchase/sale calculation helpers ────────────────────────────────────

/**
 * Calculate the complete speculative trade result for one cargo lot.
 *
 * @param {object} opts
 * @param {Set<string>} opts.sourceCodes   — trade codes of purchase world
 * @param {string}      opts.sourceUWP     — UWP of purchase world
 * @param {Set<string>} opts.marketCodes   — trade codes of sale world
 * @param {string}      opts.marketUWP     — UWP of sale world
 * @param {number}      opts.tons          — cargo size in tons
 * @param {number}      opts.purchaseRoll  — 2d6 + DMs for purchase actual value
 * @param {number}      opts.saleRoll      — 2d6 + DMs for sale actual value
 * @param {number}      [opts.brokerSkill] — broker skill at point of sale (default 0)
 *
 * @returns {{
 *   costPerTon: number,
 *   totalCost: number,
 *   marketBasePerTon: number,
 *   tlAdjustedPerTon: number,
 *   purchaseMultiplier: number,
 *   purchasePricePerTon: number,
 *   salePricePerTon: number,
 *   totalRevenue: number,
 *   brokerGainTotal: number,
 *   netProfit: number,
 * }}
 */
export function tradeResult(opts) {
  const {
    sourceCodes, sourceUWP,
    marketCodes, marketUWP,
    tons,
    purchaseRoll, saleRoll,
    brokerSkill = 0,
  } = opts

  const sourceStarport = starportFromUWP(sourceUWP)
  const sourceTL       = techFromUWP(sourceUWP)
  const marketTL       = techFromUWP(marketUWP)

  const costPerTon           = costOfGoods(sourceCodes, sourceStarport, sourceTL)
  const purchaseMultiplier   = actualValueMultiplier(purchaseRoll)
  const purchasePricePerTon  = Math.round(costPerTon * purchaseMultiplier)
  const totalCost            = purchasePricePerTon * tons

  const marketBasePerTon   = marketBasePrice(sourceCodes, marketCodes)
  const tlAdjustedPerTon   = Math.round(tlAdjustment(sourceTL, marketTL, marketBasePerTon))
  const saleRollTotal      = saleRoll + brokerDM(brokerSkill)
  const salePricePerTon    = actualPrice(tlAdjustedPerTon, saleRollTotal)
  const totalRevenue       = salePricePerTon * tons
  const brokerGainTotal    = brokerSelfServiceGain(brokerSkill, totalRevenue)
  const netProfit          = totalRevenue - totalCost + brokerGainTotal

  return {
    costPerTon,
    totalCost,
    marketBasePerTon,
    tlAdjustedPerTon,
    purchaseMultiplier,
    purchasePricePerTon,
    salePricePerTon,
    totalRevenue,
    brokerGainTotal,
    netProfit,
  }
}
