/**
 * Mongoose Traveller 2022 (MgT2022) — Trade & Commerce data tables.
 *
 * Sourced from the MgT2022 Core Rulebook, "Trade and Commerce" (transcribed
 * directly from the rulebook text during a rules-accuracy review — see
 * DEVLOG.md). A kept-separate sibling to traveller-data.js (which holds CT7
 * + shared constants) rather than folded in, so this ruleset's 30-entry
 * goods table and its distinct DM shape don't get mixed with CT7's — the
 * same reasoning that led T5 astray by inlining its data into its engine
 * file instead.
 *
 * Zone pseudo-codes: Amber/Red Zone sale DMs are encoded as 'Am'/'Rz' in
 * saleDMs, matched the same way as real trade codes — market-tick.js's
 * MgT2022 generator adds these into the world's code set from `world.Zone`
 * before DM lookup, since Zone isn't a Remarks-tagged trade code.
 */

// ── Trade code parsing reuses CT7's allowlist ─────────────────────────────────
// Both editions' worlds are tagged with the same standard Traveller trade
// codes in sector data (Remarks field) — no numeric classifier exists
// anywhere in this codebase; both engines just filter pre-tagged tokens.
export { parseTradeCodes, starportFromUWP, techFromUWP, lawFromUWP } from './trade-engine-ct7.js'

