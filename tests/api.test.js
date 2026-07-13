// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { api, setUnauthorizedHandler } from '../src/lib/api.js'

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }
}

beforeEach(() => {
  localStorage.clear()
  setUnauthorizedHandler(null)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('api errorKind', () => {
  it('tags a network failure as errorKind "network"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))
    const { data, error, errorKind } = await api.get('/api/ping')
    expect(data).toBeNull()
    expect(error).toBe('Failed to fetch')
    expect(errorKind).toBe('network')
  })

  it('tags a non-2xx response as errorKind "http"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, { error: 'Not found' })))
    const { data, error, errorKind } = await api.get('/api/ping')
    expect(data).toBeNull()
    expect(error).toBe('Not found')
    expect(errorKind).toBe('http')
  })

  it('returns no errorKind on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { data: { ok: true } })))
    const { data, error, errorKind } = await api.get('/api/ping')
    expect(data).toEqual({ ok: true })
    expect(error).toBeNull()
    expect(errorKind).toBeUndefined()
  })
})

describe('api timeout', () => {
  it('aborts and tags errorKind "timeout" after 15s', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const err = new Error('This operation was aborted')
        err.name = 'AbortError'
        reject(err)
      })
    })))

    const pending = api.get('/api/slow')
    await vi.advanceTimersByTimeAsync(15000)
    const { data, error, errorKind } = await pending

    expect(data).toBeNull()
    expect(error).toBe('Request timed out')
    expect(errorKind).toBe('timeout')
  })
})

describe('api 401 interceptor', () => {
  it('does not fire onUnauthorized when no session token is present', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { error: 'Unauthorized' })))

    await api.post('/api/auth/login', { code: 'X', char_name: 'Y', pin: '0000' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('fires onUnauthorized once on a 401 for an authenticated request', async () => {
    localStorage.setItem('tts_session', JSON.stringify({ token: 'abc123' }))
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { error: 'Unauthorized' })))

    await api.get('/api/ships/current', { player_id: 1, campaign_id: 1 })
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
