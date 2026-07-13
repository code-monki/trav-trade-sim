/**
 * Mongoose Traveller 2022 (MgT2022) — Trade & Commerce data tables.
 *
 * Sourced from the MgT2022 Core Rulebook, "Trade and Commerce" (pp.238-245).
 * A kept-separate sibling to traveller-data.js (which holds CT7 + shared
 * constants) rather than folded in, so this ruleset's 36-entry goods table
 * and its distinct DM shape don't get mixed with CT7's — the same reasoning
 * that led T5 astray by inlining its data into its engine file instead.
 *
 * IMPORTANT: the exact Cr figures and DM values below are a best-effort
 * reconstruction drafted without a live copy of the rulebook text in this
 * session (the source PDFs were processed earlier and are no longer
 * available on disk). The table SHAPE, category names, and roll mechanics
 * are believed accurate; verify exact numbers against your rulebook copy
 * before relying on them at the table. Corrections only need to touch this
 * file — the engine/dispatch/schema wiring is independent of these values.
 */

// ── Trade code parsing reuses CT7's allowlist ─────────────────────────────────
// Both editions' worlds are tagged with the same standard Traveller trade
// codes in sector data (Remarks field) — no numeric classifier exists
// anywhere in this codebase; both engines just filter pre-tagged tokens.
export { parseTradeCodes, starportFromUWP, techFromUWP } from './trade-engine-ct7.js'

