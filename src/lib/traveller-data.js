// ── Milieu definitions ────────────────────────────────────────────────────────
// Codes from /api/milieux — names are locally defined (API returns no labels).
export const MILIEUS = [
  { code: 'M1105', label: '1105 — Classic Era'              },
  { code: 'IW',    label: 'Interstellar Wars'               },
  { code: 'M0',    label: 'Year 0 — Third Imperium Founded' },
  { code: 'M600',  label: 'Year 600'                        },
  { code: 'M990',  label: 'Year 990 — Solomani Rim War'     },
  { code: 'M1120', label: 'Year 1120 — The Rebellion'       },
  { code: 'M1201', label: 'Year 1201 — The Virus'           },
  { code: 'M1248', label: 'Year 1248'                       },
  { code: 'M1900', label: 'Year 1900 — Far Future'          },
]

// ── Field labels ──────────────────────────────────────────────────────────────
export const FIELD_LABELS = {
  Hex:         'Hex Location',
  Name:        'World Name',
  UWP:         'Universal World Profile',
  Bases:       'Bases',
  Remarks:     'Trade Codes / Remarks',
  Zone:        'Travel Zone',
  PBG:         'Population Multiplier / Belts / Gas Giants',
  Allegiance:  'Allegiance',
  Stars:       'Stellar Data',
  Sector:      'Sector',
  SS:          'Subsector',
  W:           'Worlds in System',
  RU:          'Resource Units',
  '{Ix}':      'Importance Extension',
  '(Ex)':      'Economic Extension',
  '[Cx]':      'Cultural Extension',
  Ix:          'Importance Extension',
  Ex:          'Economic Extension',
  Cx:          'Cultural Extension',
  Nobility:    'Nobility Codes',
}

// ── UWP lookup tables ─────────────────────────────────────────────────────────
export const UWP_STARPORT = {
  A: 'Excellent', B: 'Good', C: 'Routine', D: 'Poor',
  E: 'Frontier',  X: 'No Starport', Y: 'None',
  F: 'Good (Spaceport)', G: 'Poor (Spaceport)', H: 'Primitive (Spaceport)',
}

export const UWP_SIZE = {
  0: 'Asteroid/Planetoid Belt', 1: '~1,600 km', 2: '~3,200 km',
  3: '~4,800 km',  4: '~6,400 km',  5: '~8,000 km',
  6: '~9,600 km',  7: '~11,200 km', 8: '~12,800 km',
  9: '~14,400 km', A: '~16,000 km', S: 'Small World',
}

export const UWP_ATMOSPHERE = {
  0: 'None',              1: 'Trace',              2: 'Very Thin (Tainted)',
  3: 'Very Thin',         4: 'Thin (Tainted)',     5: 'Thin',
  6: 'Standard',          7: 'Standard (Tainted)', 8: 'Dense',
  9: 'Dense (Tainted)',   A: 'Exotic',             B: 'Corrosive',
  C: 'Insidious',         D: 'Very Dense',         E: 'Ellipsoid/Low',
  F: 'Unusual',
}

export const UWP_HYDRO = {
  0: 'Desert (0%)', 1: '10%', 2: '20%', 3: '30%', 4: '40%',
  5: '50%',         6: '60%', 7: '70%', 8: '80%', 9: '90%', A: '100%',
}

export const UWP_POPULATION = {
  0: 'Unpopulated',         1: 'Tens',               2: 'Hundreds',
  3: 'Thousands',           4: 'Tens of Thousands',  5: 'Hundreds of Thousands',
  6: 'Millions',            7: 'Tens of Millions',   8: 'Hundreds of Millions',
  9: 'Billions',            A: 'Tens of Billions',   B: 'Hundreds of Billions',
  C: 'Trillions',
}

export const UWP_GOVERNMENT = {
  0: 'None',                     1: 'Company/Corporation',
  2: 'Participating Democracy',  3: 'Self-Perpetuating Oligarchy',
  4: 'Representative Democracy', 5: 'Feudal Technocracy',
  6: 'Captive Government/Colony',7: 'Balkanization',
  8: 'Civil Service Bureaucracy',9: 'Impersonal Bureaucracy',
  A: 'Charismatic Dictator',     B: 'Non-Charismatic Leader',
  C: 'Charismatic Oligarchy',    D: 'Religious Dictatorship',
  E: 'Religious Autocracy',      F: 'Totalitarian Oligarchy',
}

