// HTTP client for the Cloudflare Worker API.
// All stores and components import this instead of supabase.

const BASE = import.meta.env.VITE_API_URL
const TIMEOUT_MS = 15000

function getToken() {
  try {
    const raw = localStorage.getItem('tts_session')
    return raw ? (JSON.parse(raw).token ?? null) : null
  } catch { return null }
}

function authHeaders(token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

function buildUrl(path, params) {
  const url = `${BASE}${path}`
  if (!params) return url
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
  ).toString()
  return qs ? `${url}?${qs}` : url
}

// Set by auth.js at startup so a 401 on an authenticated request can log the
// session out and redirect once, centrally, instead of every caller having
// to notice "Unauthorized" in its own error string.
let onUnauthorized = null
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

async function request(method, path, body, params) {
  if (!BASE) return { data: null, error: 'API not configured — check VITE_API_URL', errorKind: 'config' }
  const token = getToken()
  let res
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    res = await fetch(buildUrl(path, params), {
      method,
      headers: authHeaders(token),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (e) {
    if (e.name === 'AbortError') {
      return { data: null, error: 'Request timed out', errorKind: 'timeout' }
    }
    return { data: null, error: e.message ?? 'Network error', errorKind: 'network' }
  } finally {
    clearTimeout(timer)
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && token && onUnauthorized) onUnauthorized()
    // Spread the full error body so callers can inspect locked_until, attempts_remaining, etc.
    return { data: null, ...json, error: json.error ?? `HTTP ${res.status}`, errorKind: 'http' }
  }
  return { data: json.data ?? null, error: null }
}

export const api = {
  get:    (path, params) => request('GET',    path, undefined, params),
  post:   (path, body)   => request('POST',   path, body),
  patch:  (path, body)   => request('PATCH',  path, body),
  delete: (path, body)   => request('DELETE', path, body),
}
