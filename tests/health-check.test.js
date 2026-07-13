// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppErrorStore } from '../src/stores/appError.js'
import { checkSchemaHealth } from '../src/lib/health-check.js'

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('checkSchemaHealth', () => {
  it('sets a schema-drift fatal error when the health endpoint reports drift', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(503, {
      error: 'Database schema drift detected',
      schema_ok: false,
      missing_migrations: ['011'],
      unexpected_migrations: [],
    })))

    await checkSchemaHealth()

    const appError = useAppErrorStore()
    expect(appError.fatalError).toMatchObject({
      kind: 'schema-drift',
      message: 'Database schema drift detected',
      missing: ['011'],
      unexpected: [],
    })
  })

  it('does nothing when the schema is healthy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, {
      data: { ok: true, schema_ok: true, applied_migrations: ['001'] },
    })))

    await checkSchemaHealth()

    expect(useAppErrorStore().fatalError).toBeNull()
  })

  it('does nothing on a plain network failure — not this check\'s concern', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))

    await checkSchemaHealth()

    expect(useAppErrorStore().fatalError).toBeNull()
  })

  it('does nothing on an unrelated HTTP error (e.g. a 500 with no schema_ok field)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, { error: 'Internal error' })))

    await checkSchemaHealth()

    expect(useAppErrorStore().fatalError).toBeNull()
  })
})