// ── D66 Trade Goods table ──────────────────────────────────────────────────────
// availability: 'All' (Common Goods — every world) or an array of trade
// codes, at least one of which the world must have for a supplier to offer
// this good at all (see Phase 3: goods composition).
// purchaseDMs / saleDMs: array of { code, dm } — standard trade codes (Ag,
// As, Ba, De, Fl, Ga, Hi, Ht, Ic, In, Lo, Lt, Na, Ni, Po, Ri, Va, Wa) plus
// the 'Am'/'Rz' zone pseudo-codes described above. "Use only the largest
// from each column" when multiple match — see maxTradeCodeDMs().
// illegal: true marks goods with a flat "universally illegal" Sale DM
// (already baked into saleDMs) needing no further Law Level check.
// bannedLawLevel: for goods where the book gives (or its own worked example
// implies) a concrete "banned at Law Level X" threshold — smugglingRiskDM()
// adds `world's Law Level - bannedLawLevel` as an extra Sale DM when
// positive. Most illegal goods don't have book-given numbers for this and
// stay on their flat illegal Sale DM alone (bannedLawLevel: null).
//
// D66=66 Exotics is deliberately excluded — the book treats it as outside
// the normal trade rules entirely ("a matter for roleplaying and
// adventure"), not a priced commodity. Never include it in the D66 roll pool.
export const MGT2022_TRADE_GOODS = [
  { die: '11', name: 'Common Electronics',          category: 'Electronics',   availability: 'All',                  basePriceCr:   20000, qty: '2Dx10', purchaseDMs: [{ code:'In', dm:+2 },{ code:'Ht', dm:+3 },{ code:'Ri', dm:+1 }], saleDMs: [{ code:'Ni', dm:+2 },{ code:'Lt', dm:+1 },{ code:'Po', dm:+1 }], illegal: false, bannedLawLevel: null },
  { die: '12', name: 'Common Industrial Goods',     category: 'Industrial',    availability: 'All',                  basePriceCr:   10000, qty: '2Dx10', purchaseDMs: [{ code:'Na', dm:+2 },{ code:'In', dm:+5 }],                     saleDMs: [{ code:'Ni', dm:+3 },{ code:'Ag', dm:+2 }],                     illegal: false, bannedLawLevel: null },
  { die: '13', name: 'Common Manufactured Goods',   category: 'Manufactured',  availability: 'All',                  basePriceCr:   20000, qty: '2Dx10', purchaseDMs: [{ code:'Na', dm:+2 },{ code:'In', dm:+5 }],                     saleDMs: [{ code:'Ni', dm:+3 },{ code:'Hi', dm:+2 }],                     illegal: false, bannedLawLevel: null },
  { die: '14', name: 'Common Raw Materials',        category: 'Raw Materials', availability: 'All',                  basePriceCr:    5000, qty: '2Dx20', purchaseDMs: [{ code:'Ag', dm:+3 },{ code:'Ga', dm:+2 }],                     saleDMs: [{ code:'In', dm:+2 },{ code:'Po', dm:+2 }],                     illegal: false, bannedLawLevel: null },
  { die: '15', name: 'Common Consumables',          category: 'Consumables',   availability: 'All',                  basePriceCr:     500, qty: '2Dx20', purchaseDMs: [{ code:'Ag', dm:+3 },{ code:'Wa', dm:+2 },{ code:'Ga', dm:+1 },{ code:'As', dm:-4 }], saleDMs: [{ code:'As', dm:+1 },{ code:'Fl', dm:+1 },{ code:'Ic', dm:+1 },{ code:'Hi', dm:+1 }], illegal: false, bannedLawLevel: null },
  { die: '16', name: 'Common Ore',                  category: 'Ore',          availability: 'All',                  basePriceCr:    1000, qty: '2Dx20', purchaseDMs: [{ code:'As', dm:+4 }],                                           saleDMs: [{ code:'In', dm:+3 },{ code:'Ni', dm:+1 }],                     illegal: false, bannedLawLevel: null },
  { die: '21', name: 'Advanced Electronics',        category: 'Electronics',   availability: ['In','Ht'],            basePriceCr:  100000, qty: '1Dx5',  purchaseDMs: [{ code:'In', dm:+2 },{ code:'Ht', dm:+3 }],                     saleDMs: [{ code:'Ni', dm:+1 },{ code:'Ri', dm:+2 },{ code:'As', dm:+3 }], illegal: false, bannedLawLevel: null },
  { die: '22', name: 'Advanced Machine Parts',      category: 'Industrial',    availability: ['In','Ht'],            basePriceCr:   75000, qty: '1Dx5',  purchaseDMs: [{ code:'In', dm:+2 },{ code:'Ht', dm:+1 }],                     saleDMs: [{ code:'As', dm:+2 },{ code:'Ni', dm:+1 }],                     illegal: false, bannedLawLevel: null },
  { die: '23', name: 'Advanced Manufactured Goods', category: 'Manufactured',  availability: ['In','Ht'],            basePriceCr:  100000, qty: '1Dx5',  purchaseDMs: [{ code:'In', dm:+1 }],                                           saleDMs: [{ code:'Hi', dm:+1 },{ code:'Ri', dm:+2 }],                     illegal: false, bannedLawLevel: null },
  { die: '24', name: 'Advanced Weapons',            category: 'Weapons',       availability: ['In','Ht'],            basePriceCr:  150000, qty: '1Dx5',  purchaseDMs: [{ code:'Ht', dm:+2 }],                                           saleDMs: [{ code:'Po', dm:+1 },{ code:'Am', dm:+2 },{ code:'Rz', dm:+4 }], illegal: false, bannedLawLevel: 3 },
  { die: '25', name: 'Advanced Vehicles',           category: 'Vehicles',      availability: ['In','Ht'],            basePriceCr:  180000, qty: '1Dx5',  purchaseDMs: [{ code:'Ht', dm:+2 }],                                           saleDMs: [{ code:'As', dm:+2 },{ code:'Ri', dm:+2 }],                     illegal: false, bannedLawLevel: null },
  { die: '26', name: 'Biochemicals',                category: 'Biochemicals', availability: ['Ag','Wa'],            basePriceCr:   50000, qty: '1Dx5',  purchaseDMs: [{ code:'Ag', dm:+1 },{ code:'Wa', dm:+2 }],                     saleDMs: [{ code:'In', dm:+2 }],                                           illegal: false, bannedLawLevel: null },
  { die: '31', name: 'Crystals & Gems',             category: 'Minerals',      availability: ['As','De','Ic'],       basePriceCr:   20000, qty: '1Dx5',  purchaseDMs: [{ code:'As', dm:+2 },{ code:'De', dm:+1 },{ code:'Ic', dm:+1 }], saleDMs: [{ code:'In', dm:+3 },{ code:'Ri', dm:+2 }],                     illegal: false, bannedLawLevel: null },
  { die: '32', name: 'Cybernetics',                 category: 'Technology',    availability: ['Ht'],                 basePriceCr:  250000, qty: '1D',    purchaseDMs: [{ code:'Ht', dm:+1 }],                                           saleDMs: [{ code:'As', dm:+1 },{ code:'Ic', dm:+1 },{ code:'Ri', dm:+2 }], illegal: false, bannedLawLevel: null },
  { die: '33', name: 'Live Animals',                category: 'Animals',      availability: ['Ag','Ga'],            basePriceCr:   10000, qty: '1Dx10', purchaseDMs: [{ code:'Ag', dm:+2 }],                                           saleDMs: [{ code:'Lo', dm:+3 }],                                           illegal: false, bannedLawLevel: null },
  { die: '34', name: 'Luxury Consumables',          category: 'Luxury',       availability: ['Ag','Ga','Wa'],       basePriceCr:   20000, qty: '1Dx10', purchaseDMs: [{ code:'Ag', dm:+2 },{ code:'Wa', dm:+1 }],                     saleDMs: [{ code:'Ri', dm:+2 },{ code:'Hi', dm:+2 }],                     illegal: false, bannedLawLevel: null },
  { die: '35', name: 'Luxury Goods',                category: 'Luxury',       availability: ['Hi'],                 basePriceCr:  200000, qty: '1D',    purchaseDMs: [{ code:'Hi', dm:+1 }],                                           saleDMs: [{ code:'Ri', dm:+4 }],                                           illegal: false, bannedLawLevel: null },
  { die: '36', name: 'Medical Supplies',            category: 'Medical',      availability: ['Ht','Hi'],             basePriceCr:   50000, qty: '1Dx5',  purchaseDMs: [{ code:'Ht', dm:+2 }],                                           saleDMs: [{ code:'In', dm:+2 },{ code:'Po', dm:+1 },{ code:'Ri', dm:+1 }], illegal: false, bannedLawLevel: null },
  { die: '41', name: 'Petrochemicals',              category: 'Chemicals',    availability: ['De','Fl','Ic','Wa'],  basePriceCr:   10000, qty: '1Dx10', purchaseDMs: [{ code:'De', dm:+2 }],                                           saleDMs: [{ code:'In', dm:+2 },{ code:'Ag', dm:+1 },{ code:'Lt', dm:+2 }], illegal: false, bannedLawLevel: null },
  // Pharmaceuticals: legal per the book, but anagathics/medicinal drugs
  // within this category become contraband at Law Level 8+ — see the
  // drug-legality review (DEVLOG.md). bannedLawLevel here despite illegal:false.
  { die: '42', name: 'Pharmaceuticals',             category: 'Medical',      availability: ['As','De','Hi','Wa'],  basePriceCr:  100000, qty: '1D',    purchaseDMs: [{ code:'As', dm:+2 },{ code:'Hi', dm:+1 }],                     saleDMs: [{ code:'Ri', dm:+2 },{ code:'Lt', dm:+1 }],                     illegal: false, bannedLawLevel: 8 },
  { die: '43', name: 'Polymers',                    category: 'Chemicals',    availability: ['In'],                 basePriceCr:    7000, qty: '1Dx10', purchaseDMs: [{ code:'In', dm:+1 }],                                           saleDMs: [{ code:'Ri', dm:+2 },{ code:'Ni', dm:+1 }],                     illegal: false, bannedLawLevel: null },
  { die: '44', name: 'Precious Metals',             category: 'Minerals',     availability: ['As','De','Ic','Fl'],  basePriceCr:   50000, qty: '1D',    purchaseDMs: [{ code:'As', dm:+3 },{ code:'De', dm:+1 },{ code:'Ic', dm:+2 }], saleDMs: [{ code:'Ri', dm:+3 },{ code:'In', dm:+2 },{ code:'Ht', dm:+1 }], illegal: false, bannedLawLevel: null },
  { die: '45', name: 'Radioactives',                category: 'Ore',          availability: ['As','De','Lo'],       basePriceCr: 1000000, qty: '1D',    purchaseDMs: [{ code:'As', dm:+2 },{ code:'Lo', dm:+2 }],                     saleDMs: [{ code:'In', dm:+3 },{ code:'Ht', dm:+1 },{ code:'Ni', dm:-2 },{ code:'Ag', dm:-3 }], illegal: false, bannedLawLevel: null },
  { die: '46', name: 'Robots',                      category: 'Technology',   availability: ['In'],                 basePriceCr:  400000, qty: '1Dx5',  purchaseDMs: [{ code:'In', dm:+1 }],                                           saleDMs: [{ code:'Ag', dm:+2 },{ code:'Ht', dm:+1 }],                     illegal: false, bannedLawLevel: null },
  { die: '51', name: 'Spices',                      category: 'Consumables',  availability: ['Ga','De','Wa'],       basePriceCr:    6000, qty: '1Dx10', purchaseDMs: [{ code:'De', dm:+2 }],                                           saleDMs: [{ code:'Hi', dm:+2 },{ code:'Ri', dm:+3 },{ code:'Po', dm:+3 }], illegal: false, bannedLawLevel: null },
  { die: '52', name: 'Textiles',                    category: 'Manufactured', availability: ['Ag','Ni'],            basePriceCr:    3000, qty: '1Dx20', purchaseDMs: [{ code:'Ag', dm:+7 }],                                           saleDMs: [{ code:'Hi', dm:+3 },{ code:'Na', dm:+2 }],                     illegal: false, bannedLawLevel: null },
  { die: '53', name: 'Uncommon Ore',                category: 'Ore',          availability: ['As','Ic'],             basePriceCr:    5000, qty: '1Dx20', purchaseDMs: [{ code:'As', dm:+4 }],                                           saleDMs: [{ code:'In', dm:+3 },{ code:'Ni', dm:+1 }],                     illegal: false, bannedLawLevel: null },
  { die: '54', name: 'Uncommon Raw Materials',      category: 'Raw Materials', availability: ['Ag','De','Wa'],      basePriceCr:   20000, qty: '1Dx10', purchaseDMs: [{ code:'Ag', dm:+2 },{ code:'Wa', dm:+1 }],                     saleDMs: [{ code:'In', dm:+2 },{ code:'Ht', dm:+1 }],                     illegal: false, bannedLawLevel: null },
  { die: '55', name: 'Wood',                        category: 'Raw Materials', availability: ['Ag','Ga'],            basePriceCr:    1000, qty: '1Dx20', purchaseDMs: [{ code:'Ag', dm:+6 }],                                           saleDMs: [{ code:'Ri', dm:+2 },{ code:'In', dm:+1 }],                     illegal: false, bannedLawLevel: null },
  { die: '56', name: 'Vehicles',                    category: 'Vehicles',    availability: ['In','Ht'],            basePriceCr:   15000, qty: '1Dx10', purchaseDMs: [{ code:'In', dm:+2 },{ code:'Ht', dm:+1 }],                     saleDMs: [{ code:'Ni', dm:+2 },{ code:'Hi', dm:+1 }],                     illegal: false, bannedLawLevel: null },
  { die: '61', name: 'Illegal Biochemicals',        category: 'Illegal',      availability: ['Ag','Wa'],            basePriceCr:   50000, qty: '1Dx5',  purchaseDMs: [{ code:'Wa', dm:+2 }],                                           saleDMs: [{ code:'In', dm:+6 }],                                           illegal: true,  bannedLawLevel: null },
  { die: '62', name: 'Illegal Cybernetics',         category: 'Illegal',      availability: ['Ht'],                 basePriceCr:  250000, qty: '1D',    purchaseDMs: [{ code:'Ht', dm:+1 }],                                           saleDMs: [{ code:'As', dm:+4 },{ code:'Ic', dm:+4 },{ code:'Ri', dm:+8 },{ code:'Am', dm:+6 },{ code:'Rz', dm:+6 }], illegal: true, bannedLawLevel: null },
  { die: '63', name: 'Illegal Drugs',               category: 'Illegal',      availability: ['As','De','Hi','Wa'],  basePriceCr:  100000, qty: '1D',    purchaseDMs: [{ code:'As', dm:+1 },{ code:'De', dm:+1 },{ code:'Ga', dm:+1 },{ code:'Wa', dm:+1 }], saleDMs: [{ code:'Ri', dm:+6 },{ code:'Hi', dm:+6 }], illegal: true, bannedLawLevel: null },
  { die: '64', name: 'Illegal Luxuries',            category: 'Illegal',      availability: ['Ag','Ga','Wa'],       basePriceCr:   50000, qty: '1D',    purchaseDMs: [{ code:'Ag', dm:+2 },{ code:'Wa', dm:+1 }],                     saleDMs: [{ code:'Ri', dm:+6 },{ code:'Hi', dm:+4 }],                     illegal: true,  bannedLawLevel: null },
  { die: '65', name: 'Illegal Weapons',             category: 'Illegal',      availability: ['In','Ht'],            basePriceCr:  150000, qty: '1Dx5',  purchaseDMs: [{ code:'Ht', dm:+2 }],                                           saleDMs: [{ code:'Po', dm:+6 },{ code:'Am', dm:+8 },{ code:'Rz', dm:+10 }], illegal: true, bannedLawLevel: 1 },
]

