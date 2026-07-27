/**
 * CT7 (Classic Traveller Book 7, Merchant Prince) traffic-availability tick
 * engine — deterministic per-(ship, origin world, destination world, tick)
 * scarcity rolls for passengers and freight, generated on demand once a
 * booking form's destination is known (not ambiently on world visit — same
 * reasoning as traffic-tick.js's MgT2022 version: RAW has no "how many
 * passengers, independent of where they're going" concept).
 *
 * Sibling to traffic-tick.js (MgT2022) rather than a shared implementation —
 * the two rulesets' tables/mechanics genuinely diverge (CT7 has no Basic
 * passage tier or Mail availability roll; its dice expressions and DM
 * shapes are Book 7's own "Passengers/Cargo Available at Source World"
 * tables, not MgT2022's tier-DM system) — and only ever invoked for CT7
 * campaigns.
 *
 * Per Book 7's own tables: the SOURCE world's Population digit picks the
 * dice expression directly (not via an intermediate 2D+DM lookup, unlike
 * MgT2022); Population/Zone/Tech-Level DMs from the MARKET (destination)
 * world, plus the ship's own crew skills (Steward/Admin/Streetwise for
 * Passengers, Liaison for Minor cargo), are added as flat DMs on top of
 * the rolled dice sum. Red/Amber Zones can also outright block a tier
 * regardless of DMs (see ct7PassengerZoneBlocked/ct7CargoZoneBlocked).
 *
 * Same deterministic-seeding discipline as traffic-tick.js: Passengers and
 * Freight draw from separate seeded RNG streams (a DM affecting one must
 * never shift where the other's draws start from — the same contamination
 * bug already caught once this session, for MgT2022's Phase 5).
 */

import { makeRng } from './market-tick.js'
import {
  techFromUWP,
  rollCT7Availability,
  ct7PassengerPopulationDM, ct7CargoPopulationDM,
  ct7PassengerZoneDM, ct7PassengerZoneBlocked, ct7CargoZoneBlocked,
  ct7TrafficTLDM,
} from './trade-engine-ct7.js'
import {
  CT7_PASSENGER_AVAILABILITY,
  CT7_CARGO_AVAILABILITY,
} from './traveller-data.js'

function d6(rng) { return Math.floor(rng() * 6) + 1 }

// Book 7's dice expressions never need more than 6 dice (e.g. '6D', or
// '2D-2D' consuming 4) — 8 pre-rolled dice per evaluation is a generous
// fixed batch, same convention as rollQty's callers in market-tick.js.
function rollDiceBatch(rng, n = 8) {
  return Array.from({ length: n }, () => d6(rng))
}

// Clamp a population UWP digit to the table's defined range (0-9, A) —
// higher population codes (MgT2022-style B/C+) reuse A's row, the highest
// defined band, same clamping convention used elsewhere in this app.
function clampPopRow(popDigit, table) {
  const key = String(popDigit ?? '').toUpperCase()
  if (table[key]) return table[key]
  const n = parseInt(key, 16)
  if (!Number.isNaN(n) && n > 10) return table['A']
  return table['0']
}

/**
 * Generate one tick's passenger/freight availability counts for a ship,
 * for a specific origin→destination route.
 *
 * @param {object} opts.world       — origin world {Hex, UWP, Remarks, Zone, ...}
 * @param {string} opts.sectorName  — origin sector
 * @param {object} opts.destWorld   — destination world {Hex, UWP, Zone, ...}
 * @param {string} opts.destSectorName
 * @param {string} opts.campaignId
 * @param {number} opts.tick
 * @param {string} opts.shipId
 * @param {number} [opts.crewStewardMax]    — highest Steward skill among current crew (High passengers)
 * @param {number} [opts.crewAdminMax]      — highest Admin skill among current crew (Middle passengers)
 * @param {number} [opts.crewStreetwiseMax] — highest Streetwise skill among current crew (Low passengers)
 * @param {number} [opts.crewLiaisonMax]    — highest Liaison skill among current crew (Minor cargo)
 * @returns {object} row shape for traffic_snapshots (basic_passages/mail_containers always 0 — not modeled for CT7)
 */
export function generateCT7TrafficSnapshot({
  world, sectorName, destWorld, destSectorName, campaignId, tick, shipId,
  crewStewardMax = 0, crewAdminMax = 0, crewStreetwiseMax = 0, crewLiaisonMax = 0,
}) {
  const uwp      = world.UWP || ''
  const popDigit = uwp[4]
  const sourceTL = techFromUWP(uwp)

  const destUwp      = destWorld?.UWP || ''
  const destPopDigit = destUwp[4]
  const destTL        = techFromUWP(destUwp)
  const destZone      = destWorld?.Zone

  const tlDM = ct7TrafficTLDM(sourceTL, destTL)

  const routeKey     = `${world.Hex}:${destWorld?.Hex ?? ''}`
  const passengerRng = makeRng(`${campaignId}:${routeKey}:${shipId}:ct7traffic:passenger:${tick}:v1`)
  const freightRng   = makeRng(`${campaignId}:${routeKey}:${shipId}:ct7traffic:freight:${tick}:v1`)

  // ── Passengers ────────────────────────────────────────────────────────────
  const passengerRow  = clampPopRow(popDigit, CT7_PASSENGER_AVAILABILITY)
  const passengerZoneDM = ct7PassengerZoneDM(destZone)
  const passengerSkillDM = { high: crewStewardMax, middle: crewAdminMax, low: crewStreetwiseMax }

  const passengerTiers = {}
  for (const tier of ['high', 'middle', 'low']) {
    if (ct7PassengerZoneBlocked(destZone, tier)) { passengerTiers[tier] = 0; continue }
    const dm = ct7PassengerPopulationDM(destPopDigit) + passengerZoneDM + tlDM + passengerSkillDM[tier]
    passengerTiers[tier] = rollCT7Availability(passengerRow[tier], rollDiceBatch(passengerRng), dm)
  }

  // ── Freight ───────────────────────────────────────────────────────────────
  const cargoRow      = clampPopRow(popDigit, CT7_CARGO_AVAILABILITY)
  const cargoSkillDM   = { major: 0, minor: crewLiaisonMax, incidental: 0 }

  const freightTiers = {}
  for (const tier of ['major', 'minor', 'incidental']) {
    if (ct7CargoZoneBlocked(destZone, tier)) { freightTiers[tier] = 0; continue }
    const dm = ct7CargoPopulationDM(destPopDigit) + tlDM + cargoSkillDM[tier]
    freightTiers[tier] = rollCT7Availability(cargoRow[tier], rollDiceBatch(freightRng), dm)
  }

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
    basic_passages:          0,
    low_passages:            passengerTiers.low,
    major_freight_lots:      freightTiers.major,
    minor_freight_lots:      freightTiers.minor,
    incidental_freight_lots: freightTiers.incidental,
    mail_containers:         0,
  }
}
