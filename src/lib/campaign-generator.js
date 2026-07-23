// ── Random campaign defaults ──────────────────────────────────────────────────
// Pure generators behind the New Campaign form's pre-fill and 🎲 Randomize
// button. Every function takes an rng (a () => [0,1) function such as
// Math.random, or makeRng from market-tick.js) so tests can drive them
// deterministically.

import { MILIEUS, TRADE_RULESETS } from './traveller-data.js'

const REGIONS = [
  'Spinward', 'Trailing', 'Rimward', 'Coreward', 'Solomani', 'Vilani',
  'Deneb', 'Corridor', 'Vland', 'Sylean', 'Zhodani', 'Aslan',
]

const EXPANSES = [
  'Marches', 'Reach', 'Verge', 'Main', 'Cluster', 'Drift',
  'Expanse', 'Frontier', 'Rift', 'Veil',
]

const VENTURES = [
  'Run', 'Venture', 'Circuit', 'Charter', 'Concern',
  'Route', 'Gambit', 'Wager', 'Account', 'Exchange',
]

const RANKS = [
  'Capt', 'Cmdr', 'Lt', 'Baron', 'Baroness',
  'Sir', 'Dame', 'Marquis', 'Marchioness', 'Prof',
]

const GIVEN_NAMES = [
  'Alexander', 'Mira', 'Norris', 'Arbellatra', 'Cleon', 'Dulinor',
  'Jamison', 'Zhara', 'Kirin', 'Soren', 'Ilsa', 'Yuri', 'Tavas', 'Ondine',
]

const SURNAMES = [
  'Alkhalikoi', 'hault-Devroe', 'Muudashir', 'Oberlindes', 'Tukera',
  'Rearden', 'Voss', 'Delacroix', 'Ishimura', 'Krenstein', 'Barlow', 'Greer',
]

function pick(list, rng) { return list[Math.floor(rng() * list.length)] }

export function randomCampaignLabel(rng = Math.random) {
  return `${pick(REGIONS, rng)} ${pick(EXPANSES, rng)} ${pick(VENTURES, rng)}`
}

// Derives a shareable code in the placeholder's "SPINWARD-42" idiom: the
// label's first word uppercased plus a 1–99 suffix. Output already satisfies
// the form's uppercase/no-spaces input transform.
export function campaignCodeFrom(label, rng = Math.random) {
  const word = (label.trim().split(/\s+/)[0] || 'FREE-TRADER').toUpperCase()
  return `${word}-${Math.floor(rng() * 99) + 1}`
}

export function randomCharacterName(rng = Math.random) {
  return `${pick(RANKS, rng)} ${pick(GIVEN_NAMES, rng)} ${pick(SURNAMES, rng)}`
}

// Canonical in-game year for each milieu, so a randomized milieu and starting
// year never contradict each other. Mxxxx codes carry their year; IW (GURPS
// Interstellar Wars) is dated in AD. Unknown codes fall back to the Classic
// Era default the form already uses.
export function yearForMilieu(code) {
  if (code === 'IW') return 2170
  const m = /^M(\d+)$/.exec(code || '')
  return m ? parseInt(m[1], 10) : 1105
}

// Everything the New Campaign form needs except the PIN, which stays the
// referee's own choice.
export function randomCampaignDefaults(rng = Math.random) {
  const label  = randomCampaignLabel(rng)
  const milieu = pick(MILIEUS, rng).code
  return {
    label,
    code:          campaignCodeFrom(label, rng),
    milieu,
    tradeRules:    pick(TRADE_RULESETS, rng).code,
    startYear:     yearForMilieu(milieu),
    startDay:      Math.floor(rng() * 365) + 1,
    characterName: randomCharacterName(rng),
  }
}
