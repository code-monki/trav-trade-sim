import { describe, it, expect } from 'vitest'
import {
  randomCampaignLabel, campaignCodeFrom, randomCharacterName,
  yearForMilieu, randomCampaignDefaults,
} from '../src/lib/campaign-generator.js'
import { makeRng } from '../src/lib/market-tick.js'
import { MILIEUS, TRADE_RULESETS } from '../src/lib/traveller-data.js'

const MILIEU_CODES = MILIEUS.map(m => m.code)
const RULESET_CODES = TRADE_RULESETS.map(r => r.code)

describe('campaign-generator — labels and codes', () => {
  it('label is a non-empty multi-word phrase', () => {
    const label = randomCampaignLabel(makeRng('label:v1'))
    expect(label.trim().split(/\s+/).length).toBeGreaterThanOrEqual(2)
  })

  it('code follows the SPINWARD-42 idiom: label first word, uppercase, 1–99 suffix', () => {
    const code = campaignCodeFrom('Spinward Marches Run', makeRng('code:v1'))
    expect(code).toMatch(/^SPINWARD-([1-9]|[1-9][0-9])$/)
  })

  it('code survives the form input transform unchanged (uppercase, no spaces)', () => {
    const rng = makeRng('transform:v1')
    for (let i = 0; i < 50; i++) {
      const code = campaignCodeFrom(randomCampaignLabel(rng), rng)
      expect(code).toBe(code.toUpperCase().replace(/\s+/g, '-'))
    }
  })

  it('is deterministic for a given seed', () => {
    expect(randomCampaignDefaults(makeRng('seed:v1')))
      .toEqual(randomCampaignDefaults(makeRng('seed:v1')))
  })
})

describe('campaign-generator — yearForMilieu', () => {
  it('extracts the year from Mxxxx codes', () => {
    expect(yearForMilieu('M1105')).toBe(1105)
    expect(yearForMilieu('M0')).toBe(0)
    expect(yearForMilieu('M1900')).toBe(1900)
  })

  it('dates Interstellar Wars in AD', () => {
    expect(yearForMilieu('IW')).toBe(2170)
  })

  it('falls back to the Classic Era for unknown codes', () => {
    expect(yearForMilieu('BOGUS')).toBe(1105)
    expect(yearForMilieu(undefined)).toBe(1105)
  })

  it('stays within the form bounds (0–2500) for every defined milieu', () => {
    for (const code of MILIEU_CODES) {
      const year = yearForMilieu(code)
      expect(year).toBeGreaterThanOrEqual(0)
      expect(year).toBeLessThanOrEqual(2500)
    }
  })
})

describe('campaign-generator — randomCampaignDefaults', () => {
  it('only produces values the form already accepts', () => {
    const rng = makeRng('defaults:v1')
    for (let i = 0; i < 100; i++) {
      const d = randomCampaignDefaults(rng)
      expect(d.label).toBeTruthy()
      expect(d.characterName).toBeTruthy()
      expect(MILIEU_CODES).toContain(d.milieu)
      expect(RULESET_CODES).toContain(d.tradeRules)
      expect(d.startDay).toBeGreaterThanOrEqual(1)
      expect(d.startDay).toBeLessThanOrEqual(365)
      expect(d.startYear).toBe(yearForMilieu(d.milieu))
    }
  })

  it('never proposes a PIN', () => {
    expect(randomCampaignDefaults(makeRng('nopin:v1'))).not.toHaveProperty('pin')
  })
})
