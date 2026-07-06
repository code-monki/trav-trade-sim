// HTTP client for the Cloudflare Worker API.
// All stores and components import this instead of supabase.

const BASE = import.meta.env.VITE_API_URL

function getToken() {
  try {
    const raw = localStorage.getItem('tts_session')
    return raw ? (JSON.parse(raw).token ?? null) : null
  } catch { return null }
}

function authHeaders() {
  const token   = getToken()
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

async function request(method, path, body, params) {
  if (!BASE) return { data: null, error: 'API not configured — check VITE_API_URL' }
  let res
  try {
    res = await fetch(buildUrl(path, params), {
      method,
      headers: authHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (e) {
    return { data: null, error: e.message ?? 'Network error' }
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Spread the full error body so callers can inspect locked_until, attempts_remaining, etc.
    return { data: null, ...json, error: json.error ?? `HTTP ${res.status}` }
  }
  return { data: json.data ?? null, error: null }
}

export const api = {
  get:    (path, params) => request('GET',    path, undefined, params),
  post:   (path, body)   => request('POST',   path, body),
  patch:  (path, body)   => request('PATCH',  path, body),
  delete: (path, body)   => request('DELETE', path, body),
}
