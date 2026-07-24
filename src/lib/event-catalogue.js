// Pre-built M.U.L.E.-style market events. Referee picks one in
// AssignEventDialog.vue to pre-fill the assign form, or just browses them
// read-only via EventPresetsDialog.vue. Static and hardcoded rather than
// DB-backed — a fixed reference list, not something referees edit or delete.
export const EVENT_CATALOGUE = [
  { description: 'Pirate raid disrupts supply lines',       buyModifierPct:  30, sellModifierPct: null, durationTicks: 4 },
  { description: 'Trade embargo imposed',                   buyModifierPct:  20, sellModifierPct: -20,  durationTicks: 8 },
  { description: 'Bumper harvest floods the market',        buyModifierPct: -20, sellModifierPct: -30,  durationTicks: 4 },
  { description: 'Drought: food & consumables scarce',      buyModifierPct:  25, sellModifierPct:  25,  durationTicks: 6 },
  { description: 'Tech festival drives demand',             buyModifierPct:  15, sellModifierPct:  20,  durationTicks: 3 },
  { description: 'Port workers strike',                     buyModifierPct:  10, sellModifierPct: -10,  durationTicks: 3 },
  { description: 'Imperial subsidy lowers prices',          buyModifierPct: -15, sellModifierPct: null, durationTicks: 4 },
  { description: 'Megacorp buyout: prices spike',           buyModifierPct:  20, sellModifierPct:  20,  durationTicks: 6 },
  { description: 'Military contract boosts demand',         buyModifierPct:  20, sellModifierPct:  25,  durationTicks: 4 },
  { description: 'Misjump quarantine: traffic halted',      buyModifierPct:  15, sellModifierPct: -25,  durationTicks: 5 },
  { description: 'New refinery opens: fuel costs drop',     buyModifierPct: -10, sellModifierPct: null, durationTicks: 8 },
  { description: 'Scout survey finds rich lode',            buyModifierPct: -20, sellModifierPct:  15,  durationTicks: 6 },
  { description: 'Political unrest disrupts distribution',  buyModifierPct:  15, sellModifierPct: -15,  durationTicks: 4 },
  { description: 'Festival of the Traveller: demand surge', buyModifierPct:  10, sellModifierPct:  15,  durationTicks: 2 },
  { description: 'Counterfeit goods scandal',               buyModifierPct: null, sellModifierPct: -20,  durationTicks: 4 },
  { description: 'Pandemic scare: medical goods scarce',    buyModifierPct:  30, sellModifierPct:  30,  durationTicks: 6 },
  { description: 'Surplus clearance: bulk discount',        buyModifierPct: -25, sellModifierPct: -15,  durationTicks: 3 },
  { description: 'Noble house patronage: luxury demand up', buyModifierPct:  15, sellModifierPct:  25,  durationTicks: 4 },
  { description: 'Wormhole route opens: competition rises', buyModifierPct: -10, sellModifierPct: -10,  durationTicks: 12 },
  { description: 'Natural disaster: relief goods needed',   buyModifierPct:  35, sellModifierPct:  35,  durationTicks: 6 },
]
