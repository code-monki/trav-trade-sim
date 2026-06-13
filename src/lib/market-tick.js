/**
 * Market tick engine — deterministic world snapshot generation.
 *
 * Prices are seeded by (campaignId + worldHex + goodDie + tick) so every
 * client produces identical values for the same inputs. No server-side
 * randomness needed.
 *
 * Calendar model (simplified Imperial):
 *   1 tick  = 1 jump-week (7 days)
 *   1 month = TICKS_PER_MONTH ticks  (4 × 7 = 28 days)
 *   1 year  = TICKS_PER_YEAR ticks   (48 × 7 = 336 days, close enough)
 *   Base year = 1105 (Classic Era)
 */

import { CT2_TRADE_GOODS, CT2_CODE_MAP } from './traveller-data.js'
import {
  parseTradeCodes,
  starportFromUWP,
  techFromUWP,
  costOfGoods,
  marketBasePrice,
  actualValueMultiplier,
  actualPrice,
  rollQty,
} from './trade-engine-ct7.js'

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

// ── CT2 DM helper ─────────────────────────────────────────────────────────────

function sumCT2DMs(dmList, worldCodes) {
  let total = 0
  for (const { code, dm } of dmList) {
    const full = CT2_CODE_MAP[code]
    if (full && worldCodes.has(full)) total += dm
  }
  return total
}

// ── Snapshot generation ───────────────────────────────────────────────────────

/**
 * Generate all 36 trade-good snapshots for one world at one tick.
 *
 * Prices use CT Book 7 cost/market formulas with CT Book 2 DMs applied to
 * the actual-value rolls. Results are fully deterministic.
 *
 * @param {object}   opts.world         — Traveller Map world object {Hex, UWP, Remarks, ...}
 * @param {string}   opts.sectorName    — sector display name
 * @param {string}   opts.campaignId    — campaign UUID
 * @param {number}   opts.tick          — current tick
 * @param {object[]} opts.activeEvents  — [{trade_good_die, effect_pct}] active at this tick/world
 * @returns {object[]} rows for market_snapshots bulk insert
 */
export function generateWorldSnapshot({ world, sectorName, campaignId, tick, activeEvents = [] }) {
  const codes    = parseTradeCodes(world.Remarks || '')
  const starport = starportFromUWP(world.UWP || '')
  const tl       = techFromUWP(world.UWP || '')

  // Build event modifier map: goodDie → cumulative effect_pct
  const eventMods = {}
  for (const ev of activeEvents) {
    const key = ev.trade_good_die ?? '__all__'
    eventMods[key] = (eventMods[key] ?? 0) + ev.effect_pct
  }

  const rows = []

  for (const good of CT2_TRADE_GOODS) {
    // Unique seed — prices are deterministic and tamper-proof
    const rng = makeRng(`${campaignId}:${world.Hex}:${good.die}:${tick}`)

    const purchaseDM = sumCT2DMs(good.purchaseDMs, codes)
    const saleDM     = sumCT2DMs(good.resaleDMs,   codes)

    const purchaseRoll = d6(rng) + d6(rng) + purchaseDM
    let purchasePrice = Math.round(
      costOfGoods(codes, starport, tl) * actualValueMultiplier(purchaseRoll)
    )

    const saleRoll = d6(rng) + d6(rng) + saleDM
    let salePrice = actualPrice(marketBasePrice(codes, codes), saleRoll)

    // Apply event modifiers (specific good or all goods)
    const mod = (eventMods[good.die] ?? 0) + (eventMods['__all__'] ?? 0)
    if (mod !== 0) {
      const factor = 1 + mod / 100
      purchasePrice = Math.round(purchasePrice * factor)
      salePrice     = Math.round(salePrice     * factor)
    }

    const qtyRolls = Array.from({ length: 8 }, () => d6(rng))
    const qty      = rollQty(good.qty, qtyRolls)

    rows.push({
      campaign_id:     campaignId,
      world_hex:       world.Hex,
      sector:          sectorName,
      trade_good_die:  good.die,
      trade_good_name: good.name,
      tick,
      purchase_price:  Math.max(1, purchasePrice),
      sale_price:      Math.max(1, salePrice),
      qty_available:   Math.max(0, qty),
      source_codes:    [...codes].join(' '),
    })
  }

  return rows
}