// ── Determine Goods Available: quantity-roll population DM ───────────────────
// Keyed by the UWP Population digit/letter. "On Population 3- apply DM-3 to
// the roll for quantity... Population 9+ worlds... grant DM+3." Applied to
// the qty dice roll (before the ×multiplier), not the D66 which-goods roll.
export const MGT2022_POPULATION_AVAIL_DM = {
  0: -3, 1: -3, 2: -3, 3: -3, 4: 0, 5: 0,
  6: 0, 7: 0, 8: 0, 9: +3, A: +3, B: +3, C: +3,
}

// ── Modified Price % table ────────────────────────────────────────────────────
// Roll total (3D + Broker skill + Purchase DM - Sale DM - opposing party's
// Broker skill, or the mirror for selling) → { purchasePct, salePct } of the
// good's Base Price. One band per roll result, per the rulebook table —
// only the two open-ended extremes span more than one value.
export const MGT2022_MODIFIED_PRICE_TABLE = [
  { max: -3,           purchasePct: 300, salePct: 10  },
  { min: -2, max: -2,   purchasePct: 250, salePct: 20  },
  { min: -1, max: -1,   purchasePct: 200, salePct: 30  },
  { min: 0,  max: 0,    purchasePct: 175, salePct: 40  },
  { min: 1,  max: 1,    purchasePct: 150, salePct: 45  },
  { min: 2,  max: 2,    purchasePct: 135, salePct: 50  },
  { min: 3,  max: 3,    purchasePct: 125, salePct: 55  },
  { min: 4,  max: 4,    purchasePct: 120, salePct: 60  },
  { min: 5,  max: 5,    purchasePct: 115, salePct: 65  },
  { min: 6,  max: 6,    purchasePct: 110, salePct: 70  },
  { min: 7,  max: 7,    purchasePct: 105, salePct: 75  },
  { min: 8,  max: 8,    purchasePct: 100, salePct: 80  },
  { min: 9,  max: 9,    purchasePct: 95,  salePct: 85  },
  { min: 10, max: 10,   purchasePct: 90,  salePct: 90  },
  { min: 11, max: 11,   purchasePct: 85,  salePct: 100 },
  { min: 12, max: 12,   purchasePct: 80,  salePct: 105 },
  { min: 13, max: 13,   purchasePct: 75,  salePct: 110 },
  { min: 14, max: 14,   purchasePct: 70,  salePct: 115 },
  { min: 15, max: 15,   purchasePct: 65,  salePct: 120 },
  { min: 16, max: 16,   purchasePct: 60,  salePct: 125 },
  { min: 17, max: 17,   purchasePct: 55,  salePct: 130 },
  { min: 18, max: 18,   purchasePct: 50,  salePct: 140 },
  { min: 19, max: 19,   purchasePct: 45,  salePct: 150 },
  { min: 20, max: 20,   purchasePct: 40,  salePct: 160 },
  { min: 21, max: 21,   purchasePct: 35,  salePct: 175 },
  { min: 22, max: 22,   purchasePct: 30,  salePct: 200 },
  { min: 23, max: 23,   purchasePct: 25,  salePct: 250 },
  { min: 24, max: 24,   purchasePct: 20,  salePct: 300 },
  { min: 25,            purchasePct: 15,  salePct: 400 },
]

