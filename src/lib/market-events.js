/**
 * M.U.L.E.-style market event generator.
 *
 * Events fire with a seeded RNG so they are deterministic and identical
 * across all clients for the same tick/world. The referee does not need to
 * manually trigger them — they emerge from the tick advance.
 *
 * Scope:
 *   'local'     — affects one world for the event's duration
 *   'subsector' — affects all worlds in the sector (stored as world_hex = null)
 *
 * Severity:
 *   'minor'  — routine disruptions, ±8–18%, 1–4 ticks,  ~4.0% per-world per-tick
 *   'major'  — significant events,    ±20–35%, 4–10 ticks, ~1.5%
 *   'crisis' — sector-shaking events, ±38–55%, 8–20 ticks, ~0.4%
 *
 * effect_pct: percentage change applied to prices (+20 = 20% more expensive).
 * trade_good_die: null means the event affects ALL goods at that world/scope.
 */

import { makeRng } from './market-tick.js'

// ── Event table ───────────────────────────────────────────────────────────────

export const MARKET_EVENTS = [

  // ── AGRICULTURAL ─────────────────────────────────────────────────────────
  {
    id: 'bumper_harvest', severity: 'minor', scope: 'local',
    goodDie: null, affectsCodes: ['Ag'],
    effectPct: -15, durationTicks: 3,
    description: 'Bumper harvest — agricultural surplus drives prices down',
  },
  {
    id: 'early_frost', severity: 'minor', scope: 'local',
    goodDie: null, affectsCodes: ['Ag'],
    effectPct: +12, durationTicks: 2,
    description: 'Unseasonable frost damages crops — minor supply disruption',
  },
  {
    id: 'drought', severity: 'major', scope: 'local',
    goodDie: null, affectsCodes: ['Ag'],
    effectPct: +28, durationTicks: 5,
    description: 'Severe drought disrupts agricultural output',
  },
  {
    id: 'crop_failure', severity: 'major', scope: 'local',
    goodDie: null, affectsCodes: ['Ag'],
    effectPct: +30, durationTicks: 6,
    description: 'Crop blight forces emergency food imports',
  },
  {
    id: 'famine', severity: 'crisis', scope: 'local',
    goodDie: null, affectsCodes: ['Ag', 'Lo', 'Po'],
    effectPct: +55, durationTicks: 12,
    description: 'Famine conditions — food prices spike across all categories',
  },

  // ── INDUSTRIAL ────────────────────────────────────────────────────────────
  {
    id: 'tech_surplus', severity: 'minor', scope: 'local',
    goodDie: null, affectsCodes: ['In', 'Hi'],
    effectPct: -15, durationTicks: 4,
    description: 'Technology surplus cuts electronics and industrial prices',
  },
  {
    id: 'quality_recall', severity: 'minor', scope: 'local',
    goodDie: null, affectsCodes: ['In'],
    effectPct: +14, durationTicks: 2,
    description: 'Product recall diverts industrial capacity — prices tick up',
  },
  {
    id: 'factory_explosion', severity: 'major', scope: 'local',
    goodDie: null, affectsCodes: ['In'],
    effectPct: +28, durationTicks: 5,
    description: 'Industrial accident destroys major production facility',
  },
  {
    id: 'automation_breakthrough', severity: 'major', scope: 'local',
    goodDie: null, affectsCodes: ['In', 'Hi'],
    effectPct: -25, durationTicks: 8,
    description: 'New automation technology drives down production costs',
  },
  {
    id: 'industrial_collapse', severity: 'crisis', scope: 'local',
    goodDie: null, affectsCodes: ['In'],
    effectPct: +45, durationTicks: 15,
    description: 'Cascading industrial failures cripple local manufacturing',
  },

  // ── EPIDEMIOLOGICAL ───────────────────────────────────────────────────────
  {
    id: 'medical_surplus', severity: 'minor', scope: 'local',
    goodDie: '36', affectsCodes: ['Hi'],
    effectPct: -14, durationTicks: 3,
    description: 'Overproduction of medical supplies gluts the market',
  },
  {
    id: 'plague', severity: 'major', scope: 'local',
    goodDie: '36', affectsCodes: [],
    effectPct: +35, durationTicks: 4,
    description: 'Disease outbreak — pharmaceutical demand surges',
  },
  {
    id: 'pandemic', severity: 'crisis', scope: 'subsector',
    goodDie: '36', affectsCodes: [],
    effectPct: +50, durationTicks: 12,
    description: 'Subsector-wide pandemic — pharmaceutical prices spike across all worlds',
  },

  // ── POLITICAL ─────────────────────────────────────────────────────────────
  {
    id: 'trade_fair', severity: 'minor', scope: 'local',
    goodDie: null, affectsCodes: [],
    effectPct: -10, durationTicks: 1,
    description: 'Trade fair temporarily lowers prices',
  },
  {
    id: 'tariff_revision', severity: 'minor', scope: 'local',
    goodDie: null, affectsCodes: [],
    effectPct: +10, durationTicks: 4,
    description: 'Imperial tariff revision increases import costs',
  },
  {
    id: 'trade_delegation', severity: 'minor', scope: 'local',
    goodDie: null, affectsCodes: ['Ri'],
    effectPct: -12, durationTicks: 2,
    description: 'Diplomatic trade delegation opens new supply channels',
  },
  {
    id: 'embargo', severity: 'major', scope: 'local',
    goodDie: null, affectsCodes: [],
    effectPct: +30, durationTicks: 6,
    description: 'Trade embargo restricts imports — local prices spike',
  },
  {
    id: 'noble_succession', severity: 'major', scope: 'local',
    goodDie: null, affectsCodes: ['Ri'],
    effectPct: +22, durationTicks: 5,
    description: 'Noble succession dispute disrupts trade licensing',
  },
  {
    id: 'border_skirmish', severity: 'major', scope: 'subsector',
    goodDie: null, affectsCodes: [],
    effectPct: +18, durationTicks: 6,
    description: 'Border skirmish raises shipping risk premiums across the subsector',
  },
  {
    id: 'war_local', severity: 'major', scope: 'local',
    goodDie: null, affectsCodes: ['In', 'Po'],
    effectPct: +22, durationTicks: 8,
    description: 'Local conflict drives industrial and military demand',
  },
  {
    id: 'war_subsector', severity: 'crisis', scope: 'subsector',
    goodDie: null, affectsCodes: [],
    effectPct: +35, durationTicks: 16,
    description: 'Regional war disrupts trade throughout the subsector',
  },
  {
    id: 'imperial_interdict', severity: 'crisis', scope: 'local',
    goodDie: null, affectsCodes: [],
    effectPct: +50, durationTicks: 12,
    description: 'Imperial Interdict — all trade suspended pending investigation',
  },

  // ── MEGACORPORATE ─────────────────────────────────────────────────────────
  {
    id: 'corporate_rebate', severity: 'minor', scope: 'local',
    goodDie: null, affectsCodes: ['In', 'Hi'],
    effectPct: -12, durationTicks: 2,
    description: 'Megacorporate volume rebate scheme lowers wholesale prices',
  },
  {
    id: 'plant_closure', severity: 'major', scope: 'local',
    goodDie: null, affectsCodes: ['In'],
    effectPct: +28, durationTicks: 7,
    description: 'Corporate plant closure reduces local supply',
  },
  {
    id: 'megacorp_buyout', severity: 'major', scope: 'subsector',
    goodDie: null, affectsCodes: ['In', 'Ri'],
    effectPct: +25, durationTicks: 8,
    description: 'Megacorporate buyout corners a key commodity market',
  },
  {
    id: 'corporate_bankruptcy', severity: 'crisis', scope: 'local',
    goodDie: null, affectsCodes: ['In', 'Hi'],
    effectPct: -40, durationTicks: 4,
    description: 'Major corporate bankruptcy floods market as assets are liquidated',
  },

  // ── CRIMINAL / UNDERWORLD ─────────────────────────────────────────────────
  {
    id: 'black_market_bust', severity: 'minor', scope: 'local',
    goodDie: null, affectsCodes: [],
    effectPct: +12, durationTicks: 2,
    description: 'Customs crackdown on black market raises legitimate prices',
  },
  {
    id: 'piracy_spike', severity: 'major', scope: 'subsector',
    goodDie: null, affectsCodes: [],
    effectPct: +18, durationTicks: 4,
    description: 'Piracy surge raises shipping risk premiums across the subsector',
  },
  {
    id: 'corsair_alliance', severity: 'crisis', scope: 'subsector',
    goodDie: null, affectsCodes: [],
    effectPct: +38, durationTicks: 16,
    description: 'Vargr corsair alliance blockades major jump routes',
  },

  // ── NATURAL ───────────────────────────────────────────────────────────────
  {
    id: 'solar_flare', severity: 'minor', scope: 'local',
    goodDie: null, affectsCodes: [],
    effectPct: +10, durationTicks: 1,
    description: 'Solar flare disrupts communications and starport operations',
  },
  {
    id: 'ore_strike', severity: 'minor', scope: 'local',
    goodDie: null, affectsCodes: ['As', 'Ni'],
    effectPct: -20, durationTicks: 4,
    description: 'Rich new ore strike floods raw material markets',
  },
  {
    id: 'seismic_event', severity: 'major', scope: 'local',
    goodDie: null, affectsCodes: [],
    effectPct: +26, durationTicks: 5,
    description: 'Seismic activity damages infrastructure and disrupts supply',
  },
  {
    id: 'asteroid_strike', severity: 'crisis', scope: 'local',
    goodDie: null, affectsCodes: [],
    effectPct: +55, durationTicks: 20,
    description: 'Asteroid impact devastates surface infrastructure',
  },

  // ── SCOUT SERVICE / IMPERIAL ──────────────────────────────────────────────
  {
    id: 'survey_data', severity: 'minor', scope: 'local',
    goodDie: null, affectsCodes: ['As', 'Ni'],
    effectPct: -10, durationTicks: 3,
    description: 'IISS survey data reveals new resource deposits — prices soften',
  },
  {
    id: 'naval_exercises', severity: 'minor', scope: 'subsector',
    goodDie: null, affectsCodes: [],
    effectPct: +8, durationTicks: 2,
    description: 'Imperial naval exercises restrict jump traffic — minor delays',
  },
  {
    id: 'world_red_zoned', severity: 'major', scope: 'local',
    goodDie: null, affectsCodes: [],
    effectPct: +35, durationTicks: 10,
    description: 'Scout Service red-zones the world — trade severely restricted',
  },
  {
    id: 'new_route_opened', severity: 'major', scope: 'subsector',
    goodDie: null, affectsCodes: [],
    effectPct: -18, durationTicks: 8,
    description: 'New subsidised trade route opens — shipping costs fall',
  },
  {
    id: 'imperial_quarantine', severity: 'crisis', scope: 'local',
    goodDie: null, affectsCodes: [],
    effectPct: +50, durationTicks: 16,
    description: 'Imperial quarantine — starport sealed, all trade suspended',
  },

  // ── FINANCIAL ─────────────────────────────────────────────────────────────
  {
    id: 'noble_patronage', severity: 'minor', scope: 'local',
    goodDie: null, affectsCodes: ['Ri'],
    effectPct: +18, durationTicks: 2,
    description: 'Noble patron commission drives luxury prices up',
  },
  {
    id: 'fuel_shortage', severity: 'minor', scope: 'subsector',
    goodDie: null, affectsCodes: [],
    effectPct: +10, durationTicks: 2,
    description: 'Refined fuel shortage raises operational costs across the subsector',
  },
  {
    id: 'port_strike', severity: 'minor', scope: 'local',
    goodDie: null, affectsCodes: [],
    effectPct: +18, durationTicks: 2,
    description: 'Starport labour action delays all shipments',
  },
  {
    id: 'population_boom', severity: 'major', scope: 'local',
    goodDie: null, affectsCodes: ['Hi', 'Ri'],
    effectPct: +14, durationTicks: 8,
    description: 'Population surge increases demand for all goods',
  },
  {
    id: 'currency_devaluation', severity: 'major', scope: 'local',
    goodDie: null, affectsCodes: ['Ri', 'In'],
    effectPct: +24, durationTicks: 5,
    description: 'Local currency devaluation raises import prices sharply',
  },
  {
    id: 'market_crash', severity: 'crisis', scope: 'local',
    goodDie: null, affectsCodes: [],
    effectPct: -40, durationTicks: 3,
    description: 'Speculative bubble bursts — prices collapse across the board',
  },
]

