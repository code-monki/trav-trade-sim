import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase.js'

const SESSION_KEY = 'tts_session'

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSession(campaign, player) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ campaign, player }))
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY)
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

  function requireSupabase() {
    if (!supabase) throw new Error('Database not configured — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
  }

  // ── Create a new campaign (referee creates + joins in one step) ─────────────
  async function createCampaign({ label, code, milieu, tradeRules, characterName, pin }) {
    loading.value = true
    error.value   = null
    try {
      requireSupabase()
      const { data, error: rpcError } = await supabase.rpc('create_campaign', {
        p_label:       label,
        p_code:        code,
        p_milieu:      milieu,
        p_trade_rules: tradeRules,
        p_char_name:   characterName,
        p_pin:         pin,
      })
      if (rpcError) throw new Error(rpcError.message)
      if (data?.error) throw new Error(data.error)

      campaign.value = data.campaign
      player.value   = data.player
      saveSession(data.campaign, data.player)
      return { ok: true }
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
      requireSupabase()
      const { data, error: rpcError } = await supabase.rpc('join_campaign', {
        p_code:      code,
        p_char_name: characterName,
        p_pin:       pin,
      })
      if (rpcError) throw new Error(rpcError.message)
      if (data?.error) throw new Error(data.error)

      // After registering, immediately verify to load the full session
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
      requireSupabase()
      const { data, error: rpcError } = await supabase.rpc('verify_pin', {
        p_code:      code,
        p_char_name: characterName,
        p_pin:       pin,
      })
      if (rpcError) throw new Error(rpcError.message)
      if (data?.error) {
        if (data.locked_until) {
          const until = new Date(data.locked_until)
          throw new Error(`${data.error}. Try again after ${until.toLocaleTimeString()}.`)
        }
        const remaining = data.attempts_remaining
        const suffix = remaining != null ? ` (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)` : ''
        throw new Error(`${data.error}${suffix}`)
      }

      campaign.value = data.campaign
      player.value   = data.player
      saveSession(data.campaign, data.player)
      return { ok: true }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── Log out ─────────────────────────────────────────────────────────────────
  function logout() {
    campaign.value = null
    player.value   = null
    clearSession()
  }

  return {
    campaign, player, loading, error,
    isAuthenticated, isReferee,
    clearError, createCampaign, joinCampaign, login, logout,
  }
})