// ── Passengers: 4 tiers × 1-6 parsecs (Cr per head) ───────────────────────────
// Basic Passage is new in MgT2022 — no dedicated stateroom, consumes 2 tons
// of general cargo space per passenger instead (see passengers.js).
export const MGT2022_PASSAGE_FARES = {
  high:   [9000, 14000, 21000, 34000, 60000, 210000],
  middle: [6500, 10000, 14000, 23000, 40000, 130000],
  basic:  [2000,  3000,  5000,  8000, 14000,  55000],
  low:    [ 700,  1300,  2200,  3900,  7200,  27000],
}

export const MGT2022_BASIC_PASSAGE_TONS = 2

// ── Freight: flat per-ton rate × 1-6 parsecs ──────────────────────────────────
// Rate depends only on distance, not lot size — "Freight shipments pay a
// fixed rate as shown on the Passage and Freight table." Lot size (Major/
// Minor/Incidental) only determines how many tons are in one lot.
export const MGT2022_FREIGHT_RATES = [1000, 1600, 2600, 4400, 8500, 32000]

// Lot size dice: Major = 1Dx10 tons, Minor = 1Dx5, Incidental = 1D.
export const MGT2022_FREIGHT_LOT_SIZE_DICE = {
  major:      '1Dx10',
  minor:      '1Dx5',
  incidental: '1D',
}