export const UWP_LAW = {
  0: 'No law', 1: 'Light',          2: 'Light-Moderate', 3: 'Moderate',
  4: 'Moderate-High', 5: 'High',    6: 'High',           7: 'Very High',
  8: 'Very High',     9: 'Extreme', A: 'Extreme',        B: 'Extreme',
  C: 'Extreme',       D: 'Extreme', E: 'Extreme',        F: 'Extreme',
}

export const UWP_TECH = {
  0: 'Stone Age',            1: 'Bronze/Iron Age',        2: 'Medieval',
  3: 'Renaissance',          4: 'Industrial Revolution',  5: 'Early Atomic',
  6: 'Nuclear Age',          7: 'Miniaturized Electronics',8: 'Quality Computers',
  9: 'Anti-Gravity',         A: 'Interstellar Travel',    B: 'Fusion Power',
  C: 'Artificial Gravity',   D: 'Cloning',               E: 'Personalised Computers',
  F: 'Anagathics',           G: 'Macro-Engineering',      H: 'Grav Technology',
}

// ── Other lookup tables ───────────────────────────────────────────────────────
export const BASE_CODES = {
  A: 'Imperial Consulate', C: 'Corsair Base',     D: 'Depot',
  E: 'Embassy',            G: 'Scout Way Station',K: 'Naval Base',
  M: 'Military Base',      N: 'Naval Base',       P: 'Pirate Base',
  R: 'Clan Base',          S: 'Scout Base',       T: 'Tlauku Base',
  V: 'Exploration Base',   W: 'Way Station',
}

export const TRAVEL_ZONE = {
  '':  'Green — No Restrictions',
  A:   'Amber — Advisory',
  R:   'Red — Prohibited',
  U:   'Unabsorbed',
}

// ── CT Book 7 — Cost of Goods trade class modifiers (source world) ─────────────
// Base cost: Cr4,000/ton. Each matching trade class adds this modifier.
// Source: Classic Traveller Book 7, Merchant Prince — Cost of Goods Table.
export const CT7_COST_MODS = {
  Ag: -1000, As: -1000, Ba: +1000, De: +1000, Fl: +1000,
  Hi: -1000, Ic:     0, In: -1000, Lo: +1000, Na:     0,
  Ni: +1000, Po: +1000, Ri: +1000, Va:     0, Wa:     0,
}

// Starport cost modifier (source world)
export const CT7_STARPORT_COST_MODS = {
  A: -1000, B: 0, C: +1000, D: +2000, E: +3000, X: +5000,
}

// CT Book 7 Actual Value Table (2d6 + DMs → percentage of base price)
export const CT7_ACTUAL_VALUE = {
  2: 0.40, 3: 0.50, 4: 0.70, 5: 0.80, 6: 0.90,
  7: 1.00, 8: 1.10, 9: 1.20, 10: 1.30, 11: 1.50,
  12: 1.70, 13: 2.00, 14: 3.00, 15: 4.00,
}

