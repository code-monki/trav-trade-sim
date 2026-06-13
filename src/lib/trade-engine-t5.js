/**
 * Traveller 5th Edition — Trade and Commerce engine.
 *
 * Reference: "27 Trade and Commerce" (Marc Miller, 2008), specifically
 * Trade Chart-2 (buying/selling tables) and the worked examples on that page.
 *
 * All functions are pure (no side-effects, no randomness).
 * Callers supply flux rolls so results are reproducible and testable.
 *
 * Key differences from CT7:
 *   - Base buying cost is Cr3,000 (CT7: Cr4,000)
 *   - Hi/In REDUCE buying cost; Ba/Ni/Va INCREASE it (opposite to CT7)
 *   - No starport cost modifier (starport only affects broker availability)
 *   - Selling price uses a percentage-based TL delta (CT7 uses a fixed per-TL reduction)
 *   - Actual Value uses Flux (1D−1D, range −5…+5) not 2D
 *   - Broker DM = ⌈skill/2⌉, max 4; commission = 5% × DM
 */

// ── Trade classification constants ───────────────────────────────────────────

/**
 * Complete T5 Trade Classification list.
 * Seven groups: Planetary, Population, Economic, Climate, Secondary, Political, Special.
 * Source: "The Trade Classifications", "27 Trade and Commerce" pp.15–18.
 *
 * Only a subset (the 15 in Trade Chart-2 plus Fa) affect buying/selling prices.
 * All codes are recognised by parseTradeCodes() so they appear in cargo IDs.
 */
export const TRADE_CLASSIFICATIONS = {
  // Planetary — based on UWP Size/Atmosphere/Hydrographics
  As: 'Asteroid',
  De: 'Desert',
  Fl: 'Fluid Oceans',
  Ga: 'Garden World',
  He: 'Hellworld',
  Ic: 'Ice-Capped',
  Lk: 'Locked',
  Oc: 'Ocean World',
  Va: 'Vacuum',
  Wa: 'Water World',

  // Population — based on UWP Population
  Ba: 'Barren',
  Di: 'Dieback',
  Hi: 'High Population',
  Lo: 'Low Population',
  Ni: 'Non-Industrial',
  Ph: 'Pre-High',

  // Economic — based on UWP Atmosphere/Hydrographics/Population
  Ag: 'Agricultural',
  Fa: 'Farming',      // explicit substitute for Ag (not a mainworld Ag)
  In: 'Industrial',
  Na: 'Non-Agricultural',
  Pa: 'Pre-Agricultural',
  Pi: 'Pre-Industrial',
  Po: 'Poor',
  Pr: 'Pre-Rich',
  Ri: 'Rich',

  // Climate — based on world's relation to Habitable Zone
  Fr: 'Frozen',
  Tr: 'Tropic',
  Tu: 'Tundra',
  Tz: 'Twilight Zone',

  // Secondary — non-mainworld worlds in the system
  Mi: 'Mining',

  // Political — discretionary, imposed by referee
  Cp: 'Subsector Capital',
  Cs: 'Sector Capital',
  Cx: 'Capital',
  Cy: 'Colony',
  Pe: 'Penal Colony',
  Re: 'Reserve',

  // Special — discretionary
  Ab: 'Data Repository',
  An: 'Ancient Site',
  Da: 'Danger (Amber Zone)',
  Fo: 'Forbidden (Red Zone)',
  Pz: 'Puzzle (Amber Zone)',
  Sa: 'Satellite',
}

const KNOWN_TRADE_CODES = new Set(Object.keys(TRADE_CLASSIFICATIONS))

/**
 * The 14 broad trade good categories used with the Random Trade Goods tables.
 * Source: "Types of Interstellar Trade Goods", p.3.
 */
export const TRADE_GOOD_CATEGORIES = [
  'Raws',
  'Rares',
  'Consumables',
  'Data',
  'Pharma',
  'Novelties',
  'Imbalances',
  'Valuta',
  'Samples',
  'Uniques',
  'Manufactureds',
  'Scrap/Waste',
  'Entertainments',
  'Red Tape',
]

/**
 * Trade Goods Detail codes and their detail prefix.
 * Used to add a qualifying description to a specific trade good.
 * Source: "Trade Goods Detail" sidebar, Random Trade Goods charts.
 *
 * As and Lo have no detail modifier; Hi omits the prefix for Industrial worlds.
 */
export const TRADE_GOOD_DETAIL = {
  Ba: 'Gathered',
  De: 'Mineral',
  Di: 'Artifact',
  Fl: 'Unusual',
  Ga: 'Premium',
  Hi: 'Processed',   // omit for In worlds
  Ic: 'Cryo',
  Ni: 'Unprocessed',
  Po: 'Obscure',
  Ri: 'Quality',
  Va: 'Exotic',      // omit for As worlds
}