// Late-delivery penalty: 1D+4, result ×10% deducted from the freight charge.
export const MGT2022_FREIGHT_LATE_PENALTY_DIE_MOD = 4

// ── Mail ───────────────────────────────────────────────────────────────────────
export const MGT2022_MAIL_AVAILABLE_ROLL = 12       // 2D must meet or beat this
export const MGT2022_MAIL_PAYMENT_PER_CONTAINER = 25000
export const MGT2022_MAIL_CONTAINER_TONS = 5

// Freight Traffic DM (see MGT2022_FREIGHT_TRAFFIC_DM below) banded down to a
// small mail-roll modifier, since mail shouldn't swing as wildly as freight
// lot counts do.
export const MGT2022_MAIL_FREIGHT_DM_BANDS = [
  { max: -10,          dm: -2 },
  { min: -9, max: -5,   dm: -1 },
  { min: -4, max: 4,    dm: 0  },
  { min: 5,  max: 9,    dm: +1 },
  { min: 10,            dm: +2 },
]

// ── Traffic availability: 2D + Population/Starport/TL/Zone DM → dice count ───
// Drives the passenger/freight/mail scarcity mechanic (traffic-tick.js).
// Distinct from MGT2022_POPULATION_AVAIL_DM above (that one's for the
// speculative-trade quantity roll) — this table is specific to the Freight
// section's own DMs and was previously (incorrectly) aliased to the other one.
export const MGT2022_POPULATION_TRAFFIC_DM = {
  0: -4, 1: -4, 2: 0, 3: 0, 4: 0, 5: 0,
  6: +2, 7: +2, 8: +4, 9: +4, A: +4, B: +4, C: +4,
}