// ── CT Book 2 — Trade & Speculation table ─────────────────────────────────────
// Source: Classic Traveller Book 2, Starships — Trade and Speculation Table.
// die: result of two consecutive d6 rolls (11–66).
// purchaseDMs / resaleDMs: array of { code, dm } — A=Ag, NA=Na, I=In, NI=Ni, R=Ri, P=Po
// qty: dice expression string (parsed at runtime).
export const CT2_TRADE_GOODS = [
  { die: '11', name: 'Textiles',          basePriceCr:      3000, qty: '3Dx5',   purchaseDMs: [{ code:'A',  dm:-7 },{ code:'NA', dm:-5 },{ code:'NI', dm:-3 }], resaleDMs: [{ code:'A',  dm:-6 },{ code:'NA', dm:+1 },{ code:'R',  dm:+3 }] },
  { die: '12', name: 'Polymers',          basePriceCr:      7000, qty: '4Dx5',   purchaseDMs: [{ code:'I',  dm:-2 },{ code:'R',  dm:-3 },{ code:'P',  dm:+2 }], resaleDMs: [{ code:'I',  dm:-2 },{ code:'R',  dm:+3 }] },
  { die: '13', name: 'Liquor',            basePriceCr:     10000, qty: '1Dx5',   purchaseDMs: [{ code:'A',  dm:-4 }],                                            resaleDMs: [{ code:'A',  dm:-3 },{ code:'I',  dm:+1 },{ code:'R',  dm:+2 }] },
  { die: '14', name: 'Wood',              basePriceCr:      1000, qty: '2Dx10',  purchaseDMs: [{ code:'A',  dm:-6 }],                                            resaleDMs: [{ code:'A',  dm:-6 },{ code:'I',  dm:+1 },{ code:'R',  dm:+2 }] },
  { die: '15', name: 'Crystals',          basePriceCr:     20000, qty: '1D',     purchaseDMs: [{ code:'NA', dm:-3 },{ code:'I',  dm:+4 }],                       resaleDMs: [{ code:'NA', dm:-3 },{ code:'I',  dm:+3 },{ code:'R',  dm:+3 }] },
  { die: '16', name: 'Radioactives',      basePriceCr:   1000000, qty: '1D',     purchaseDMs: [{ code:'I',  dm:+7 },{ code:'NI', dm:-3 },{ code:'R',  dm:+5 }], resaleDMs: [{ code:'I',  dm:+6 },{ code:'NI', dm:-3 },{ code:'R',  dm:-4 }] },
  { die: '21', name: 'Steel',             basePriceCr:       500, qty: '4Dx10',  purchaseDMs: [{ code:'I',  dm:-2 },{ code:'R',  dm:-1 },{ code:'P',  dm:+1 }], resaleDMs: [{ code:'I',  dm:-2 },{ code:'R',  dm:-1 },{ code:'P',  dm:+3 }] },
  { die: '22', name: 'Copper',            basePriceCr:      2000, qty: '2Dx10',  purchaseDMs: [{ code:'I',  dm:-3 },{ code:'R',  dm:-2 },{ code:'P',  dm:+1 }], resaleDMs: [{ code:'I',  dm:-3 },{ code:'R',  dm:-1 }] },
  { die: '23', name: 'Aluminum',          basePriceCr:      1000, qty: '5Dx10',  purchaseDMs: [{ code:'I',  dm:-3 },{ code:'R',  dm:-2 },{ code:'P',  dm:+1 }], resaleDMs: [{ code:'I',  dm:-3 },{ code:'NI', dm:+4 },{ code:'R',  dm:-1 }] },
  { die: '24', name: 'Tin',               basePriceCr:      9000, qty: '3Dx10',  purchaseDMs: [{ code:'I',  dm:-3 },{ code:'R',  dm:-2 },{ code:'P',  dm:+1 }], resaleDMs: [{ code:'I',  dm:-3 },{ code:'R',  dm:-1 }] },
  { die: '25', name: 'Silver',            basePriceCr:     70000, qty: '1Dx5',   purchaseDMs: [{ code:'I',  dm:+5 },{ code:'R',  dm:-1 },{ code:'P',  dm:+2 }], resaleDMs: [{ code:'I',  dm:+5 },{ code:'R',  dm:-1 }] },
  { die: '26', name: 'Special Alloys',    basePriceCr:    200000, qty: '1D',     purchaseDMs: [{ code:'I',  dm:-3 },{ code:'NI', dm:+5 },{ code:'R',  dm:-2 }], resaleDMs: [{ code:'I',  dm:-3 },{ code:'NI', dm:+4 },{ code:'R',  dm:-1 }] },
  { die: '31', name: 'Petrochemicals',    basePriceCr:     10000, qty: '1D',     purchaseDMs: [{ code:'NA', dm:-4 },{ code:'I',  dm:+1 },{ code:'NI', dm:-5 }], resaleDMs: [{ code:'NA', dm:-4 },{ code:'I',  dm:+3 },{ code:'NI', dm:-5 }] },
  { die: '32', name: 'Grain',             basePriceCr:       300, qty: '8Dx5',   purchaseDMs: [{ code:'A',  dm:-2 },{ code:'NA', dm:+1 },{ code:'I',  dm:+2 }], resaleDMs: [{ code:'A',  dm:-2 }] },
  { die: '33', name: 'Meat',              basePriceCr:      1500, qty: '4Dx5',   purchaseDMs: [{ code:'A',  dm:-2 },{ code:'NA', dm:+2 },{ code:'I',  dm:+3 }], resaleDMs: [{ code:'A',  dm:-2 },{ code:'I',  dm:+2 },{ code:'P',  dm:+1 }] },
  { die: '34', name: 'Spices',            basePriceCr:      6000, qty: '1Dx5',   purchaseDMs: [{ code:'A',  dm:-2 },{ code:'NA', dm:+3 },{ code:'I',  dm:+2 }], resaleDMs: [{ code:'A',  dm:-2 },{ code:'R',  dm:+2 },{ code:'P',  dm:+3 }] },
  { die: '35', name: 'Fruit',             basePriceCr:      1000, qty: '2Dx5',   purchaseDMs: [{ code:'A',  dm:-3 },{ code:'NA', dm:+1 },{ code:'I',  dm:+2 }], resaleDMs: [{ code:'A',  dm:-2 },{ code:'I',  dm:+3 },{ code:'P',  dm:+2 }] },
  { die: '36', name: 'Pharmaceuticals',   basePriceCr:    100000, qty: '1D',     purchaseDMs: [{ code:'NA', dm:-3 },{ code:'I',  dm:+4 },{ code:'P',  dm:+3 }], resaleDMs: [{ code:'NA', dm:-3 },{ code:'I',  dm:+5 },{ code:'R',  dm:+4 }] },
  { die: '41', name: 'Gems',              basePriceCr:   1000000, qty: '1D',     purchaseDMs: [{ code:'I',  dm:+4 },{ code:'NI', dm:-8 },{ code:'P',  dm:-3 }], resaleDMs: [{ code:'I',  dm:+4 },{ code:'NI', dm:-2 },{ code:'R',  dm:+8 }] },
  { die: '42', name: 'Firearms',          basePriceCr:     30000, qty: '2D',     purchaseDMs: [{ code:'I',  dm:-3 },{ code:'R',  dm:-2 },{ code:'P',  dm:+3 }], resaleDMs: [{ code:'I',  dm:-2 },{ code:'R',  dm:-1 },{ code:'P',  dm:+3 }] },
  { die: '43', name: 'Ammunition',        basePriceCr:     30000, qty: '2D',     purchaseDMs: [{ code:'I',  dm:-3 },{ code:'R',  dm:-2 },{ code:'P',  dm:+3 }], resaleDMs: [{ code:'I',  dm:-2 },{ code:'R',  dm:-1 },{ code:'P',  dm:+3 }] },
  { die: '44', name: 'Blades',            basePriceCr:     10000, qty: '2D',     purchaseDMs: [{ code:'I',  dm:-3 },{ code:'R',  dm:-2 },{ code:'P',  dm:+3 }], resaleDMs: [{ code:'I',  dm:-2 },{ code:'R',  dm:-1 },{ code:'P',  dm:+3 }] },
  { die: '45', name: 'Tools',             basePriceCr:     10000, qty: '2D',     purchaseDMs: [{ code:'I',  dm:-3 },{ code:'R',  dm:-2 },{ code:'P',  dm:+3 }], resaleDMs: [{ code:'I',  dm:-2 },{ code:'R',  dm:-1 },{ code:'P',  dm:+3 }] },
  { die: '46', name: 'Body Armor',        basePriceCr:     50000, qty: '2D',     purchaseDMs: [{ code:'I',  dm:-1 },{ code:'R',  dm:-3 },{ code:'P',  dm:+3 }], resaleDMs: [{ code:'I',  dm:-2 },{ code:'R',  dm:+1 },{ code:'P',  dm:+4 }] },
  { die: '51', name: 'Aircraft',          basePriceCr:   1000000, qty: '1D',     purchaseDMs: [{ code:'I',  dm:-4 },{ code:'R',  dm:-3 }],                       resaleDMs: [{ code:'NI', dm:+2 },{ code:'P',  dm:+1 }] },
  { die: '52', name: 'Air/Raft',          basePriceCr:   6000000, qty: '1D',     purchaseDMs: [{ code:'I',  dm:-3 },{ code:'R',  dm:-2 }],                       resaleDMs: [{ code:'NI', dm:+2 },{ code:'P',  dm:+1 }] },
  { die: '53', name: 'Computers',         basePriceCr:  10000000, qty: '1D',     purchaseDMs: [{ code:'I',  dm:-2 },{ code:'R',  dm:-2 }],                       resaleDMs: [{ code:'NI', dm:+2 },{ code:'P',  dm:+1 },{ code:'A',  dm:-3 }] },
  { die: '54', name: 'All Terrain Vehicles', basePriceCr: 3000000, qty: '1D',    purchaseDMs: [{ code:'I',  dm:-2 },{ code:'R',  dm:-2 }],                       resaleDMs: [{ code:'NI', dm:+2 },{ code:'P',  dm:+1 },{ code:'A',  dm:+1 }] },
  { die: '55', name: 'Armored Vehicles',  basePriceCr:   7000000, qty: '1D',     purchaseDMs: [{ code:'I',  dm:-5 },{ code:'R',  dm:-2 },{ code:'P',  dm:+4 }], resaleDMs: [{ code:'NA', dm:-2 },{ code:'A',  dm:+2 },{ code:'R',  dm:+1 }] },
  { die: '56', name: 'Farm Machinery',    basePriceCr:    150000, qty: '1D',     purchaseDMs: [{ code:'I',  dm:-5 },{ code:'R',  dm:-2 }],                       resaleDMs: [{ code:'A',  dm:+5 },{ code:'NA', dm:-8 },{ code:'P',  dm:+1 }] },
  { die: '61', name: 'Electronics Parts', basePriceCr:    100000, qty: '1Dx5',   purchaseDMs: [{ code:'I',  dm:-4 },{ code:'R',  dm:-3 }],                       resaleDMs: [{ code:'NI', dm:+2 },{ code:'P',  dm:+1 }] },
  { die: '62', name: 'Mechanical Parts',  basePriceCr:     70000, qty: '1Dx5',   purchaseDMs: [{ code:'I',  dm:-5 },{ code:'R',  dm:-3 }],                       resaleDMs: [{ code:'NI', dm:+3 },{ code:'A',  dm:+2 }] },
  { die: '63', name: 'Cybernetic Parts',  basePriceCr:    250000, qty: '1Dx5',   purchaseDMs: [{ code:'I',  dm:-4 },{ code:'R',  dm:-1 }],                       resaleDMs: [{ code:'NI', dm:+4 },{ code:'A',  dm:+1 },{ code:'NA', dm:+2 }] },
  { die: '64', name: 'Computer Parts',    basePriceCr:    150000, qty: '1Dx5',   purchaseDMs: [{ code:'I',  dm:-5 },{ code:'R',  dm:-3 }],                       resaleDMs: [{ code:'NI', dm:+3 },{ code:'A',  dm:+1 },{ code:'NA', dm:+2 }] },
  { die: '65', name: 'Machine Tools',     basePriceCr:    750000, qty: '1Dx5',   purchaseDMs: [{ code:'I',  dm:-5 },{ code:'R',  dm:-4 }],                       resaleDMs: [{ code:'NI', dm:+3 },{ code:'A',  dm:+1 },{ code:'NA', dm:+2 }] },
  { die: '66', name: 'Vacc Suits',        basePriceCr:    400000, qty: '1Dx5',   purchaseDMs: [{ code:'NA', dm:-5 },{ code:'I',  dm:-3 },{ code:'R',  dm:-1 }], resaleDMs: [{ code:'NA', dm:-1 },{ code:'NI', dm:+2 },{ code:'P',  dm:+1 }] },
]

