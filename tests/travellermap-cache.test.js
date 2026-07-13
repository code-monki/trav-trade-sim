import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import {
  isStale, cacheGetUniverse, cacheSaveUniverse, cacheGetSector, cacheSaveSector,
} from '../src/lib/travellermap-cache.js'

// `openDB()` never closes its connections (matching real usage — the
// browser reaps them), so tests share one database for the whole file
// rather than deleting it between tests, which would hang waiting for
// those connections to close. Each test uses its own milieu/sector name
// to avoid cross-test collisions instead.

describe('isStale', () => {
  it('treats a missing timestamp as stale', () => {
    expect(isStale(null)).toBe(true)
    expect(isStale(undefined)).toBe(true)
  })

  it('treats a recent timestamp as fresh', () => {
    expect(isStale(Date.now())).toBe(false)
  })

  it('treats a timestamp older than 30 days as stale', () => {
    expect(isStale(Date.now() - 31 * 24 * 60 * 60 * 1000)).toBe(true)
  })
})

describe('universe cache round-trip', () => {
  it('returns null for a milieu that has never been cached', async () => {
    expect(await cacheGetUniverse('M-never-cached')).toBeNull()
  })

  it('saves and retrieves sectors for a milieu', async () => {
    const sectors = [{ name: 'Spinward Marches', abbreviation: 'Spin', x: -4, y: -1, tags: '' }]
    await cacheSaveUniverse('M-round-trip', sectors)
    const cached = await cacheGetUniverse('M-round-trip')
    expect(cached.sectors).toEqual(sectors)
    expect(typeof cached.fetchedAt).toBe('number')
  })

  it('keeps separate entries per milieu', async () => {
    await cacheSaveUniverse('M-sep-1', [{ name: 'A' }])
    await cacheSaveUniverse('M-sep-2', [{ name: 'B' }])
    expect((await cacheGetUniverse('M-sep-1')).sectors).toEqual([{ name: 'A' }])
    expect((await cacheGetUniverse('M-sep-2')).sectors).toEqual([{ name: 'B' }])
  })
})

describe('sector cache round-trip', () => {
  it('returns null for a sector that has never been cached', async () => {
    expect(await cacheGetSector('M-never-cached', 'Nowhere')).toBeNull()
  })

  it('saves and retrieves world/route data for a sector', async () => {
    const data = {
      worldHeaders: ['Hex', 'Name'],
      worlds: [{ Hex: '0101', Name: 'Regina' }],
      sectorRoutes: [{ start: '0101', end: '0102' }],
      subsectorNames: { A: 'Cronor' },
    }
    await cacheSaveSector('M-round-trip', 'Spinward Marches', data)
    const cached = await cacheGetSector('M-round-trip', 'Spinward Marches')
    expect(cached).toMatchObject(data)
    expect(typeof cached.fetchedAt).toBe('number')
  })

  it('keeps separate entries per (milieu, sector) pair', async () => {
    await cacheSaveSector('M-sep-3', 'Spinward Marches', { worlds: [{ Hex: '0101' }] })
    await cacheSaveSector('M-sep-3', 'Deneb', { worlds: [{ Hex: '0202' }] })
    expect((await cacheGetSector('M-sep-3', 'Spinward Marches')).worlds).toEqual([{ Hex: '0101' }])
    expect((await cacheGetSector('M-sep-3', 'Deneb')).worlds).toEqual([{ Hex: '0202' }])
  })
})