export const MGT2022_STARPORT_TRAFFIC_DM = { A: 2, B: 1, C: 0, D: 0, E: -1, X: -3 }

// Find a Supplier's own starport DM — a distinct mechanic/table from the
// Freight/Mail traffic DM above, despite both being keyed by starport class:
// "The size of the Starport provides a bonus to finding a supplier."
export const MGT2022_STARPORT_SUPPLIER_DM = { A: 6, B: 4, C: 2, D: 0, E: 0, X: 0 }

// Tech Level DM for traffic (Freight/Mail): TL<=6: -1, TL>=9: +2, else 0.
export function techLevelTrafficDM(techLevelInt) {
  if (techLevelInt == null) return 0
  if (techLevelInt <= 6) return -1
  if (techLevelInt >= 9) return +2
  return 0
}

// Zone DM for traffic (Freight/Mail): Amber: -2, Red: -6, else 0.
export function zoneTrafficDM(zone) {
  if (zone === 'A') return -2
  if (zone === 'R') return -6
  return 0
}

// ── Freight Traffic table: 2D+DM → dice formula, then roll & sum ─────────────
// Replaces the previous linear approximation. Returns the number of dice to
// roll (0 means no lots at all).
export function freightTrafficDiceCount(twoDPlusDM) {
  if (twoDPlusDM <= 1)  return 0
  if (twoDPlusDM <= 3)  return 1
  if (twoDPlusDM <= 5)  return 2
  if (twoDPlusDM <= 8)  return 3
  if (twoDPlusDM <= 11) return 4
  if (twoDPlusDM <= 14) return 5
  if (twoDPlusDM <= 16) return 6
  if (twoDPlusDM === 17) return 7
  if (twoDPlusDM === 18) return 8
  if (twoDPlusDM === 19) return 9
  return 10
}