// ── Trade code parsing ────────────────────────────────────────────────────────

/**
 * Extract the set of trade codes from a world's Remarks field.
 * Returns Set<string> of known T5 codes, e.g. Set{'Hi','In'}.
 */
export function parseTradeCodes(remarks = '') {
  const codes = new Set()
  for (const token of remarks.trim().split(/\s+/)) {
    if (KNOWN_TRADE_CODES.has(token.trim())) codes.add(token.trim())
  }
  return codes
}

/**
 * Extract the starport class (single letter) from a UWP string (first char).
 */
export function starportFromUWP(uwp = '') {
  return uwp[0]?.toUpperCase() ?? 'X'
}

/**
 * Extract the tech level digit/letter from a UWP string (part after dash).
 */
export function techFromUWP(uwp = '') {
  const parts = uwp.split('-')
  return parts[1]?.trim() ?? '0'
}

// Convert TL to integer.  Accepts numeric (already decimal) or hex glyph string (0–F).
function tlToInt(tl) {
  if (typeof tl === 'number') return isNaN(tl) ? 0 : Math.round(tl)
  const n = parseInt(String(tl), 16)
  return isNaN(n) ? 0 : n
}

// ── Buying cost (source world) ────────────────────────────────────────────────

/**
 * Source-world TC modifiers on buying cost.
 * Derived from Trade Chart-2 buying table, plus Fa = Ag per rules text.
 *
 * Productive worlds (Hi, In, Ag, As, Fa, Po) reduce cost.
 * Scarce/harsh worlds (Ba, De, Fl, Ic, Lo, Ni, Ri, Va) increase cost.
 * Na and Wa have no effect.
 * All other T5 codes have no buying modifier (default 0).
 *
 * Source: "27 Trade and Commerce" p.13 (Trade Chart-2), p.17 (Fa = Ag substitute).
 */
const BUYING_TC_MODS = {
  Ag: -1000,
  As: -1000,
  Ba:  1000,
  De:  1000,
  Fa: -1000,  // "Farming is a rare substitute term for Agricultural"
  Fl:  1000,
  Hi: -1000,
  Ic:  1000,
  In: -1000,
  Lo:  1000,
  Na:     0,
  Ni:  1000,
  Po: -1000,
  Ri:  1000,
  Va:  1000,
  Wa:     0,
}

/**
 * Compute the cost-of-goods per ton for cargo purchased at a source world.
 *
 * Formula (T5 Trade Chart-2):
 *   Cr3,000
 *   + Σ BUYING_TC_MODS for each matching source trade code
 *   + sourceTL × Cr100
 *
 * Verified: Efate (Hi In TL-D) → Cr2,300; Alell (Ri TL-A) → Cr5,000.
 *
 * @param {Set<string>}   sourceCodes  trade codes of the source world
 * @param {string|number} tl           tech level (hex glyph or integer)
 * @returns {number} cost in Credits per ton (minimum 0)
 */
export function t5CostOfGoods(sourceCodes, tl) {
  let cost = 3000
  for (const code of sourceCodes) {
    cost += (BUYING_TC_MODS[code] ?? 0)
  }
  cost += tlToInt(tl) * 100
  return Math.max(0, cost)
}

// ── Selling price (market world) ──────────────────────────────────────────────

/**
 * Source→market TC cross-reference for selling price adjustment.
 * Each entry: { [sourceTC]: { [marketTC]: Cr_per_match } }
 *
 * Fa (Farming) rows are identical to Ag: same production profile, same markets.
 * Po (Poor source) → Ag/Hi/In/Ri markets gives −1,000 per match.
 * All other T5 codes not listed here have no selling cross-reference effect.
 *
 * Source: Trade Chart-2 selling table; Fa per p.17 "substitute term for Agricultural".
 */
const SELLING_TC_TABLE = {
  Ag: { Ag: 1000, As: 1000, De: 1000, Hi: 1000, In: 1000, Ri: 1000, Va: 1000 },
  As: { As: 1000, In: 1000, Ri: 1000, Va: 1000 },
  Ba: { In: 1000 },
  De: { De: 1000 },
  Fa: { Ag: 1000, As: 1000, De: 1000, Hi: 1000, In: 1000, Ri: 1000, Va: 1000 },
  Fl: { Fl: 1000, In: 1000 },
  Hi: { Hi: 1000 },
  Ic: {},
  In: { Ag: 1000, As: 1000, De: 1000, Fl: 1000, Hi: 1000, In: 1000, Ri: 1000, Va: 1000 },
  Lo: {},
  Na: { As: 1000, De: 1000, Va: 1000 },
  Ni: {},
  Po: { Ag: -1000, Hi: -1000, In: -1000, Ri: -1000 },
  Ri: { Ag: 1000, De: 1000, Hi: 1000, In: 1000, Ri: 1000 },
  Va: { As: 1000, In: 1000, Va: 1000 },
  Wa: {},
}

