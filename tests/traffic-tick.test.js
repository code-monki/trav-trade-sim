import { describe, it, expect } from 'vitest'
import { generateTrafficSnapshot } from '../src/lib/traffic-tick.js'
import {
  passengerTrafficDiceCount,
  freightTrafficDiceCount,
  passengerZoneTrafficDM,
  freightZoneTrafficDM,
  mailTechLevelDM,
  techLevelTrafficDM,
  MGT2022_PASSENGER_POPULATION_TRAFFIC_DM,
  MGT2022_FREIGHT_POPULATION_TRAFFIC_DM,
  MGT2022_STARPORT_TRAFFIC_DM,
} from '../src/lib/traveller-data-mgt2022.js'

const testWorld = { Hex: '0101', UWP: 'A788899-C', Remarks: 'Ag Ri' }

// ── Data tables ──────────────────────────────────────────────────────────────

describe('passengerTrafficDiceCount vs freightTrafficDiceCount', () => {
  it('agree at the low and high ends', () => {
    for (const dm of [1, 2, 3, 17, 18, 19, 20, 25]) {
      expect(passengerTrafficDiceCount(dm)).toBe(freightTrafficDiceCount(dm))
    }
  })

  it('diverge at rolls 6, 9, 10, 12, 13, 15 — confirmed against the book\'s own tables', () => {
    expect(passengerTrafficDiceCount(6)).toBe(2)
    expect(freightTrafficDiceCount(6)).toBe(3)

    expect(passengerTrafficDiceCount(9)).toBe(3)
    expect(freightTrafficDiceCount(9)).toBe(4)

    expect(passengerTrafficDiceCount(10)).toBe(3)
    expect(freightTrafficDiceCount(10)).toBe(4)

    expect(passengerTrafficDiceCount(12)).toBe(4)
    expect(freightTrafficDiceCount(12)).toBe(5)

    expect(passengerTrafficDiceCount(13)).toBe(4)
    expect(freightTrafficDiceCount(13)).toBe(5)

    expect(passengerTrafficDiceCount(15)).toBe(5)
    expect(freightTrafficDiceCount(15)).toBe(6)
  })

  it('both yield 0 at 1 or less, and 10 at 20 or more', () => {
    expect(passengerTrafficDiceCount(1)).toBe(0)
    expect(freightTrafficDiceCount(1)).toBe(0)
    expect(passengerTrafficDiceCount(25)).toBe(10)
    expect(freightTrafficDiceCount(25)).toBe(10)
  })
})

describe('Population/Zone/Starport traffic DM tables', () => {
  it('Passenger population DM is less punishing than Freight\'s at the high end', () => {
    expect(MGT2022_PASSENGER_POPULATION_TRAFFIC_DM[6]).toBe(1)
    expect(MGT2022_FREIGHT_POPULATION_TRAFFIC_DM[6]).toBe(2)
    expect(MGT2022_PASSENGER_POPULATION_TRAFFIC_DM[8]).toBe(3)
    expect(MGT2022_FREIGHT_POPULATION_TRAFFIC_DM[8]).toBe(4)
  })

  it('both agree at Population 1 or less', () => {
    expect(MGT2022_PASSENGER_POPULATION_TRAFFIC_DM[1]).toBe(-4)
    expect(MGT2022_FREIGHT_POPULATION_TRAFFIC_DM[1]).toBe(-4)
  })

  it('Starport DM is shared between Passenger and Freight', () => {
    expect(MGT2022_STARPORT_TRAFFIC_DM).toEqual({ A: 2, B: 1, C: 0, D: 0, E: -1, X: -3 })
  })

  it('Zone DM diverges — Amber is a bonus for Passengers but a penalty for Freight', () => {
    expect(passengerZoneTrafficDM('A')).toBe(1)
    expect(freightZoneTrafficDM('A')).toBe(-2)
    expect(passengerZoneTrafficDM('R')).toBe(-4)
    expect(freightZoneTrafficDM('R')).toBe(-6)
    expect(passengerZoneTrafficDM(null)).toBe(0)
    expect(freightZoneTrafficDM(null)).toBe(0)
  })

  it('Mail\'s Tech Level threshold differs from Freight\'s', () => {
    expect(mailTechLevelDM(5)).toBe(-2)
    expect(mailTechLevelDM(6)).toBe(0)
    expect(techLevelTrafficDM(6)).toBe(-1)
    expect(techLevelTrafficDM(9)).toBe(2)
  })
})

// ── generateTrafficSnapshot ──────────────────────────────────────────────────

