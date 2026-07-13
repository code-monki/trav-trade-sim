import { describe, it, expect } from 'vitest'
import { diffMigrations, EXPECTED_MIGRATIONS } from '../worker/src/lib/schema-version.js'

describe('diffMigrations', () => {
  it('reports ok when the applied set exactly matches expected', () => {
    const result = diffMigrations([...EXPECTED_MIGRATIONS])
    expect(result).toEqual({ ok: true, missing: [], unexpected: [] })
  })

  it('reports missing IDs when the database is behind', () => {
    const applied = EXPECTED_MIGRATIONS.filter(id => id !== '011')
    const result = diffMigrations(applied)
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual(['011'])
    expect(result.unexpected).toEqual([])
  })

  it('reports unexpected IDs when the database is ahead of this Worker build', () => {
    const applied = [...EXPECTED_MIGRATIONS, '012']
    const result = diffMigrations(applied)
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual([])
    expect(result.unexpected).toEqual(['012'])
  })

  it('reports both missing and unexpected IDs at once', () => {
    const applied = EXPECTED_MIGRATIONS.filter(id => id !== '005').concat('099')
    const result = diffMigrations(applied)
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual(['005'])
    expect(result.unexpected).toEqual(['099'])
  })

  it('reports everything missing for an empty ledger (pre-migration-011 database)', () => {
    const result = diffMigrations([])
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual(EXPECTED_MIGRATIONS)
    expect(result.unexpected).toEqual([])
  })

  it('is order-independent', () => {
    const shuffled = [...EXPECTED_MIGRATIONS].reverse()
    expect(diffMigrations(shuffled).ok).toBe(true)
  })
})