// ── D66 Trade Goods table ──────────────────────────────────────────────────────
// purchaseDMs / saleDMs: array of { code, dm } using standard trade codes
// (Ag, As, Ba, De, Fl, Hi, Ic, In, Lo, Na, Ni, Po, Ri, Va, Wa).
// illegal: true marks goods requiring a Law Level smuggling-risk check.
export const MGT2022_TRADE_GOODS = [
  { die: '11', name: 'Common Electronics',          category: 'Electronics',   basePriceCr:   20000, qty: '4Dx10', purchaseDMs: [{ code:'In', dm:-2 }],                     saleDMs: [{ code:'Ni', dm:+1 }],                     illegal: false },
  { die: '12', name: 'Common Industrial Goods',     category: 'Industrial',    basePriceCr:    5000, qty: '5Dx10', purchaseDMs: [{ code:'In', dm:-3 }],                     saleDMs: [{ code:'Ni', dm:+2 }],                     illegal: false },
  { die: '13', name: 'Common Manufactured Goods',   category: 'Manufactured',  basePriceCr:   10000, qty: '4Dx10', purchaseDMs: [{ code:'In', dm:-2 }],                     saleDMs: [{ code:'Ni', dm:+1 }],                     illegal: false },
  { die: '14', name: 'Common Raw Materials',        category: 'Raw Materials', basePriceCr:     500, qty: '6Dx10', purchaseDMs: [{ code:'Ag', dm:-1 },{ code:'In', dm:-1 }], saleDMs: [{ code:'In', dm:+2 }],                     illegal: false },
  { die: '15', name: 'Common Consumables',          category: 'Consumables',   basePriceCr:    1000, qty: '6Dx10', purchaseDMs: [{ code:'Ag', dm:-2 }],                     saleDMs: [{ code:'As', dm:+2 },{ code:'Fl', dm:+2 }], illegal: false },
  { die: '16', name: 'Common Ore',                  category: 'Ore',          basePriceCr:    1000, qty: '5Dx10', purchaseDMs: [{ code:'As', dm:-2 },{ code:'In', dm:-1 }], saleDMs: [{ code:'In', dm:+2 }],                     illegal: false },
  { die: '21', name: 'Advanced Electronics',        category: 'Electronics',   basePriceCr:  100000, qty: '2Dx5',  purchaseDMs: [{ code:'In', dm:-3 }],                     saleDMs: [{ code:'Ni', dm:+3 },{ code:'Ri', dm:+1 }], illegal: false },
  { die: '22', name: 'Advanced Machine Parts',      category: 'Industrial',    basePriceCr:   75000, qty: '2Dx5',  purchaseDMs: [{ code:'In', dm:-4 }],                     saleDMs: [{ code:'Ni', dm:+3 }],                     illegal: false },
  { die: '23', name: 'Advanced Manufactured Goods', category: 'Manufactured',  basePriceCr:  100000, qty: '2Dx5',  purchaseDMs: [{ code:'In', dm:-3 }],                     saleDMs: [{ code:'Ni', dm:+2 },{ code:'Ri', dm:+1 }], illegal: false },
  { die: '24', name: 'Advanced Weapons',            category: 'Weapons',       basePriceCr:  150000, qty: '1Dx5',  purchaseDMs: [{ code:'In', dm:-3 }],                     saleDMs: [{ code:'Lo', dm:+4 }],                     illegal: false },
  { die: '25', name: 'Advanced Vehicles',           category: 'Vehicles',      basePriceCr:  180000, qty: '1Dx5',  purchaseDMs: [{ code:'In', dm:-2 }],                     saleDMs: [{ code:'Ni', dm:+2 }],                     illegal: false },
  { die: '26', name: 'Biochemicals',                category: 'Biochemicals', basePriceCr:   50000, qty: '2Dx5',  purchaseDMs: [{ code:'Ag', dm:-3 },{ code:'Wa', dm:-1 }], saleDMs: [{ code:'In', dm:+2 }],                     illegal: false },
  { die: '31', name: 'Crystals & Gems',             category: 'Minerals',      basePriceCr:   20000, qty: '1Dx5',  purchaseDMs: [{ code:'As', dm:-4 },{ code:'Ic', dm:-2 }], saleDMs: [{ code:'Ri', dm:+3 }],                     illegal: false },
  { die: '32', name: 'Cybernetics',                 category: 'Technology',    basePriceCr:  250000, qty: '1Dx5',  purchaseDMs: [{ code:'In', dm:-3 },{ code:'Hi', dm:-1 }], saleDMs: [{ code:'Ni', dm:+4 }],                     illegal: false },
  { die: '33', name: 'Live Animals',                category: 'Animals',      basePriceCr:   10000, qty: '2Dx5',  purchaseDMs: [{ code:'Ag', dm:-2 }],                     saleDMs: [{ code:'Lo', dm:+2 }],                     illegal: false },
  { die: '34', name: 'Luxury Consumables',          category: 'Luxury',       basePriceCr:   20000, qty: '2Dx5',  purchaseDMs: [{ code:'Ag', dm:-2 },{ code:'Ri', dm:-1 }], saleDMs: [{ code:'Hi', dm:+3 },{ code:'Ri', dm:+2 }], illegal: false },
  { die: '35', name: 'Luxury Goods',                category: 'Luxury',       basePriceCr:  200000, qty: '1Dx5',  purchaseDMs: [{ code:'Ri', dm:-2 }],                     saleDMs: [{ code:'Hi', dm:+4 },{ code:'Ri', dm:+2 }], illegal: false },
  { die: '36', name: 'Medical Supplies',            category: 'Medical',      basePriceCr:   50000, qty: '2Dx5',  purchaseDMs: [{ code:'Hi', dm:-2 },{ code:'In', dm:-1 }], saleDMs: [{ code:'Po', dm:+3 },{ code:'Lo', dm:+2 }], illegal: false },
  { die: '41', name: 'Petrochemicals',              category: 'Chemicals',    basePriceCr:    5000, qty: '4Dx10', purchaseDMs: [{ code:'De', dm:-2 },{ code:'In', dm:-1 }], saleDMs: [{ code:'Ag', dm:+2 }],                     illegal: false },
  { die: '42', name: 'Pharmaceuticals',             category: 'Medical',      basePriceCr:  100000, qty: '1Dx5',  purchaseDMs: [{ code:'Hi', dm:-3 }],                     saleDMs: [{ code:'Po', dm:+4 },{ code:'Ri', dm:+2 }], illegal: false },
  { die: '43', name: 'Polymers',                    category: 'Chemicals',    basePriceCr:    5000, qty: '4Dx10', purchaseDMs: [{ code:'In', dm:-2 }],                     saleDMs: [{ code:'Ni', dm:+2 }],                     illegal: false },
  { die: '44', name: 'Precious Metals',             category: 'Minerals',     basePriceCr:   50000, qty: '1Dx5',  purchaseDMs: [{ code:'As', dm:-3 },{ code:'In', dm:-1 }], saleDMs: [{ code:'Ri', dm:+2 }],                     illegal: false },
  { die: '45', name: 'Radioactives',                category: 'Ore',          basePriceCr: 1000000, qty: '1D',    purchaseDMs: [{ code:'In', dm:-3 },{ code:'Ni', dm:-5 }], saleDMs: [{ code:'In', dm:+5 },{ code:'Ni', dm:-4 }], illegal: false },
  { die: '46', name: 'Robots',                      category: 'Technology',   basePriceCr:  400000, qty: '1D',    purchaseDMs: [{ code:'In', dm:-3 }],                     saleDMs: [{ code:'Ni', dm:+3 },{ code:'Ag', dm:+2 }], illegal: false },
  { die: '51', name: 'Spices',                      category: 'Consumables',  basePriceCr:    6000, qty: '2Dx5',  purchaseDMs: [{ code:'Ag', dm:-2 },{ code:'Na', dm:-1 }], saleDMs: [{ code:'Ri', dm:+2 },{ code:'Po', dm:+3 }], illegal: false },
  { die: '52', name: 'Textiles',                    category: 'Manufactured', basePriceCr:    5000, qty: '4Dx10', purchaseDMs: [{ code:'Ag', dm:-2 }],                     saleDMs: [{ code:'Na', dm:+1 },{ code:'Ni', dm:+2 }], illegal: false },
  { die: '53', name: 'Uncommon Ore',                category: 'Ore',          basePriceCr:    5000, qty: '2Dx5',  purchaseDMs: [{ code:'As', dm:-2 },{ code:'In', dm:-1 }], saleDMs: [{ code:'In', dm:+3 }],                     illegal: false },
  { die: '54', name: 'Uncommon Raw Materials',      category: 'Raw Materials', basePriceCr:  20000, qty: '2Dx5',  purchaseDMs: [{ code:'Ag', dm:-2 },{ code:'In', dm:-1 }], saleDMs: [{ code:'In', dm:+3 }],                     illegal: false },
  { die: '55', name: 'Wood',                        category: 'Raw Materials', basePriceCr:    1000, qty: '4Dx10', purchaseDMs: [{ code:'Ag', dm:-3 }],                     saleDMs: [{ code:'Ic', dm:+2 },{ code:'Ni', dm:+1 }], illegal: false },
  { die: '56', name: 'Vehicles',                    category: 'Vehicles',    basePriceCr:   15000, qty: '2Dx5',  purchaseDMs: [{ code:'In', dm:-2 }],                     saleDMs: [{ code:'Ni', dm:+2 }],                     illegal: false },
  { die: '61', name: 'Illegal Biochemicals',        category: 'Illegal',      basePriceCr:   50000, qty: '1D',    purchaseDMs: [{ code:'Ag', dm:-3 }],                     saleDMs: [{ code:'In', dm:+4 }],                     illegal: true  },
  { die: '62', name: 'Illegal Cybernetics',         category: 'Illegal',      basePriceCr:  250000, qty: '1D',    purchaseDMs: [{ code:'In', dm:-3 }],                     saleDMs: [{ code:'Ni', dm:+5 }],                     illegal: true  },
  { die: '63', name: 'Illegal Drugs',               category: 'Illegal',      basePriceCr:  100000, qty: '1D',    purchaseDMs: [{ code:'Ag', dm:-2 }],                     saleDMs: [{ code:'Hi', dm:+4 },{ code:'Po', dm:+3 }], illegal: true  },
  { die: '64', name: 'Illegal Luxuries',            category: 'Illegal',      basePriceCr:   50000, qty: '1D',    purchaseDMs: [{ code:'Ri', dm:-2 }],                     saleDMs: [{ code:'Hi', dm:+4 }],                     illegal: true  },
  { die: '65', name: 'Illegal Weapons',             category: 'Illegal',      basePriceCr:  150000, qty: '1D',    purchaseDMs: [{ code:'In', dm:-3 }],                     saleDMs: [{ code:'Lo', dm:+5 }],                     illegal: true  },
  { die: '66', name: 'Exotics',                     category: 'Exotics',     basePriceCr:   10000, qty: '1Dx5',  purchaseDMs: [{ code:'Ni', dm:-4 }],                     saleDMs: [{ code:'Ri', dm:+4 },{ code:'Hi', dm:+2 }], illegal: false },
]

