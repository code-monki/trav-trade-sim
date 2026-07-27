import { describe, it, expect } from 'vitest'
import { generateCT7TrafficSnapshot } from '../src/lib/ct7-traffic-tick.js'

const originWorld = { Hex: '0101', UWP: 'A788899-9', Remarks: '', Zone: null } // pop digit '8', TL 9
const destWorld    = { Hex: '0202', UWP: 'A788899-9', Remarks: '', Zone: null } // same shape, different hex

function sumPassengers(row) { return row.high_passages + row.middle_passages + row.low_passages }
function sumFreight(row)    { return row.major_freight_lots + row.minor_freight_lots + row.incidental_freight_lots }

describe('generateCT7TrafficSnapshot', () => {
  it('returns the expected row shape, with basic_passages/mail_containers always 0 (not modeled for CT7)', () => {
    const row = generateCT7TrafficSnapshot({
      world: originWorld, sectorName: 'Test', destWorld, destSectorName: 'Test', campaignId: 'c1', tick: 1, shipId: 'ship-a',
    })
    expect(row).toMatchObject({
      campaign_id: 'c1', ship_id: 'ship-a', world_hex: '0101', sector: 'Test',
      dest_world_hex: '0202', dest_sector: 'Test', tick: 1,
      basic_passages: 0, mail_containers: 0,
    })
    for (const key of ['high_passages', 'middle_passages', 'low_passages', 'major_freight_lots', 'minor_freight_lots', 'incidental_freight_lots']) {
      expect(typeof row[key]).toBe('number')
      expect(row[key]).toBeGreaterThanOrEqual(0)
    }
  })

  it('is deterministic — same inputs produce identical rows', () => {
    const a = generateCT7TrafficSnapshot({ world: originWorld, sectorName: 'Test', destWorld, destSectorName: 'Test', campaignId: 'c1', tick: 4, shipId: 'ship-a' })
    const b = generateCT7TrafficSnapshot({ world: originWorld, sectorName: 'Test', destWorld, destSectorName: 'Test', campaignId: 'c1', tick: 4, shipId: 'ship-a' })
    expect(a).toEqual(b)
  })

  it('two different ships at the same route/tick get independent results', () => {
    const a = generateCT7TrafficSnapshot({ world: originWorld, sectorName: 'Test', destWorld, destSectorName: 'Test', campaignId: 'c1', tick: 4, shipId: 'ship-a' })
    const b = generateCT7TrafficSnapshot({ world: originWorld, sectorName: 'Test', destWorld, destSectorName: 'Test', campaignId: 'c1', tick: 4, shipId: 'ship-b' })
    expect(a).not.toEqual({ ...b, ship_id: a.ship_id })
  })

  it('is route-aware — same origin/ship/tick, two different destinations, produce independent results', () => {
    const destB = { Hex: '0303', UWP: 'A788899-9', Remarks: '', Zone: null }
    const a = generateCT7TrafficSnapshot({ world: originWorld, sectorName: 'Test', destWorld, destSectorName: 'Test', campaignId: 'c1', tick: 4, shipId: 'ship-a' })
    const b = generateCT7TrafficSnapshot({ world: originWorld, sectorName: 'Test', destWorld: destB, destSectorName: 'Test', campaignId: 'c1', tick: 4, shipId: 'ship-a' })
    expect(a).not.toEqual({ ...b, dest_world_hex: a.dest_world_hex })
  })

  it('a higher-population destination increases passenger/freight traffic on average', () => {
    const highPopDest = { Hex: '0202', UWP: 'A788A99-9', Remarks: '', Zone: null } // pop 'A'
    const lowPopDest  = { Hex: '0303', UWP: 'A788099-9', Remarks: '', Zone: null } // pop '0'

    let highTotal = 0, lowTotal = 0
    for (let t = 0; t < 30; t++) {
      const h = generateCT7TrafficSnapshot({ world: originWorld, sectorName: 'Test', destWorld: highPopDest, destSectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a' })
      const l = generateCT7TrafficSnapshot({ world: originWorld, sectorName: 'Test', destWorld: lowPopDest,  destSectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a' })
      highTotal += sumPassengers(h) + sumFreight(h)
      lowTotal  += sumPassengers(l) + sumFreight(l)
    }
    expect(highTotal).toBeGreaterThan(lowTotal)
  })

  it('a Red Zone destination blocks Middle/Low passengers and all Freight, but High passengers can still roll', () => {
    const redDest = { Hex: '0202', UWP: 'A788899-9', Remarks: '', Zone: 'R' }
    let anyHigh = false
    for (let t = 0; t < 20; t++) {
      const row = generateCT7TrafficSnapshot({ world: originWorld, sectorName: 'Test', destWorld: redDest, destSectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a' })
      expect(row.middle_passages).toBe(0)
      expect(row.low_passages).toBe(0)
      expect(row.major_freight_lots).toBe(0)
      expect(row.minor_freight_lots).toBe(0)
      expect(row.incidental_freight_lots).toBe(0)
      if (row.high_passages > 0) anyHigh = true
    }
    expect(anyHigh).toBe(true)
  })

  it('an Amber Zone destination blocks Major freight only, leaving Minor/Incidental and Passengers unblocked', () => {
    const amberDest = { Hex: '0202', UWP: 'A788899-9', Remarks: '', Zone: 'A' }
    let anyMinor = false, anyHighPassenger = false
    for (let t = 0; t < 20; t++) {
      const row = generateCT7TrafficSnapshot({ world: originWorld, sectorName: 'Test', destWorld: amberDest, destSectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a' })
      expect(row.major_freight_lots).toBe(0)
      if (row.minor_freight_lots > 0) anyMinor = true
      if (row.high_passages > 0) anyHighPassenger = true
    }
    expect(anyMinor).toBe(true)
    expect(anyHighPassenger).toBe(true)
  })

  it('a higher Steward skill increases High passengers on average, without affecting Middle/Low/Freight', () => {
    let steweredHigh = 0, unstaffedHigh = 0
    let steweredOther = 0, unstaffedOther = 0
    for (let t = 0; t < 40; t++) {
      const staffed   = generateCT7TrafficSnapshot({ world: originWorld, sectorName: 'Test', destWorld, destSectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a', crewStewardMax: 4 })
      const unstaffed = generateCT7TrafficSnapshot({ world: originWorld, sectorName: 'Test', destWorld, destSectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a', crewStewardMax: 0 })
      steweredHigh  += staffed.high_passages
      unstaffedHigh += unstaffed.high_passages
      steweredOther  += staffed.middle_passages + staffed.low_passages + sumFreight(staffed)
      unstaffedOther += unstaffed.middle_passages + unstaffed.low_passages + sumFreight(unstaffed)
    }
    expect(steweredHigh).toBeGreaterThan(unstaffedHigh)
    expect(steweredOther).toBe(unstaffedOther) // Steward must never perturb any other roll
  })

  it('a higher Admin skill increases Middle passengers on average, without affecting High/Low/Freight', () => {
    let boostedMiddle = 0, plainMiddle = 0
    let boostedOther = 0, plainOther = 0
    for (let t = 0; t < 40; t++) {
      const boosted = generateCT7TrafficSnapshot({ world: originWorld, sectorName: 'Test', destWorld, destSectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a', crewAdminMax: 4 })
      const plain   = generateCT7TrafficSnapshot({ world: originWorld, sectorName: 'Test', destWorld, destSectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a', crewAdminMax: 0 })
      boostedMiddle += boosted.middle_passages
      plainMiddle   += plain.middle_passages
      boostedOther  += boosted.high_passages + boosted.low_passages + sumFreight(boosted)
      plainOther    += plain.high_passages + plain.low_passages + sumFreight(plain)
    }
    expect(boostedMiddle).toBeGreaterThan(plainMiddle)
    expect(boostedOther).toBe(plainOther)
  })

  it('a higher Streetwise skill increases Low passengers on average, without affecting High/Middle/Freight', () => {
    let boostedLow = 0, plainLow = 0
    let boostedOther = 0, plainOther = 0
    for (let t = 0; t < 40; t++) {
      const boosted = generateCT7TrafficSnapshot({ world: originWorld, sectorName: 'Test', destWorld, destSectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a', crewStreetwiseMax: 4 })
      const plain   = generateCT7TrafficSnapshot({ world: originWorld, sectorName: 'Test', destWorld, destSectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a', crewStreetwiseMax: 0 })
      boostedLow += boosted.low_passages
      plainLow   += plain.low_passages
      boostedOther += boosted.high_passages + boosted.middle_passages + sumFreight(boosted)
      plainOther   += plain.high_passages + plain.middle_passages + sumFreight(plain)
    }
    expect(boostedLow).toBeGreaterThan(plainLow)
    expect(boostedOther).toBe(plainOther)
  })

  it('a higher Liaison skill increases Minor cargo on average, without affecting Major/Incidental/Passengers', () => {
    let boostedMinor = 0, plainMinor = 0
    let boostedOther = 0, plainOther = 0
    for (let t = 0; t < 40; t++) {
      const boosted = generateCT7TrafficSnapshot({ world: originWorld, sectorName: 'Test', destWorld, destSectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a', crewLiaisonMax: 4 })
      const plain   = generateCT7TrafficSnapshot({ world: originWorld, sectorName: 'Test', destWorld, destSectorName: 'Test', campaignId: 'c1', tick: t, shipId: 'ship-a', crewLiaisonMax: 0 })
      boostedMinor += boosted.minor_freight_lots
      plainMinor   += plain.minor_freight_lots
      boostedOther += boosted.major_freight_lots + boosted.incidental_freight_lots + sumPassengers(boosted)
      plainOther   += plain.major_freight_lots + plain.incidental_freight_lots + sumPassengers(plain)
    }
    expect(boostedMinor).toBeGreaterThan(plainMinor)
    expect(boostedOther).toBe(plainOther)
  })
})
