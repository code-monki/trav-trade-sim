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
  ct2SearchGoodDie,
  actualPrice,
  rollQty,
  brokerDM,
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
  lawFromUWP as mgt2022LawFromUWP,
  maxTradeCodeDMs,
  purchaseRollTotal,
  saleRollTotal,
  purchasePrice as mgt2022PurchasePrice,
  salePrice as mgt2022SalePrice,
  goodsAvailableDM,
  smugglingRiskDM,
  isRerollRequired,
  resolveGood,
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

// ── CT7 snapshot (Book 2 Trade & Speculation) ───────────────────────────────────
//
// Book 2's own procedure is self-contained: each named good has its own
// `basePriceCr`, and both purchase and resale price are that base price ×
// the Actual Value table (2D6 + purchase/resaleDMs from whichever world
// you're at). There is no separate "Cost of Goods"/"Market Price Table"
// formula and no source-vs-market duality — those are Book 7 Merchant
// Prince's own, incompatible abstract-commodity mechanics (kept in
// trade-engine-ct7.js as unused pure functions; see DEVLOG), previously
// applied here by mistake in place of each good's own base price.
//
// Which goods are even on offer is itself a search procedure, not a fixed
// list: "the referee throws two dice... to create a number between 11 and
// 66 [with a population DM on the first digit]... This throw may be made
// once per week." Only one throw per week is RAW; this app extends that
// to 1D6 independent throws per tick so the market isn't reduced to
// exactly one good, reusing the identical single-throw procedure each time.

// A good found more than once in the same week's searches stacks quantity
// rather than duplicating the row — same convention as MgT2022's
// composition. Own RNG stream, separate from any good's own price/qty
// rolls below, so the lot count or a repeat hit never shifts where a
// good's own draws start from.
function ct2Composition(rng, popDigit, lotCount) {
  const hits = new Map()
  for (let i = 0; i < lotCount; i++) {
    const die = ct2SearchGoodDie(d6(rng), d6(rng), popDigit)
    if (!CT2_TRADE_GOODS.some(g => g.die === die)) continue // table covers the full 11-66 range; defensive only
    hits.set(die, (hits.get(die) ?? 0) + 1)
  }
  return hits
}

