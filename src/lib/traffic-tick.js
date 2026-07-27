/**
 * MgT2022 traffic-availability tick engine — deterministic per-(ship,
 * origin world, destination world, tick) scarcity rolls for passengers/
 * freight/mail, generated on demand once a booking form's destination is
 * known (not ambiently on world visit — RAW itself has no "how many
 * passengers, independent of where they're going" concept).
 *
 * Sibling to market-tick.js rather than folded into it: this is a wholly
 * separate concern (per-route scarcity, not per-good pricing), and only
 * ever invoked for MgT2022 campaigns — CT7/T5 campaigns never call this.
 *
 * Per the book's "SEEKING PASSENGERS"/"FREIGHT"/"MAIL" sections: Steward,
 * Broker, Carouse, and Streetwise skills among a ship's own crew feed DMs
 * into these rolls (so, unlike goods pricing, traffic availability depends
 * on which ship is asking, not just the world/tick); population/starport
 * DMs apply from *both* the origin and destination world; and each parsec
 * of distance past the first is a further DM-1. The Broker/Carouse/
 * Streetwise check's Effect (2D+skill-8) is computed automatically using
 * whichever crew member has the single highest relevant skill — not a
 * per-player live overlay (Phase 4's pricing) and not a manual one-click
 * action (Find a Supplier) — no qualifying crew just means that DM term is
 * 0, not a penalty.
 *
 * Same deterministic-seeding discipline as market-tick.js: seed key is
 * `${campaignId}:${originHex}:${destHex}:${shipId}:traffic:${tick}:v1` so
 * every client produces identical availability counts for the same
 * inputs. The trailing version segment lets a future algorithm change
 * bump to :v2 without colliding with not-yet-generated ticks under the
 * old seed space.
 */

import { makeRng } from './market-tick.js'
import {
  parseTradeCodes, starportFromUWP, techFromUWP,
  MGT2022_STARPORT_TRAFFIC_DM,
  MGT2022_FREIGHT_POPULATION_TRAFFIC_DM,
  MGT2022_PASSENGER_POPULATION_TRAFFIC_DM,
  MGT2022_PASSENGER_TIER_DM,
  MGT2022_FREIGHT_TIER_DM,
  MGT2022_MAIL_FREIGHT_DM_BANDS,
  techLevelTrafficDM,
  mailTechLevelDM,
  freightZoneTrafficDM,
  passengerZoneTrafficDM,
  freightTrafficDiceCount,
  passengerTrafficDiceCount,
} from './traveller-data-mgt2022.js'
import { mailAvailable, mailContainerCount, characteristicDM } from './trade-engine-mgt2022.js'

function d6(rng) { return Math.floor(rng() * 6) + 1 }
function twoD6(rng) { return d6(rng) + d6(rng) }

function rollDiceSum(rng, diceCount) {
  let total = 0
  for (let i = 0; i < diceCount; i++) total += d6(rng)
  return total
}

function starportDM(starportClass) {
  return MGT2022_STARPORT_TRAFFIC_DM[starportClass?.toUpperCase()] ?? 0
}

function mailFreightDMBand(dm) {
  const band = MGT2022_MAIL_FREIGHT_DM_BANDS.find(
    b => (b.min == null || dm >= b.min) && (b.max == null || dm <= b.max),
  )
  return band?.dm ?? 0
}

/**
 * Generate one tick's passenger/freight/mail availability counts for a
 * ship, for a specific origin→destination route. Population digits are
 * read from each world's UWP (5th character, per the standard SABCDEF-T
 * layout); missing/blank data defaults to DM 0. Per RAW, both Passenger
 * and Freight Traffic apply population/starport DMs from *both* worlds
 * plus a distance penalty — the true count is inherently per-route, not
 * per-origin-world alone (Mail has no such destination term of its own;
 * it inherits one anyway by reusing Freight's baseDM).
 *
 * @param {object} opts.world       — origin world {Hex, UWP, Remarks, Zone, ...}
 * @param {string} opts.sectorName  — origin sector
 * @param {object} opts.destWorld   — destination world {Hex, UWP, Zone, ...}
 * @param {string} opts.destSectorName
 * @param {number} opts.parsecs     — origin→destination jump distance
 * @param {string} opts.campaignId
 * @param {number} opts.tick
 * @param {string} opts.shipId
 * @param {number} [opts.crewStewardMax]         — highest Steward skill among current crew
 * @param {number} [opts.crewPassengerCheckMax]   — highest of Broker/Carouse/Streetwise among current crew
 * @param {number} [opts.crewFreightCheckMax]     — highest of Broker/Streetwise among current crew
 * @param {number} [opts.crewNavalScoutRankMax]   — highest rank among crew with a Navy/Scout background
 * @param {number} [opts.crewSocialStandingMax]   — highest SOC characteristic among current crew
 * @param {boolean} [opts.shipArmed]
 * @returns {object} row shape for traffic_snapshots
 */