// ── Determine Goods Available: population availability DM ────────────────────
// Keyed by the UWP Population digit/letter (see UWP_POPULATION in
// traveller-data.js). Higher population worlds have a wider range of goods
// on offer; the DM applies to the D66 availability roll.
export const MGT2022_POPULATION_AVAIL_DM = {
  0: -4, 1: -3, 2: -2, 3: -2, 4: -1, 5: -1,
  6: 0, 7: 0, 8: +1, 9: +1, A: +2, B: +2, C: +3,
}

// ── Modified Price % table ────────────────────────────────────────────────────
// Roll total (3D + Broker skill + Purchase/Sale DM - opposing party's Broker
// skill) → { purchasePct, salePct } of the good's Base Price. Bands taken as
// contiguous ranges; clamp to the extreme bands outside [-3, 25].
export const MGT2022_MODIFIED_PRICE_TABLE = [
  { max: -3,          purchasePct: 300, salePct: 10  },
  { min: -2, max: -1,  purchasePct: 200, salePct: 25  },
  { min: 0,  max: 2,   purchasePct: 175, salePct: 50  },
  { min: 3,  max: 5,   purchasePct: 150, salePct: 75  },
  { min: 6,  max: 8,   purchasePct: 135, salePct: 90  },
  { min: 9,  max: 11,  purchasePct: 120, salePct: 100 },
  { min: 12, max: 14,  purchasePct: 115, salePct: 105 },
  { min: 15, max: 17,  purchasePct: 110, salePct: 110 },
  { min: 18, max: 20,  purchasePct: 105, salePct: 115 },
  { min: 21, max: 23,  purchasePct: 100, salePct: 120 },
  { min: 24, max: 24,  purchasePct: 90,  salePct: 135 },
  { min: 25,           purchasePct: 15,  salePct: 400 },
]