function generateCT7Snapshot({ world, sectorName, campaignId, tick, activeEvents = [] }) {
  const codes    = ct7ParseTradeCodes(world.Remarks || '')
  const popDigit = (world.UWP || '')[4]
  const { buyMods, sellMods } = buildEventMods(activeEvents)

  const lotCountRng = makeRng(`${campaignId}:${world.Hex}:lotcount:${tick}:v1`)
  const lotCount     = d6(lotCountRng)

  const compositionRng = makeRng(`${campaignId}:${world.Hex}:composition:${tick}:v1`)
  const hits = ct2Composition(compositionRng, popDigit, lotCount)

  const rows = []
  for (const good of CT2_TRADE_GOODS) {
    const hitCount = hits.get(good.die)
    if (!hitCount) continue

    const rng = makeRng(`${campaignId}:${world.Hex}:${good.die}:${tick}:v1`)

    const purchaseDM = sumCT2DMs(good.purchaseDMs, codes)
    const saleDM     = sumCT2DMs(good.resaleDMs,   codes)

    const purchaseRoll   = d6(rng) + d6(rng) + purchaseDM
    let purchasePriceVal = actualPrice(good.basePriceCr, purchaseRoll)

    const saleRoll   = d6(rng) + d6(rng) + saleDM
    let salePriceVal = actualPrice(good.basePriceCr, saleRoll)

    const adjusted = applyEventMods(purchasePriceVal, salePriceVal, good.die, buyMods, sellMods)
    purchasePriceVal = adjusted.purchasePrice
    salePriceVal     = adjusted.salePrice

    // One quantity roll per hit — a good found more than once this week
    // stacks quantity rather than duplicating the row.
    let qty = 0
    for (let i = 0; i < hitCount; i++) {
      const qtyRolls = Array.from({ length: 8 }, () => d6(rng))
      qty += rollQty(good.qty, qtyRolls)
    }

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

function isGoodAvailableAt(good, codes) {
  return good.availability === 'All' || good.availability.some(code => codes.has(code))
}

function rollD66(rng) { return `${d6(rng)}${d6(rng)}` }

// Black market extras don't roll the full D66 range and hope to land on
// 61-66 — they specifically deal in the illegal band, so the roll is 1D
// with a '6' forced as the leading digit (always 61-66, never anything a
// legal supplier would offer).
function rollBlackMarketDie(rng) { return `6${d6(rng)}` }

/**
 * Determine goods composition per "Determine Goods Available": all Common
 * Goods, Trade Goods matching the world's trade codes, plus a number of
 * additional randomly-rolled goods equal to the world's Population code
 * (not a DM — the actual digit/letter value), rerolling 61-65 unless
 * seeking a black market supplier, in which case those extra rolls are
 * drawn straight from the illegal band instead (see rollBlackMarketDie).
 * A good rolled more than once (whether guaranteed + random, or random
 * more than once) gets one extra quantity roll stacked on top per hit,
 * not a duplicate row.
 *
 * @returns {Map<string, number>} die -> number of quantity rolls to sum
 */
function mgt2022Composition(compositionRng, codes, popDigit, seekingBlackMarket = false) {
  const hits = new Map()
  for (const good of MGT2022_TRADE_GOODS) {
    if (isGoodAvailableAt(good, codes)) hits.set(good.die, 1)
  }

  const popCount = parseInt(popDigit, 16) || 0
  for (let i = 0; i < popCount; i++) {
    let die = seekingBlackMarket ? rollBlackMarketDie(compositionRng) : rollD66(compositionRng)
    while (isRerollRequired(die, seekingBlackMarket)) die = rollD66(compositionRng)
    if (!resolveGood(die)) continue // Exotics (66) isn't in the table — skip
    hits.set(die, (hits.get(die) ?? 0) + 1)
  }
  return hits
}

function generateMgT2022Snapshot({ world, sectorName, campaignId, tick, activeEvents = [], seekingBlackMarket = false }) {
  const codes = mgt2022ParseTradeCodes(world.Remarks || '')
  // Amber/Red Zone sale DMs are encoded as 'Am'/'Rz' pseudo-codes in
  // MGT2022_TRADE_GOODS (Zone isn't a Remarks-tagged trade code, but the
  // DM-matching mechanism only understands codes in this Set).
  if (world.Zone === 'A') codes.add('Am')
  if (world.Zone === 'R') codes.add('Rz')

  const { buyMods, sellMods } = buildEventMods(activeEvents)
  void mgt2022StarportFromUWP; void mgt2022TechFromUWP // reserved for Find-a-Supplier/TL-based extensions

  const popDigit  = (world.UWP || '')[4]
  const qtyDM     = goodsAvailableDM(popDigit)
  const worldLaw  = mgt2022LawFromUWP(world.UWP || '')

  // Composition (which goods a supplier has at all) uses its own seeded RNG
  // stream, separate from each good's price/qty rolls below — otherwise
  // adding/removing a good from the random-extras roll would shift the
  // seed position of every good's price roll after it. Black-market
  // composition gets its own distinct stream too (a different, unrelated
  // roll from the normal market's — not sharing "world luck" with it).
  const compositionSeed = seekingBlackMarket
    ? `${campaignId}:${world.Hex}:composition:blackmarket:${tick}:v1`
    : `${campaignId}:${world.Hex}:composition:${tick}:v1`
  const compositionRng = makeRng(compositionSeed)
  const hits = mgt2022Composition(compositionRng, codes, popDigit, seekingBlackMarket)

  const rows = []
  for (const good of MGT2022_TRADE_GOODS) {
    const hitCount = hits.get(good.die)
    if (!hitCount) continue // not a Common Good, doesn't match the world's trade codes, and wasn't randomly rolled

    const rng = makeRng(`${campaignId}:${world.Hex}:${good.die}:${tick}:v1`)

    // "Use only the largest [Purchase/Sale DM] from each column," then both
    // columns apply to both rolls (purchasing adds Purchase, subtracts
    // Sale; selling adds Sale, subtracts Purchase).
    const goodPurchaseDM = maxTradeCodeDMs(good.purchaseDMs, codes)
    const goodSaleDM     = maxTradeCodeDMs(good.saleDMs,     codes)
    const lawLevelDM     = smugglingRiskDM(good.bannedLawLevel, worldLaw)

    const netPurchaseDM = goodPurchaseDM - goodSaleDM
    const netSaleDM     = goodSaleDM - goodPurchaseDM + lawLevelDM

    const purchaseThreeD = d6(rng) + d6(rng) + d6(rng)
    const purchaseRoll   = purchaseRollTotal({ threeDRoll: purchaseThreeD, purchaseDM: netPurchaseDM })
    let purchasePriceVal = mgt2022PurchasePrice(good.basePriceCr, purchaseRoll)

    const saleThreeD = d6(rng) + d6(rng) + d6(rng)
    const saleRoll    = saleRollTotal({ threeDRoll: saleThreeD, saleDM: netSaleDM })
    let salePriceVal  = mgt2022SalePrice(good.basePriceCr, saleRoll)

    const adjusted = applyEventMods(purchasePriceVal, salePriceVal, good.die, buyMods, sellMods)
    purchasePriceVal = adjusted.purchasePrice
    salePriceVal     = adjusted.salePrice

    // One quantity roll per "hit" (guaranteed inclusion counts as one; each
    // random extra roll that lands on this good stacks another) — "if you
    // roll the same type of goods multiple times, the supplier has extra
    // amounts of those goods available."
    let qty = 0
    for (let i = 0; i < hitCount; i++) {
      const qtyRolls = Array.from({ length: 8 }, () => d6(rng))
      qty += rollQty(good.qty, qtyRolls, qtyDM)
    }

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

// ── Per-player live pricing (Phase 4) ───────────────────────────────────────────
// generateCT7Snapshot/generateMgT2022Snapshot above compute a SHARED baseline
// (no live buyer — brokerSkill defaults to 0/assumed-2) used for qty pools and
// price history/charts. The functions below recompute one good's price for a
// SPECIFIC acting player's real Broker skill, live, at display/transaction
// time. They deliberately duplicate the DM/roll logic above rather than
// share code with it: `makeRng(seed)` is a pure function of its seed string,
// so calling it fresh and drawing dice in the same order reproduces the exact
// same "world luck" roll the shared baseline drew — only the Broker skill
// term differs. Keeping these standalone means the existing generators (and
// their tests) are untouched; a parity test below locks the two together.

/**
 * Recompute one MgT2022 good's purchase/sale price for a specific acting
 * player's Broker skill, reusing the exact same seeded dice the shared
 * snapshot baseline drew for this (world, good, tick). The opposing party
 * (supplier when buying, purchaser when selling) has no live character to
 * look up, so their assumed Broker skill stays at purchaseRollTotal/
 * saleRollTotal's own default of 2, same as the shared baseline.
 *
 * @returns {{purchasePrice: number, salePrice: number} | null} null if goodDie is unknown
 */
export function mgt2022PlayerGoodPrice({ campaignId, world, tick, goodDie, activeEvents = [], brokerSkill = 0 }) {
  const good = MGT2022_TRADE_GOODS.find(g => g.die === goodDie)
  if (!good) return null

  const codes = mgt2022ParseTradeCodes(world.Remarks || '')
  if (world.Zone === 'A') codes.add('Am')
  if (world.Zone === 'R') codes.add('Rz')
  const worldLaw = mgt2022LawFromUWP(world.UWP || '')

  const goodPurchaseDM = maxTradeCodeDMs(good.purchaseDMs, codes)
  const goodSaleDM     = maxTradeCodeDMs(good.saleDMs,     codes)
  const lawLevelDM     = smugglingRiskDM(good.bannedLawLevel, worldLaw)
  const netPurchaseDM  = goodPurchaseDM - goodSaleDM
  const netSaleDM      = goodSaleDM - goodPurchaseDM + lawLevelDM

  const { buyMods, sellMods } = buildEventMods(activeEvents)
  const rng = makeRng(`${campaignId}:${world.Hex}:${goodDie}:${tick}:v1`)

  const purchaseThreeD = d6(rng) + d6(rng) + d6(rng)
  const purchaseRoll   = purchaseRollTotal({ threeDRoll: purchaseThreeD, brokerSkill, purchaseDM: netPurchaseDM })
  let purchasePriceVal = mgt2022PurchasePrice(good.basePriceCr, purchaseRoll)

  const saleThreeD = d6(rng) + d6(rng) + d6(rng)
  const saleRoll    = saleRollTotal({ threeDRoll: saleThreeD, brokerSkill, saleDM: netSaleDM })
  let salePriceVal  = mgt2022SalePrice(good.basePriceCr, saleRoll)

  const adjusted = applyEventMods(purchasePriceVal, salePriceVal, goodDie, buyMods, sellMods)

  return {
    purchasePrice: Math.max(1, adjusted.purchasePrice),
    salePrice:     Math.max(1, adjusted.salePrice),
  }
}

/**
 * Recompute one CT7 good's sale price for a specific acting player's Broker
 * skill, reusing the exact same seeded dice the shared snapshot baseline
 * drew. Per Book 2's own mechanic, resale price depends only on the world
 * you're AT when you sell (base price × Actual Value%, using that world's
 * own resaleDMs) — there is no separate per-lot/source-world variant,
 * unlike MgT2022's per-player pricing, since Book 2 has no source-vs-
 * market duality at all (that's Book 7 Merchant Prince's own, unrelated
 * mechanic — see DEVLOG). CT7's Broker DM only ever applies to the sale
 * roll (per `tradeResult()`'s own design) — there is no purchase-side
 * equivalent, so this returns just the adjusted sale price per ton.
 *
 * @returns {number | null} null if goodDie is unknown
 */
export function ct7PlayerSalePrice({ campaignId, world, tick, goodDie, activeEvents = [], brokerSkill = 0 }) {
  const good = CT2_TRADE_GOODS.find(g => g.die === goodDie)
  if (!good) return null

  const codes = ct7ParseTradeCodes(world.Remarks || '')
  const saleDM = sumCT2DMs(good.resaleDMs, codes)
  const { sellMods } = buildEventMods(activeEvents)

  const rng = makeRng(`${campaignId}:${world.Hex}:${goodDie}:${tick}:v1`)
  d6(rng); d6(rng) // discard the purchase roll's 2 dice — must match generateCT7Snapshot's draw order

  const saleRoll       = d6(rng) + d6(rng) + saleDM + brokerDM(brokerSkill)
  const salePriceVal   = actualPrice(good.basePriceCr, saleRoll)
  const { salePrice }  = applyEventMods(0, salePriceVal, goodDie, {}, sellMods)

  return Math.max(1, salePrice)
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
 * @param {boolean}  [opts.seekingBlackMarket] — MgT2022 only; composes the illegal-band parallel listing instead of the normal one
 * @returns {object[]} rows for market_snapshots bulk insert
 */
export function generateWorldSnapshot({ world, sectorName, campaignId, tick, activeEvents = [], tradeRules = 'CT7', seekingBlackMarket = false }) {
  switch (tradeRules) {
    case 'T5':      return generateT5Snapshot({ world, sectorName, campaignId, tick, activeEvents })
    case 'MgT2022': return generateMgT2022Snapshot({ world, sectorName, campaignId, tick, activeEvents, seekingBlackMarket })
    default:        return generateCT7Snapshot({ world, sectorName, campaignId, tick, activeEvents })
  }
}