describe('generateTrafficSnapshot', () => {
  it('returns the expected row shape, including ship_id', () => {
    const row = generateTrafficSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 1, shipId: 'ship-a' })
    expect(row).toMatchObject({
      campaign_id: 'c1',
      ship_id:     'ship-a',
      world_hex:   '0101',
      sector:      'Test',
      tick:        1,
    })
    for (const key of [
      'high_passages', 'middle_passages', 'basic_passages', 'low_passages',
      'major_freight_lots', 'minor_freight_lots', 'incidental_freight_lots',
      'mail_containers',
    ]) {
      expect(typeof row[key]).toBe('number')
      expect(row[key]).toBeGreaterThanOrEqual(0)
    }
  })

  it('is deterministic — same inputs (including shipId) produce identical rows', () => {
    const a = generateTrafficSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 4, shipId: 'ship-a' })
    const b = generateTrafficSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 4, shipId: 'ship-a' })
    expect(a).toEqual(b)
  })

  it('two different ships at the same world/tick get independent results', () => {
    const a = generateTrafficSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 4, shipId: 'ship-a' })
    const b = generateTrafficSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 4, shipId: 'ship-b' })
    expect(a).not.toEqual({ ...b, ship_id: a.ship_id })
  })

  it('different ticks produce different rolls', () => {
    const a = generateTrafficSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 1, shipId: 'ship-a' })
    const b = generateTrafficSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 2, shipId: 'ship-a' })
    expect(a).not.toEqual({ ...b, tick: a.tick })
  })

  it('a high-population world rolls at least as much traffic on average as a low-population one', () => {
    const highPop = { Hex: '0202', UWP: 'AC88C99-C', Remarks: 'Hi Ri' } // pop digit 'C'
    const lowPop  = { Hex: '0303', UWP: 'A788099-C', Remarks: 'Lo' }    // pop digit '0'

    let highTotal = 0
    let lowTotal  = 0
    for (let t = 0; t < 30; t++) {
      const h = generateTrafficSnapshot({ world: highPop, sectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a' })
      const l = generateTrafficSnapshot({ world: lowPop,  sectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a' })
      highTotal += h.high_passages + h.middle_passages + h.basic_passages + h.low_passages
      lowTotal  += l.high_passages + l.middle_passages + l.basic_passages + l.low_passages
    }
    expect(highTotal).toBeGreaterThan(lowTotal)
  })

  it('a higher Steward skill increases passenger traffic on average, without affecting freight', () => {
    let stewardedPassengers = 0, unstaffedPassengers = 0
    let stewardedFreight = 0,    unstaffedFreight = 0
    for (let t = 0; t < 40; t++) {
      const staffed   = generateTrafficSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a', crewStewardMax: 4 })
      const unstaffed  = generateTrafficSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a', crewStewardMax: 0 })
      stewardedPassengers += staffed.high_passages + staffed.middle_passages + staffed.basic_passages + staffed.low_passages
      unstaffedPassengers += unstaffed.high_passages + unstaffed.middle_passages + unstaffed.basic_passages + unstaffed.low_passages
      stewardedFreight += staffed.major_freight_lots + staffed.minor_freight_lots + staffed.incidental_freight_lots
      unstaffedFreight += unstaffed.major_freight_lots + unstaffed.minor_freight_lots + unstaffed.incidental_freight_lots
    }
    expect(stewardedPassengers).toBeGreaterThan(unstaffedPassengers)
    expect(stewardedFreight).toBe(unstaffedFreight) // Steward only ever feeds the passenger roll
  })

  it('a higher Broker/Streetwise skill increases freight traffic on average, without affecting passengers', () => {
    let skilledFreight = 0, unskilledFreight = 0
    let skilledPassengers = 0, unskilledPassengers = 0
    for (let t = 0; t < 40; t++) {
      const skilled   = generateTrafficSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a', crewFreightCheckMax: 4 })
      const unskilled  = generateTrafficSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a', crewFreightCheckMax: 0 })
      skilledFreight   += skilled.major_freight_lots + skilled.minor_freight_lots + skilled.incidental_freight_lots
      unskilledFreight += unskilled.major_freight_lots + unskilled.minor_freight_lots + unskilled.incidental_freight_lots
      skilledPassengers   += skilled.high_passages + skilled.middle_passages + skilled.basic_passages + skilled.low_passages
      unskilledPassengers += unskilled.high_passages + unskilled.middle_passages + unskilled.basic_passages + unskilled.low_passages
    }
    expect(skilledFreight).toBeGreaterThan(unskilledFreight)
    expect(skilledPassengers).toBe(unskilledPassengers) // Freight's own check never feeds the passenger roll
  })

  it('an armed ship gets more mail on average than an unarmed one, all else equal', () => {
    let armedHits = 0, unarmedHits = 0
    for (let t = 0; t < 60; t++) {
      const armed   = generateTrafficSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a', shipArmed: true })
      const unarmed = generateTrafficSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a', shipArmed: false })
      if (armed.mail_containers > 0) armedHits++
      if (unarmed.mail_containers > 0) unarmedHits++
    }
    expect(armedHits).toBeGreaterThanOrEqual(unarmedHits)
  })

  it('a higher crew SOC and Naval/Scout rank increase mail availability on average', () => {
    let boostedHits = 0, plainHits = 0
    for (let t = 0; t < 60; t++) {
      const boosted = generateTrafficSnapshot({
        world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a',
        crewNavalScoutRankMax: 4, crewSocialStandingMax: 14,
      })
      const plain = generateTrafficSnapshot({
        world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a',
        crewNavalScoutRankMax: 0, crewSocialStandingMax: null,
      })
      if (boosted.mail_containers > 0) boostedHits++
      if (plain.mail_containers > 0) plainHits++
    }
    expect(boostedHits).toBeGreaterThanOrEqual(plainHits)
  })
})
