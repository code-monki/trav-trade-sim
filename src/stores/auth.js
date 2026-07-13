import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api, setUnauthorizedHandler } from '../lib/api.js'
import { useShipStore } from './ship.js'
import router from '../router/index.js'

const SESSION_KEY = 'tts_session'

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveSession(campaign, player, token) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ campaign, player, token }))
  } catch { /* storage-restricted browser — session stays in-memory only for this tab */ }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch { /* storage-restricted browser — nothing to clear */ }
}

export const useAuthStore = defineStore('auth', () => {
  const saved = loadSession()

  const campaign = ref(saved?.campaign ?? null)
  const player   = ref(saved?.player   ?? null)
  const loading  = ref(false)
  const error    = ref(null)

  const isAuthenticated = computed(() => !!player.value && !!campaign.value)
  const isReferee       = computed(() => player.value?.role === 'referee')

  function clearError() { error.value = null }

  // ── Create a new campaign (referee creates + joins in one step) ─────────────
  async function createCampaign({ label, code, milieu, tradeRules, startYear = 1105, startWeek = 1, characterName, pin }) {
    loading.value = true
    error.value   = null
    try {
      const startTick = Math.max(0, (startYear - 1105) * 48 + (startWeek - 1))
      const { data, error: apiErr } = await api.post('/api/campaigns', {
        label, code, milieu,
        trade_rules: tradeRules,
        char_name:   characterName,
        pin,
        start_tick:  startTick,
      })
      if (apiErr) throw new Error(apiErr)

      campaign.value = data.campaign
      player.value   = data.player
      saveSession(data.campaign, data.player, data.token)
      return { ok: true, recoveryCode: data.recovery_code }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── Join an existing campaign as a new character ────────────────────────────
  async function joinCampaign({ code, characterName, pin }) {
    loading.value = true
    error.value   = null
    try {
      const { error: apiErr } = await api.post('/api/campaigns/join', {
        code, char_name: characterName, pin,
      })
      if (apiErr) throw new Error(apiErr)
      // After registering, log in to get a session token
      return await login({ code, characterName, pin })
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── Log in with an existing character + PIN ─────────────────────────────────
  async function login({ code, characterName, pin }) {
    loading.value = true
    error.value   = null
    try {
      const result = await api.post('/api/auth/login', {
        code, char_name: characterName, pin,
      })
      if (result.error) {
        if (result.locked_until) {
          const until = new Date(result.locked_until)
          throw new Error(`${result.error}. Try again after ${until.toLocaleTimeString()}.`)
        }
        const remaining = result.attempts_remaining
        const suffix = remaining != null ? ` (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)` : ''
        throw new Error(`${result.error}${suffix}`)
      }

      campaign.value = result.data.campaign
      player.value   = result.data.player
      saveSession(result.data.campaign, result.data.player, result.data.token)

      useShipStore().loadShip(result.data.player.id, result.data.campaign.id)
      return { ok: true }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── Regenerate recovery code ──────────────────────────────────────────────────
  async function regenerateRecoveryCode() {
    if (!campaign.value?.id) return { ok: false, error: 'No active campaign' }
    loading.value = true
    error.value   = null
    try {
      const { data, error: apiErr } = await api.post('/api/campaigns/recovery-code', {})
      if (apiErr) throw new Error(apiErr)
      return { ok: true, recoveryCode: data.recovery_code }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── Reset PIN with recovery code ─────────────────────────────────────────────
  async function resetPin({ code, characterName, recoveryCode, newPin }) {
    loading.value = true
    error.value   = null
    try {
      const { error: apiErr } = await api.post('/api/campaigns/reset-pin', {
        code, char_name: characterName, recovery: recoveryCode, new_pin: newPin,
      })
      if (apiErr) throw new Error(apiErr)
      return { ok: true }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── Delete campaign (referee only, requires PIN) ─────────────────────────────
  async function deleteCampaign({ pin }) {
    if (!campaign.value?.id) return { ok: false, error: 'No active campaign' }
    loading.value = true
    error.value   = null
    try {
      const { error: apiErr } = await api.delete(`/api/campaigns/${campaign.value.id}`, { pin })
      if (apiErr) throw new Error(apiErr)
      await logout()
      return { ok: true }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── Log out ─────────────────────────────────────────────────────────────────
  async function logout() {
    await api.post('/api/auth/logout', {}).catch(() => {})
    campaign.value = null
    player.value   = null
    clearSession()
    useShipStore().clear()
  }

  // A 401 on an authenticated request (expired/invalid session token) logs
  // out and redirects once, centrally, instead of every store surfacing its
  // own "Unauthorized" error forever.
  setUnauthorizedHandler(async () => {
    await logout()
    router.push({ name: 'login' })
  })

  return {
    campaign, player, loading, error,
    isAuthenticated, isReferee,
    clearError, createCampaign, joinCampaign, login, resetPin, regenerateRecoveryCode, deleteCampaign, logout,
  }
})
