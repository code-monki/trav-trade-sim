/**
 * MgT2022 traffic-availability tick engine — deterministic per-world scarcity
 * rolls for passengers/freight/mail, generated automatically every tick
 * alongside (but separately from) the goods-price market snapshot.
 *
 * Sibling to market-tick.js rather than folded into it: this is a wholly
 * separate concern (per-world scarcity, not per-good pricing), and only
 * ever invoked for MgT2022 campaigns — CT7/T5 campaigns never call this.
 *
 * Same deterministic-seeding discipline as market-tick.js: seed key is
 * `${campaignId}:${worldHex}:traffic:${tick}` so every client produces
 * identical availability counts for the same inputs.
 */

import { makeRng } from './market-tick.js'
import { parseTradeCodes, starportFromUWP } from './traveller-data-mgt2022.js'
import {
  MGT2022_STARPORT_TRAFFIC_DM,
  MGT2022_POPULATION_TRAFFIC_DM,
} from './traveller-data-mgt2022.js'
import { trafficCount, mailAvailable, mailContainerCount } from './trade-engine-mgt2022.js'

function d6(rng) { return Math.floor(rng() * 6) + 1 }
function twoD6(rng) { return d6(rng) + d6(rng) }

function populationDM(popDigit) {
  return MGT2022_POPULATION_TRAFFIC_DM[String(popDigit ?? '').toUpperCase()] ?? 0
}

function starportDM(starportClass) {
  return MGT2022_STARPORT_TRAFFIC_DM[starportClass?.toUpperCase()] ?? 0
}

/**
 * Generate one tick's passenger/freight/mail availability counts for a world.
 * Population digit is read from the world's UWP (3rd character, per the
 * standard SABCDEF-T layout); missing/blank data defaults to DM 0.
 *
 * @param {object} opts.world        — {Hex, UWP, Remarks, ...}
 * @param {string} opts.sectorName
 * @param {string} opts.campaignId
 * @param {number} opts.tick
 * @returns {object} row shape for traffic_snapshots
 */
export function generateTrafficSnapshot({ world, sectorName, campaignId, tick }) {
  const uwp        = world.UWP || ''
  const popDigit    = uwp[4] // SABCDEF-T: S=0 starport,1 size,2 atmo,3 hydro,4 pop
  const starport    = starportFromUWP(uwp)
  const dm          = populationDM(popDigit) + starportDM(starport)

  const rng = makeRng(`${campaignId}:${world.Hex}:traffic:${tick}`)

  const highPassages   = trafficCount(twoD6(rng), dm)
  const middlePassages = trafficCount(twoD6(rng), dm)
  const basicPassages  = trafficCount(twoD6(rng), dm)
  const lowPassages    = trafficCount(twoD6(rng), dm)

  const majorFreightLots      = trafficCount(twoD6(rng), dm)
  const minorFreightLots      = trafficCount(twoD6(rng), dm)
  const incidentalFreightLots = trafficCount(twoD6(rng), dm)

  const mailRoll       = twoD6(rng)
  const mailContainers = mailAvailable(mailRoll + dm) ? mailContainerCount(d6(rng)) : 0

  return {
    campaign_id:             campaignId,
    world_hex:               world.Hex,
    sector:                  sectorName,
    tick,
    high_passages:           highPassages,
    middle_passages:         middlePassages,
    basic_passages:          basicPassages,
    low_passages:            lowPassages,
    major_freight_lots:      majorFreightLots,
    minor_freight_lots:      minorFreightLots,
    incidental_freight_lots: incidentalFreightLots,
    mail_containers:         mailContainers,
  }
}

// Re-exported for callers that only have Remarks and need world trade codes
// (parity with market-tick's per-world code parsing) — not used internally
// above but kept alongside for consistency with the other tick modules.
export { parseTradeCodes }
