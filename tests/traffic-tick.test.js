import { describe, it, expect } from 'vitest'
import { generateTrafficSnapshot } from '../src/lib/traffic-tick.js'

const testWorld = { Hex: '0101', UWP: 'A788899-C', Remarks: 'Ag Ri' }

describe('generateTrafficSnapshot', () => {
  it('returns the expected row shape', () => {
    const row = generateTrafficSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 1 })
    expect(row).toMatchObject({
      campaign_id: 'c1',
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

  it('is deterministic — same inputs produce identical rows', () => {
    const a = generateTrafficSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 4 })
    const b = generateTrafficSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 4 })
    expect(a).toEqual(b)
  })

  it('different ticks produce different rolls', () => {
    const a = generateTrafficSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 1 })
    const b = generateTrafficSnapshot({ world: testWorld, sectorName: 'Test', campaignId: 'c1', tick: 2 })
    expect(a).not.toEqual({ ...b, tick: a.tick })
  })

  it('a high-population world rolls at least as much traffic on average as a low-population one', () => {
    const highPop = { Hex: '0202', UWP: 'AC88C99-C', Remarks: 'Hi Ri' } // pop digit 'C'
    const lowPop  = { Hex: '0303', UWP: 'A788099-C', Remarks: 'Lo' }    // pop digit '0'

    let highTotal = 0
    let lowTotal  = 0
    for (let t = 0; t < 30; t++) {
      const h = generateTrafficSnapshot({ world: highPop, sectorName: 'Test', campaignId: 'c1', tick: t })
      const l = generateTrafficSnapshot({ world: lowPop,  sectorName: 'Test', campaignId: 'c1', tick: t })
      highTotal += h.high_passages + h.middle_passages + h.basic_passages + h.low_passages
      lowTotal  += l.high_passages + l.middle_passages + l.basic_passages + l.low_passages
    }
    expect(highTotal).toBeGreaterThan(lowTotal)
  })
})
