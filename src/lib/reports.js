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
