/**
 * IndexedDB cache for Traveller Map API responses (universe index + per-
 * sector world/route data), so a slow/unreachable travellermap.com degrades
 * to "showing last-known data" instead of a blank/broken world list.
 *
 * Sizing: universe index ~30-45KB per milieu; a sector entry is ~8-15KB on
 * average (dense/route-heavy sectors up to ~30-40KB). A realistic campaign
 * (a handful of sectors, one milieu) stays well under 1MB; even browsing
 * every named sector across every era tops out around ~30-40MB — safely
 * within normal IndexedDB origin quotas. No eviction policy is needed.
 *
 * Staleness is advisory only: a stale entry is still served immediately
 * (better than nothing) and just signals "try a background refresh" — it
 * never blocks use the way a hard TTL expiry would.
 */

import { openDB } from './idb.js'

const UNIVERSE_STORE = 'universe-cache'
const SECTOR_STORE   = 'sector-cache'
const STALE_MS        = 30 * 24 * 60 * 60 * 1000 // 30 days — sector data is near-static reference data

function sectorKey(milieu, sectorName) {
  return `${milieu}::${sectorName}`
}

export function isStale(fetchedAt) {
  return !fetchedAt || (Date.now() - fetchedAt) > STALE_MS
}

export async function cacheGetUniverse(milieu) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(UNIVERSE_STORE).objectStore(UNIVERSE_STORE).get(milieu)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror   = () => reject(req.error)
  })
}

export async function cacheSaveUniverse(milieu, sectors) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(UNIVERSE_STORE, 'readwrite').objectStore(UNIVERSE_STORE)
      .put({ milieu, sectors, fetchedAt: Date.now() })
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

export async function cacheGetSector(milieu, sectorName) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(SECTOR_STORE).objectStore(SECTOR_STORE).get(sectorKey(milieu, sectorName))
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror   = () => reject(req.error)
  })
}

export async function cacheSaveSector(milieu, sectorName, data) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(SECTOR_STORE, 'readwrite').objectStore(SECTOR_STORE)
      .put({ id: sectorKey(milieu, sectorName), ...data, fetchedAt: Date.now() })
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}
