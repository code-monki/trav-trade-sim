/**
 * Minimal IndexedDB wrapper for persisting user-defined themes.
 * Database/store definition lives in `./idb.js` (shared across consumers).
 */

import { openDB } from './idb.js'

const STORE = 'user-themes'

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