/**
 * Compute the trade-class-adjusted selling price (before TL delta).
 *
 * Formula: Cr5,000 + Σ SELLING_TC_TABLE[sourceTC][marketTC] for all matching pairs.
 *
 * @param {Set<string>} sourceCodes  trade codes of the source world
 * @param {Set<string>} marketCodes  trade codes of the market world
 * @returns {number} TC-adjusted base price in Credits per ton
 */
export function t5TcAdjustedPrice(sourceCodes, marketCodes) {
  let price = 5000
  for (const src of sourceCodes) {
    const row = SELLING_TC_TABLE[src]
    if (!row) continue
    for (const mkt of marketCodes) {
      price += (row[mkt] ?? 0)
    }
  }
  return price
}

/**
 * Apply the TL differential to the TC-adjusted price.
 *
 * Formula: price × (1 + (sourceTL − marketTL) × 0.10)
 *
 * Positive delta (source TL > market TL): premium for high-tech goods.
 * Negative delta (source TL < market TL): discount for low-tech goods.
 * Rounds to nearest credit; floored at 0.
 *
 * Verified: In(TL-D=13) → Ri(TL-A=10): 6,000 × 1.30 = 7,800 ✓
 *           Ri(TL-A=10) → Hi+In(TL-D=13): 7,000 × 0.70 = 4,900 ✓
 *
 * @param {string|number} sourceTL   tech level of source world
 * @param {string|number} marketTL   tech level of market world
 * @param {number}        tcPrice    output of t5TcAdjustedPrice()
 * @returns {number} final trade price per ton (minimum 0)
 */
export function t5TlAdjustedPrice(sourceTL, marketTL, tcPrice) {
  const delta = tlToInt(sourceTL) - tlToInt(marketTL)
  const adjusted = Math.round(tcPrice * (1 + delta * 0.10))
  return Math.max(0, adjusted)
}

/**
 * Combined helper: TC + TL adjusted selling price at the market world.
 *
 * @param {Set<string>}   sourceCodes
 * @param {Set<string>}   marketCodes
 * @param {string|number} sourceTL
 * @param {string|number} marketTL
 * @returns {number} selling price per ton
 */
export function t5SellingPrice(sourceCodes, marketCodes, sourceTL, marketTL) {
  const tcPrice = t5TcAdjustedPrice(sourceCodes, marketCodes)
  return t5TlAdjustedPrice(sourceTL, marketTL, tcPrice)
}

// ── Actual Value Table ────────────────────────────────────────────────────────

/**
 * T5 Actual Value Table.
 * Flux = 1D − 1D (range −5…+5); extended by broker DM up to +8.
 * Values below −5 use 40%; values above +8 use 400%.
 * Source: Trade Chart-2.
 */
const ACTUAL_VALUE_TABLE = {
  '-5': 0.40, '-4': 0.50, '-3': 0.70, '-2': 0.80, '-1': 0.90,
    '0': 1.00,  '1': 1.10,  '2': 1.20,  '3': 1.30,  '4': 1.50,
    '5': 1.70,  '6': 2.00,  '7': 3.00,  '8': 4.00,
}

/**
 * Look up the Actual Value multiplier for a given effective flux roll.
 * Clamps to [−5, +8] before lookup.
 *
 * @param {number} flux  effective roll (raw flux + broker DM)
 * @returns {number} price multiplier (0.40 … 4.00)
 */
export function t5ActualValueMultiplier(flux) {
  const clamped = Math.max(-5, Math.min(8, flux))
  return ACTUAL_VALUE_TABLE[String(clamped)]
}

/**
 * Compute the actual selling price given a trade price and flux roll.
 * Rounds to nearest credit.
 *
 * @param {number} tradePrice   output of t5SellingPrice()
 * @param {number} flux         effective flux roll (raw flux + broker DM, pre-clamped here)
 * @returns {number} actual selling price per ton
 */
export function t5ActualPrice(tradePrice, flux) {
  return Math.round(tradePrice * t5ActualValueMultiplier(flux))
}

// ── Broker ────────────────────────────────────────────────────────────────────