// ── Passengers: 4 tiers × 1-6 parsecs (Cr per head) ───────────────────────────
// Basic Passage is new in MgT2022 — no dedicated stateroom, consumes 2 tons
// of general cargo space per passenger instead (see passengers.js).
export const MGT2022_PASSAGE_FARES = {
  high:   [10000, 14000, 18000, 22000, 26000, 30000],
  middle: [ 8000, 10000, 12000, 14000, 16000, 18000],
  basic:  [ 2000,  3000,  4000,  5000,  6000,  7000],
  low:    [  700,   700,   700,   700,   700,   700],
}

export const MGT2022_BASIC_PASSAGE_TONS = 2

// ── Freight: 3 lot sizes × 1-6 parsecs (Cr per ton) ───────────────────────────
// Smaller lots pay a higher per-ton rate (Incidental > Minor > Major).
export const MGT2022_FREIGHT_RATES = {
  major:      [1000, 2000, 3000, 4000,  5000,  6000],
  minor:      [1500, 3000, 4500, 6000,  7500,  9000],
  incidental: [2000, 4000, 6000, 8000, 10000, 12000],
}

// Late-delivery penalty: 1D+4, result ×10% deducted from the freight charge.
export const MGT2022_FREIGHT_LATE_PENALTY_DIE_MOD = 4

// ── Mail ───────────────────────────────────────────────────────────────────────
export const MGT2022_MAIL_AVAILABLE_ROLL = 12       // 2D must meet or beat this
export const MGT2022_MAIL_PAYMENT_PER_CONTAINER = 25000
export const MGT2022_MAIL_CONTAINER_TONS = 5

// ── Traffic availability: 2D + Population/Starport DM → count ────────────────
// Drives the new passenger/freight/mail scarcity mechanic (traffic-tick.js).
// Starport class DM mirrors Find-a-Supplier's (A/B/C/D → +6/+4/+2/0).
export const MGT2022_STARPORT_TRAFFIC_DM = { A: 6, B: 4, C: 2, D: 0, E: 0, X: 0 }

export const MGT2022_POPULATION_TRAFFIC_DM = MGT2022_POPULATION_AVAIL_DM
