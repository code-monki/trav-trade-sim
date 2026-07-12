import { BASE_YEAR, TICKS_PER_YEAR } from './market-tick.js'

export function aggregateByType(rows) {
  const result = {}
  for (const r of rows) {
    result[r.type] = (result[r.type] ?? 0) + (r.total_cr ?? 0)
  }
  return result
}

export function yearToTickRange(yearFrom, yearTo) {
  const gte = (yearFrom - BASE_YEAR) * TICKS_PER_YEAR
  const lt  = (yearTo  - BASE_YEAR + 1) * TICKS_PER_YEAR
  return { gte, lt }
}

// Shared between ReportsPanel.vue (per-ship) and OrganizationsPanel.vue's
// Fleet Report (aggregated) — both render the same transaction-type breakdown.
export const TYPE_LABEL = {
  buy:              'Buy',
  sell:             'Sell',
  fuel:             'Fuel',
  passenger_fare:   'Passage',
  passenger_refund: 'Refund',
  mail:             'Mail',
  fee:              'Fee',
  event:            'Event',
}

export const INCOME_TYPES = {
  sell:           'Cargo Sales',
  passenger_fare: 'Passenger Fares',
  mail:           'Mail Deliveries',
}

export const EXPENSE_TYPES = {
  buy:              'Cargo Purchases',
  fuel:             'Fuel Purchases',
  passenger_refund: 'Passenger Refunds',
  fee:              'Fees',
  event:            'Event Debits',
}

export const DEBT_TYPE_LABEL = { mortgage: 'Mortgage', loan: 'Loan', obligation: 'Obligation' }
