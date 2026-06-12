/**
 * Minimal IndexedDB wrapper for persisting user-defined themes.
 * Database: traveller-trade-sim  v1
 * Store:    user-themes  (keyPath: id)
 */

const DB_NAME    = 'traveller-trade-sim'
const DB_VERSION = 1
const STORE      = 'user-themes'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

export async function dbGetAllThemes() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result ?? [])
    req.onerror   = () => reject(req.error)
  })
}

export async function dbSaveTheme(theme) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(theme)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

export async function dbDeleteTheme(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}
