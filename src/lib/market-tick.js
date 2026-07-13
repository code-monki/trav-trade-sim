/**
 * Market tick engine — deterministic world snapshot generation.
 *
 * Prices are seeded by (campaignId + worldHex + goodDie + tick) so every
 * client produces identical values for the same inputs. No server-side
 * randomness needed.
 *
 * Dispatches on campaign.trade_rules to the correct per-ruleset generator.
 * Prior to this refactor, T5 campaigns were silently generated with CT7
 * pricing (this function never branched on trade_rules at all) — that bug
 * is fixed here alongside adding the MgT2022 branch.
 *
 * Calendar model (simplified Imperial):
 *   1 tick  = 1 jump-week (7 days)
 *   1 month = TICKS_PER_MONTH ticks  (4 × 7 = 28 days)
 *   1 year  = TICKS_PER_YEAR ticks   (48 × 7 = 336 days, close enough)
 *   Base year = 1105 (Classic Era)
 */

import { CT2_TRADE_GOODS, CT2_CODE_MAP } from './traveller-data.js'
import { MGT2022_TRADE_GOODS } from './traveller-data-mgt2022.js'
import {
  parseTradeCodes as ct7ParseTradeCodes,
  starportFromUWP as ct7StarportFromUWP,
  techFromUWP as ct7TechFromUWP,
  costOfGoods,
  marketBasePrice,
  actualValueMultiplier,
  actualPrice,
  rollQty,
} from './trade-engine-ct7.js'
import {
  parseTradeCodes as t5ParseTradeCodes,
  starportFromUWP as t5StarportFromUWP,
  techFromUWP as t5TechFromUWP,
  t5CostOfGoods,
  t5SellingPrice,
  t5ActualValueMultiplier,
  t5ActualPrice,
} from './trade-engine-t5.js'
import {
  starportFromUWP as mgt2022StarportFromUWP,
  techFromUWP as mgt2022TechFromUWP,
  sumTradeCodeDMs,
  purchaseRollTotal,
  saleRollTotal,
  purchasePrice as mgt2022PurchasePrice,
  salePrice as mgt2022SalePrice,
} from './trade-engine-mgt2022.js'
import { parseTradeCodes as mgt2022ParseTradeCodes } from './traveller-data-mgt2022.js'

export const TICKS_PER_MONTH = 4
export const TICKS_PER_YEAR  = 48   // 12 × TICKS_PER_MONTH
export const BASE_YEAR       = 1105

// ── Calendar helpers ──────────────────────────────────────────────────────────

export function tickToCalendar(tick) {
  const weekInYear = tick % TICKS_PER_YEAR
  const year       = BASE_YEAR + Math.floor(tick / TICKS_PER_YEAR)
  const day        = weekInYear * 7 + 1
  const month      = Math.floor(weekInYear / TICKS_PER_MONTH) + 1
  return { year, day, month }
}

/** Format tick as Imperial date string, e.g. "042-1106" */
export function formatImperialDate(tick) {
  const { year, day } = tickToCalendar(tick)
  return `${String(day).padStart(3, '0')}-${year}`
}

export function shouldRollupMonth(tick) { return tick > 0 && tick % TICKS_PER_MONTH === 0 }
export function shouldRollupYear(tick)  { return tick > 0 && tick % TICKS_PER_YEAR  === 0 }

// ── Seeded deterministic RNG (FNV-1a hash + mulberry32) ───────────────────────
// Same seed always produces the same sequence → all players see identical prices.