// ── Tier rates (per world per tick) ──────────────────────────────────────────
// Total ~6%; within that: minor ~67%, major ~25%, crisis ~7%
const TOTAL_EVENT_CHANCE = 0.06
const CRISIS_SHARE       = 0.004 / TOTAL_EVENT_CHANCE   // ~0.067
const MAJOR_SHARE        = 0.015 / TOTAL_EVENT_CHANCE   // ~0.25

/**
 * Possibly generate a market event for a world at a given tick.
 * Uses a deterministic seeded RNG — same inputs always produce the same event.
 *
 * @param {object} opts.world         — world object {Hex, Remarks, ...}
 * @param {string} opts.sectorName
 * @param {string} opts.campaignId
 * @param {number} opts.tick
 * @returns {object|null} event row for market_events, or null
 */
export function maybeGenerateEvent({ world, sectorName, campaignId, tick }) {
  const rng = makeRng(`event:${campaignId}:${world.Hex}:${tick}`)

  // Roll 1: does any event fire this tick?
  if (rng() > TOTAL_EVENT_CHANCE) return null

  // Roll 2: which severity tier?
  const sevRoll  = rng()
  const severity = sevRoll < CRISIS_SHARE ? 'crisis'
    : sevRoll < CRISIS_SHARE + MAJOR_SHARE  ? 'major'
    : 'minor'

  const worldRemarks = (world.Remarks || '').trim().toUpperCase()

  // Build weighted pool: events matching the world's trade codes are twice as likely
  const pool = MARKET_EVENTS.filter(ev => ev.severity === severity)
  const weighted = pool.flatMap(ev => {
    const relevant = ev.affectsCodes.length === 0
      || ev.affectsCodes.some(c => worldRemarks.includes(c.toUpperCase()))
    return relevant ? [ev, ev] : [ev]
  })

  // Roll 3: pick specific event
  const ev = weighted[Math.floor(rng() * weighted.length)]

  return {
    campaign_id:    campaignId,
    tick,
    scope:          ev.scope,
    world_hex:      ev.scope === 'local' ? world.Hex : null,
    sector:         sectorName,
    trade_good_die: ev.goodDie,
    effect_pct:     ev.effectPct,
    description:    ev.description,
    expires_tick:   tick + ev.durationTicks,
    severity:       ev.severity,
  }
}

/**
 * Filter a pre-loaded events array to those currently active for a world+tick.
 *
 * @param {object[]} allEvents  — rows from market_events for this campaign
 * @param {string}   worldHex
 * @param {number}   tick
 * @returns {object[]}
 */
export function activeEventsForWorld(allEvents, worldHex, tick) {
  return allEvents.filter(ev => {
    if (ev.expires_tick !== null && ev.expires_tick <= tick) return false
    if (ev.scope === 'subsector') return true
    return ev.world_hex === worldHex
  })
}