// CT Book 2 trade code abbreviation map (used in CT2 DM tables)
export const CT2_CODE_MAP = {
  A: 'Ag', NA: 'Na', I: 'In', NI: 'Ni', R: 'Ri', P: 'Po',
}

// CT Book 7 Market Price Table — source trade class × market trade class → Cr1,000 DM
// Rows = source world trade classification; columns = market (destination) world trade classification.
// Only non-zero entries are stored; missing pairs = 0.
// Source: Classic Traveller Book 7, Merchant Prince — Market Price Table.
export const CT7_MARKET_PRICE_TABLE = {
  Ag: { Ag:+1, As:+1, De:+1, Hi:+1, In:+1, Lo:+1, Na:+1, Ri:+1 },
  As: { As:+1, In:+1, Na:+1, Ri:+1, Va:+1 },
  Ba: { Ag:+1, In:+1 },
  De: { De:+1, Na:+1 },
  Fl: { Fl:+1, In:+1 },
  Hi: { Hi:+1, Lo:+1, Ri:+1 },
  Ic: { Ic:+1 },
  In: { Ag:+1, As:+1, De:+1, Fl:+1, Hi:+1, In:+1, Ni:+1, Po:+1, Ri:+1, Va:+1, Wa:+1 },
  Lo: { In:+1, Ri:+1 },
  Na: { As:+1, De:+1, Va:+1 },
  Ni: { In:+1, Ni:-1 },
  Po: { Po:-1 },
  Ri: { Ag:+1, De:+1, Hi:+1, In:+1, Na:+1, Ri:+1 },
  Va: { As:+1, In:+1, Va:+1 },
  Wa: { In:+1, Ri:+1, Wa:+1 },
}

// CT Book 7 Alien Trade Effects (source race → market race → Cr1,000 DM)
// Positive = goods from row race sell better in column race markets.
export const CT7_ALIEN_EFFECTS = {
  As: { Hv: -2, Va: +1 },
  Dr: { Zh: +2 },
  Hv: { As: +1, Zh: -2 },
  Im: { Zh: -1 },
  Kk: { Va: -2 },
  So: { Im: +1, As: -1 },
  Va: { Im: -4 },
  Zh: { As: +1, Im: +1, Hv: -2 },
}