function fnv1a(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

export function makeRng(seedStr) {
  let s = fnv1a(seedStr)
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

function d6(rng) { return Math.floor(rng() * 6) + 1 }

// ── CT2 DM helper (shared by CT7 and T5, which both draw goods from the same
//    Book 2 table) ────────────────────────────────────────────────────────────

function sumCT2DMs(dmList, worldCodes) {
  let total = 0
  for (const { code, dm } of dmList) {
    const full = CT2_CODE_MAP[code]
    if (full && worldCodes.has(full)) total += dm
  }
  return total
}

function applyEventMods(purchasePrice, salePrice, goodDie, buyMods, sellMods) {
  const buyMod  = (buyMods[goodDie]  ?? 0) + (buyMods['__all__']  ?? 0)
  const sellMod = (sellMods[goodDie] ?? 0) + (sellMods['__all__'] ?? 0)
  return {
    purchasePrice: buyMod  !== 0 ? Math.round(purchasePrice * (1 + buyMod  / 100)) : purchasePrice,
    salePrice:     sellMod !== 0 ? Math.round(salePrice     * (1 + sellMod / 100)) : salePrice,
  }
}

function buildEventMods(activeEvents) {
  const buyMods  = {}
  const sellMods = {}
  for (const ev of activeEvents) {
    const key = ev.trade_good_die ?? '__all__'
    if (ev.buy_modifier_pct  != null) buyMods[key]  = (buyMods[key]  ?? 0) + ev.buy_modifier_pct
    if (ev.sell_modifier_pct != null) sellMods[key] = (sellMods[key] ?? 0) + ev.sell_modifier_pct
  }
  return { buyMods, sellMods }
}

// ── CT7 snapshot ───────────────────────────────────────────────────────────────

function generateCT7Snapshot({ world, sectorName, campaignId, tick, activeEvents = [] }) {
  const codes    = ct7ParseTradeCodes(world.Remarks || '')
  const starport = ct7StarportFromUWP(world.UWP || '')
  const tl       = ct7TechFromUWP(world.UWP || '')
  const { buyMods, sellMods } = buildEventMods(activeEvents)

  const rows = []
  for (const good of CT2_TRADE_GOODS) {
    const rng = makeRng(`${campaignId}:${world.Hex}:${good.die}:${tick}:v1`)

    const purchaseDM = sumCT2DMs(good.purchaseDMs, codes)
    const saleDM     = sumCT2DMs(good.resaleDMs,   codes)

    const purchaseRoll = d6(rng) + d6(rng) + purchaseDM
    let purchasePriceVal = Math.round(
      costOfGoods(codes, starport, tl) * actualValueMultiplier(purchaseRoll)
    )

    const saleRoll = d6(rng) + d6(rng) + saleDM
    let salePriceVal = actualPrice(marketBasePrice(codes, codes), saleRoll)

    const adjusted = applyEventMods(purchasePriceVal, salePriceVal, good.die, buyMods, sellMods)
    purchasePriceVal = adjusted.purchasePrice
    salePriceVal     = adjusted.salePrice

    const qtyRolls = Array.from({ length: 8 }, () => d6(rng))
    const qty      = rollQty(good.qty, qtyRolls)

    rows.push({
      campaign_id:     campaignId,
      world_hex:       world.Hex,
      sector:          sectorName,
      trade_good_die:  good.die,
      trade_good_name: good.name,
      tick,
      purchase_price:  Math.max(1, purchasePriceVal),
      sale_price:      Math.max(1, salePriceVal),
      qty_available:   Math.max(0, qty),
      source_codes:    [...codes].join(' '),
    })
  }
  return rows
}

// ── T5 snapshot ────────────────────────────────────────────────────────────────
// Reuses the same 36-entry CT2_TRADE_GOODS table (T5 defines no goods table
// of its own in this codebase) but prices each good with T5's cost/selling/
// actual-value functions instead of CT7's — this is the fix for the
// pre-existing bug where T5 campaigns silently got CT7 pricing.

function generateT5Snapshot({ world, sectorName, campaignId, tick, activeEvents = [] }) {
  const codes = t5ParseTradeCodes(world.Remarks || '')
  const tl    = t5TechFromUWP(world.UWP || '')
  const { buyMods, sellMods } = buildEventMods(activeEvents)

  const rows = []
  for (const good of CT2_TRADE_GOODS) {
    const rng = makeRng(`${campaignId}:${world.Hex}:${good.die}:${tick}:v1`)

    const purchaseDM = sumCT2DMs(good.purchaseDMs, codes)
    const saleDM     = sumCT2DMs(good.resaleDMs,   codes)

    // T5 uses flux (1D-1D, range -5..+5), not 2d6
    const purchaseFlux = d6(rng) - d6(rng) + purchaseDM
    let purchasePriceVal = Math.round(
      t5CostOfGoods(codes, tl) * t5ActualValueMultiplier(purchaseFlux)
    )

    const saleFlux = d6(rng) - d6(rng) + saleDM
    const tradePrice = t5SellingPrice(codes, codes, tl, tl)
    let salePriceVal = t5ActualPrice(tradePrice, saleFlux)

    const adjusted = applyEventMods(purchasePriceVal, salePriceVal, good.die, buyMods, sellMods)
    purchasePriceVal = adjusted.purchasePrice
    salePriceVal     = adjusted.salePrice

    const qtyRolls = Array.from({ length: 8 }, () => d6(rng))
    const qty      = rollQty(good.qty, qtyRolls)

    rows.push({
      campaign_id:     campaignId,
      world_hex:       world.Hex,
      sector:          sectorName,
      trade_good_die:  good.die,
      trade_good_name: good.name,
      tick,
      purchase_price:  Math.max(1, purchasePriceVal),
      sale_price:      Math.max(1, salePriceVal),
      qty_available:   Math.max(0, qty),
      source_codes:    [...codes].join(' '),
    })
  }
  return rows
}

// ── MgT2022 snapshot ───────────────────────────────────────────────────────────
// Uses MgT2022's own 36-entry goods table and the 3D-based Modified Price %
// pipeline (see trade-engine-mgt2022.js), with supplier/purchaser Broker
// skill both assumed at 2 for automatic tick generation (no live NPC broker
// is being simulated here — see trade-engine-mgt2022.js's docstring).

function generateMgT2022Snapshot({ world, sectorName, campaignId, tick, activeEvents = [] }) {
  const codes = mgt2022ParseTradeCodes(world.Remarks || '')
  const { buyMods, sellMods } = buildEventMods(activeEvents)
  void mgt2022StarportFromUWP; void mgt2022TechFromUWP // reserved for Find-a-Supplier/TL-based extensions

  const rows = []
  for (const good of MGT2022_TRADE_GOODS) {
    const rng = makeRng(`${campaignId}:${world.Hex}:${good.die}:${tick}:v1`)

    const purchaseDM = sumTradeCodeDMs(good.purchaseDMs, codes)
    const saleDM     = sumTradeCodeDMs(good.saleDMs,     codes)

    const purchaseThreeD = d6(rng) + d6(rng) + d6(rng)
    const purchaseRoll   = purchaseRollTotal({ threeDRoll: purchaseThreeD, purchaseDM })
    let purchasePriceVal = mgt2022PurchasePrice(good.basePriceCr, purchaseRoll)

    const saleThreeD = d6(rng) + d6(rng) + d6(rng)
    const saleRoll    = saleRollTotal({ threeDRoll: saleThreeD, saleDM })
    let salePriceVal  = mgt2022SalePrice(good.basePriceCr, saleRoll)

    const adjusted = applyEventMods(purchasePriceVal, salePriceVal, good.die, buyMods, sellMods)
    purchasePriceVal = adjusted.purchasePrice
    salePriceVal     = adjusted.salePrice

    const qtyRolls = Array.from({ length: 8 }, () => d6(rng))
    const qty      = rollQty(good.qty, qtyRolls)

    rows.push({
      campaign_id:     campaignId,
      world_hex:       world.Hex,
      sector:          sectorName,
      trade_good_die:  good.die,
      trade_good_name: good.name,
      tick,
      purchase_price:  Math.max(1, purchasePriceVal),
      sale_price:      Math.max(1, salePriceVal),
      qty_available:   Math.max(0, qty),
      source_codes:    [...codes].join(' '),
    })
  }
  return rows
}

// ── Dispatch ───────────────────────────────────────────────────────────────────

/**
 * Generate all 36 trade-good snapshots for one world at one tick, using
 * whichever ruleset's pricing formulas match the campaign.
 *
 * @param {object}   opts.world         — Traveller Map world object {Hex, UWP, Remarks, ...}
 * @param {string}   opts.sectorName    — sector display name
 * @param {string}   opts.campaignId    — campaign UUID
 * @param {number}   opts.tick          — current tick
 * @param {object[]} opts.activeEvents  — [{trade_good_die, buy_modifier_pct, sell_modifier_pct}] active at this tick/world
 * @param {string}   [opts.tradeRules]  — 'CT7' | 'T5' | 'MgT2022' (default 'CT7')
 * @returns {object[]} rows for market_snapshots bulk insert
 */
export function generateWorldSnapshot({ world, sectorName, campaignId, tick, activeEvents = [], tradeRules = 'CT7' }) {
  switch (tradeRules) {
    case 'T5':      return generateT5Snapshot({ world, sectorName, campaignId, tick, activeEvents })
    case 'MgT2022': return generateMgT2022Snapshot({ world, sectorName, campaignId, tick, activeEvents })
    default:        return generateCT7Snapshot({ world, sectorName, campaignId, tick, activeEvents })
  }
}