/**
 * Broker DM on the Actual Value Table.
 * DM = ⌈skill/2⌉, maximum +4.
 * Requires an appropriate starport class (see broker table, Trade-1).
 * This function ignores starport — callers should verify availability.
 *
 * @param {number} skill  broker skill level (0+)
 * @returns {number} DM added to flux roll (0…4)
 */
export function t5BrokerDM(skill) {
  if (skill <= 0) return 0
  return Math.min(4, Math.ceil(skill / 2))
}

/**
 * Broker commission as a fraction of the final sale price.
 * Commission = 5% × DM (i.e. 5%, 10%, 15%, or 20%).
 *
 * @param {number} skill  broker skill level
 * @returns {number} commission fraction (0.05…0.20)
 */
export function t5BrokerCommission(skill) {
  return t5BrokerDM(skill) * 0.05
}

/**
 * Compute the broker's fee given skill, sale price.
 * Fee = commission fraction × sale price, rounded to nearest credit.
 *
 * @param {number} skill      broker skill
 * @param {number} salePrice  actual selling price per ton × tons
 * @returns {number} fee in Credits
 */
export function t5BrokerFee(skill, salePrice) {
  return Math.round(t5BrokerCommission(skill) * salePrice)
}

// ── Cargo ID ──────────────────────────────────────────────────────────────────

/**
 * Format a T5 Cargo ID string.
 * Format: "[TL-hex] [TC1] [TC2] … Cr[cost]"
 * Example: "D Hi In Cr2,300"
 *
 * @param {string|number} tl     source world TL
 * @param {Set<string>}   codes  source world trade codes
 * @param {number}        cost   computed cost per ton
 * @returns {string}
 */
export function t5CargoId(tl, codes, cost) {
  const tlHex = typeof tl === 'number'
    ? tl.toString(16).toUpperCase()
    : String(tl).toUpperCase()
  const tcStr = Array.from(codes).join(' ')
  const costStr = `Cr${Math.round(cost).toLocaleString()}`
  return `${tlHex}${tcStr ? ` ${tcStr}` : ''} ${costStr}`
}

// ── Full trade result ─────────────────────────────────────────────────────────

/**
 * Compute a complete T5 trade transaction.
 *
 * @param {object} params
 * @param {Set<string>}   params.sourceCodes   source world trade codes
 * @param {string|number} params.sourceTL      source world TL
 * @param {Set<string>}   params.marketCodes   market world trade codes
 * @param {string|number} params.marketTL      market world TL
 * @param {number}        params.tons          cargo size in tons
 * @param {number}        params.purchaseFlux  flux roll used for purchase (informational)
 * @param {number}        params.saleFlux      raw flux roll (1D−1D) for actual value
 * @param {number}        [params.brokerSkill] broker skill level (default 0)
 *
 * @returns {object} detailed result with per-ton and total figures
 */
export function t5TradeResult({
  sourceCodes,
  sourceTL,
  marketCodes,
  marketTL,
  tons,
  purchaseFlux = 0,
  saleFlux     = 0,
  brokerSkill  = 0,
}) {
  // Buying
  const costPerTon     = t5CostOfGoods(sourceCodes, sourceTL)
  const totalCost      = costPerTon * tons

  // Selling — TC adjustment, then TL delta
  const tcAdjustedPerTon = t5TcAdjustedPrice(sourceCodes, marketCodes)
  const tradePricePerTon = t5TlAdjustedPrice(sourceTL, marketTL, tcAdjustedPerTon)

  // Actual value (broker DM applied to raw flux, then clamped)
  const brokerMod     = t5BrokerDM(brokerSkill)
  const effectiveFlux = Math.max(-5, Math.min(8, saleFlux + brokerMod))
  const avMultiplier  = t5ActualValueMultiplier(effectiveFlux)
  const salePricePerTon  = t5ActualPrice(tradePricePerTon, effectiveFlux)
  const totalRevenue     = salePricePerTon * tons

  // Broker fee on total revenue
  const brokerFeeTotal = t5BrokerFee(brokerSkill, totalRevenue)

  const netProfit = totalRevenue - totalCost - brokerFeeTotal

  return {
    // Buying
    costPerTon,
    totalCost,

    // Selling (before AVT)
    tcAdjustedPerTon,
    tradePricePerTon,

    // Actual value
    effectiveFlux,
    avMultiplier,
    salePricePerTon,
    totalRevenue,

    // Broker
    brokerMod,
    brokerFeeTotal,

    // Summary
    netProfit,
    tons,

    // Cargo ID for this source world
    cargoId: t5CargoId(sourceTL, sourceCodes, costPerTon),
  }
}