export function generateTrafficSnapshot({
  world, sectorName, destWorld, destSectorName, parsecs, campaignId, tick, shipId,
  crewStewardMax = 0, crewPassengerCheckMax = 0, crewFreightCheckMax = 0,
  crewNavalScoutRankMax = 0, crewSocialStandingMax = null, shipArmed = false,
}) {
  const uwp      = world.UWP || ''
  const popDigit = uwp[4] // SABCDEF-T: S=0 starport,1 size,2 atmo,3 hydro,4 pop
  const starport = starportFromUWP(uwp)
  const tl       = techFromUWP(uwp)
  const zone     = world.Zone

  const destUwp      = destWorld?.UWP || ''
  const destPopDigit = destUwp[4]
  const destStarport = starportFromUWP(destUwp)
  const destZone     = destWorld?.Zone

  // "Each parsec of destination past the first: DM-1" — 1 parsec is the
  // baseline (no penalty), so the term is -(parsecs - 1), never positive.
  const distanceDM = -Math.max(0, (parsecs ?? 1) - 1)

  // Passengers, Freight, and Mail each draw from their OWN seeded RNG
  // stream. Tier dice counts are data-dependent (a roll of, say, +2 DM
  // might sum 3 dice while +4 DM sums 5), so sharing one stream across
  // categories would let a change to one (e.g. Steward only ever affecting
  // Passengers) shift where the *next* category's draws start from,
  // contaminating results that should be independent — the same reasoning
  // already applied to goods composition vs. price rolls in market-tick.js.
  // The seed now includes the destination, since the roll is per-route.
  const routeKey      = `${world.Hex}:${destWorld?.Hex ?? ''}`
  const passengerRng = makeRng(`${campaignId}:${routeKey}:${shipId}:traffic:passenger:${tick}:v1`)
  const freightRng   = makeRng(`${campaignId}:${routeKey}:${shipId}:traffic:freight:${tick}:v1`)
  const mailRng       = makeRng(`${campaignId}:${routeKey}:${shipId}:traffic:mail:${tick}:v1`)

  // ── Passengers ────────────────────────────────────────────────────────────
  const passengerBaseDM = (MGT2022_PASSENGER_POPULATION_TRAFFIC_DM[String(popDigit ?? '').toUpperCase()] ?? 0)
    + (MGT2022_PASSENGER_POPULATION_TRAFFIC_DM[String(destPopDigit ?? '').toUpperCase()] ?? 0)
    + starportDM(starport) + starportDM(destStarport)
    + passengerZoneTrafficDM(zone)
    + distanceDM
  const passengerCheckEffect = (twoD6(passengerRng) + crewPassengerCheckMax) - 8

  const passengerTiers = {}
  for (const tier of ['high', 'middle', 'basic', 'low']) {
    const tierDM = passengerBaseDM + crewStewardMax + passengerCheckEffect + MGT2022_PASSENGER_TIER_DM[tier]
    passengerTiers[tier] = rollDiceSum(passengerRng, passengerTrafficDiceCount(twoD6(passengerRng) + tierDM))
  }

  // ── Freight ───────────────────────────────────────────────────────────────
  // TL/Zone stay origin-only — the book lists them outside the "both
  // source and destination" bullet, unlike population/starport.
  const freightBaseDM = (MGT2022_FREIGHT_POPULATION_TRAFFIC_DM[String(popDigit ?? '').toUpperCase()] ?? 0)
    + (MGT2022_FREIGHT_POPULATION_TRAFFIC_DM[String(destPopDigit ?? '').toUpperCase()] ?? 0)
    + starportDM(starport) + starportDM(destStarport)
    + techLevelTrafficDM(tl) + freightZoneTrafficDM(zone)
    + distanceDM
  const freightCheckEffect = (twoD6(freightRng) + crewFreightCheckMax) - 8

  const freightTiers = {}
  for (const tier of ['major', 'minor', 'incidental']) {
    const tierDM = freightBaseDM + freightCheckEffect + MGT2022_FREIGHT_TIER_DM[tier]
    freightTiers[tier] = rollDiceSum(freightRng, freightTrafficDiceCount(twoD6(freightRng) + tierDM))
  }

  // ── Mail ──────────────────────────────────────────────────────────────────
  // "Freight Traffic DM" in the Mail rule means the un-tiered freight DM
  // *value* computed above (now itself route-aware) — reuses that
  // outcome, but draws its own dice from its own stream rather than
  // continuing freightRng.
  const mailDM = mailFreightDMBand(freightBaseDM + freightCheckEffect)
    + (shipArmed ? +2 : 0)
    + mailTechLevelDM(tl)
    + crewNavalScoutRankMax
    + characteristicDM(crewSocialStandingMax)
  const mailRoll       = twoD6(mailRng)
  const mailContainers = mailAvailable(mailRoll + mailDM) ? mailContainerCount(d6(mailRng)) : 0

  return {
    campaign_id:             campaignId,
    ship_id:                 shipId,
    world_hex:               world.Hex,
    sector:                  sectorName,
    dest_world_hex:          destWorld?.Hex ?? '',
    dest_sector:             destSectorName ?? '',
    tick,
    high_passages:           passengerTiers.high,
    middle_passages:         passengerTiers.middle,
    basic_passages:          passengerTiers.basic,
    low_passages:            passengerTiers.low,
    major_freight_lots:      freightTiers.major,
    minor_freight_lots:      freightTiers.minor,
    incidental_freight_lots: freightTiers.incidental,
    mail_containers:         mailContainers,
  }
}

// Re-exported for callers that only have Remarks and need world trade codes
// (parity with market-tick's per-world code parsing) — not used internally
// above but kept alongside for consistency with the other tick modules.
export { parseTradeCodes }
