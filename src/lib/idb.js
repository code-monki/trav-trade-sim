/**
 * Shared IndexedDB connection helper — one database, multiple object
 * stores, so every consumer (themes, Traveller Map cache, ...) agrees on
 * a single DB_VERSION and upgrade path instead of racing separate
 * `indexedDB.open()` calls with different version numbers.
 *
 * To add a new store: bump DB_VERSION and add a new
 * `if (!db.objectStoreNames.contains(...))` guard below — never open this
 * database with a different version elsewhere. The guards make the
 * upgrade idempotent regardless of which consumer's `openDB()` call
 * happens to trigger it first.
 */

const DB_NAME    = 'traveller-trade-sim'
const DB_VERSION = 2

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('user-themes')) {
        db.createObjectStore('user-themes', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('universe-cache')) {
        db.createObjectStore('universe-cache', { keyPath: 'milieu' })
      }
      if (!db.objectStoreNames.contains('sector-cache')) {
        db.createObjectStore('sector-cache', { keyPath: 'id' })
      }
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}
