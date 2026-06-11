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
 * effect_pct: percentage change applied to prices (+20 = 20% more expensive).
 * trade_good_die: null means the event affects ALL goods at that world/scope.
 */

import { makeRng } from './market-tick.js'

// ── Event table ───────────────────────────────────────────────────────────────
// Each entry fires on a specific triggering trade code (or any world).
// triggersOn: array of full trade codes that make this event more likely,
//             or [] to mean it can fire anywhere.

export const MARKET_EVENTS = [
  {
    id:           'bumper_harvest',
    scope:        'local',
    goodDie:      null,       // null = all agricultural goods (filtered by code in generator)
    affectsCodes: ['Ag'],
    effectPct:    -20,
    durationTicks: 4,
    description:  'Bumper harvest — agricultural surplus drives prices down',
  },
  {
    id:           'drought',
    scope:        'local',
    goodDie:      null,
    affectsCodes: ['Ag'],
    effectPct:    +25,
    durationTicks: 4,
    description:  'Severe drought disrupts agricultural output',
  },
  {
    id:           'plague',
    scope:        'local',
    goodDie:      '36',       // Pharmaceuticals
    affectsCodes: [],
    effectPct:    +35,
    durationTicks: 3,
    description:  'Disease outbreak — pharmaceutical demand surges',
  },
  {
    id:           'war_local',
    scope:        'local',
    goodDie:      null,
    affectsCodes: ['In', 'Po'],
    effectPct:    +20,
    durationTicks: 8,
    description:  'Local conflict drives industrial and military demand',
  },
  {
    id:           'war_subsector',
    scope:        'subsector',
    goodDie:      null,
    affectsCodes: [],
    effectPct:    +15,
    durationTicks: 12,
    description:  'Regional conflict raises prices across the subsector',
  },
  {
    id:           'trade_fair',
    scope:        'local',
    goodDie:      null,
    affectsCodes: [],
    effectPct:    -10,
    durationTicks: 1,
    description:  'Trade fair temporarily lowers prices',
  },
  {
    id:           'tech_surplus',
    scope:        'local',
    goodDie:      null,
    affectsCodes: ['In', 'Hi'],
    effectPct:    -15,
    durationTicks: 4,
    description:  'Technology surplus cuts electronics and industrial prices',
  },
  {
    id:           'piracy_spike',
    scope:        'subsector',
    goodDie:      null,
    affectsCodes: [],
    effectPct:    +15,
    durationTicks: 3,
    description:  'Piracy surge raises shipping risk premiums across the subsector',
  },
  {
    id:           'embargo',
    scope:        'local',
    goodDie:      null,
    affectsCodes: [],
    effectPct:    +30,
    durationTicks: 6,
    description:  'Trade embargo restricts imports — local prices spike',
  },
  {
    id:           'port_strike',
    scope:        'local',
    goodDie:      null,
    affectsCodes: [],
    effectPct:    +20,
    durationTicks: 2,
    description:  'Starport labor action delays all shipments',
  },
  {
    id:           'mining_strike',
    scope:        'local',
    goodDie:      null,
    affectsCodes: ['As', 'Ni'],
    effectPct:    -20,
    durationTicks: 4,
    description:  'Rich new ore strike floods raw material markets',
  },
  {
    id:           'fuel_shortage',
    scope:        'subsector',
    goodDie:      null,
    affectsCodes: [],
    effectPct:    +10,
    durationTicks: 2,
    description:  'Refined fuel shortage raises operational costs across the subsector',
  },
  {
    id:           'population_boom',
    scope:        'local',
    goodDie:      null,
    affectsCodes: ['Hi', 'Ri'],
    effectPct:    +12,
    durationTicks: 8,
    description:  'Population surge increases demand for all goods',
  },
  {
    id:           'noble_patronage',
    scope:        'local',
    goodDie:      null,
    affectsCodes: ['Ri'],
    effectPct:    +18,
    durationTicks: 2,
    description:  'Noble patron commission drives luxury prices up',
  },
  {
    id:           'market_crash',
    scope:        'local',
    goodDie:      null,
    affectsCodes: [],
    effectPct:    -25,
    durationTicks: 2,
    description:  'Speculative bubble bursts — prices collapse temporarily',
  },
]

// Baseline probability of an event firing this tick at a given world
const BASE_EVENT_CHANCE = 0.12

/**
 * Possibly generate a market event for a world at a given tick.
 * Uses the same deterministic RNG scheme as price generation.
 *
 * @param {object} opts.world         — world object {Hex, Remarks, ...}
 * @param {string} opts.sectorName
 * @param {string} opts.campaignId
 * @param {number} opts.tick
 * @returns {object|null} event row for market_events, or null
 */
export function maybeGenerateEvent({ world, sectorName, campaignId, tick }) {
  const rng = makeRng(`event:${campaignId}:${world.Hex}:${tick}`)

  if (rng() > BASE_EVENT_CHANCE) return null

  const worldRemarks = (world.Remarks || '').trim().toUpperCase()

  // Weight events by trade code match — events relevant to this world's type
  // are twice as likely as generic events.
  const weighted = MARKET_EVENTS.flatMap(ev => {
    const relevant = ev.affectsCodes.length === 0
      || ev.affectsCodes.some(c => worldRemarks.includes(c.toUpperCase()))
    return relevant ? [ev, ev] : [ev]   // double-weight relevant events
  })

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
  }
}

/**
 * Fetch active events from a pre-loaded events array for a specific world+tick.
 * Filters to events that apply to this world (local match or subsector-wide)
 * and haven't expired.
 *
 * @param {object[]} allEvents  — rows from market_events for this campaign
 * @param {string}   worldHex
 * @param {number}   tick
 * @returns {object[]} active event rows
 */
export function activeEventsForWorld(allEvents, worldHex, tick) {
  return allEvents.filter(ev => {
    if (ev.expires_tick !== null && ev.expires_tick <= tick) return false
    if (ev.scope === 'subsector') return true
    return ev.world_hex === worldHex
  })
}
