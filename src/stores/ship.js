import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase.js'

export const useShipStore = defineStore('ship', () => {
  const ship    = ref(null)   // current ship record (or null if not aboard one)
  const loading = ref(false)
  const error   = ref(null)

  const hasShip        = computed(() => !!ship.value)
  const cargoUsed      = computed(() => ship.value?.cargo_used     ?? 0)
  const cargoCapacity  = computed(() => ship.value?.cargo_capacity ?? 0)
  const cargoAvailable = computed(() => cargoCapacity.value - cargoUsed.value)

  function clearError() { error.value = null }

  // ── loadShip ──────────────────────────────────────────────────────────────
  // Find the active ship for a player (crew row with left_tick IS NULL).
  // Also computes cargo_used from the cargo table so the UI always has a
  // current free-space figure without a separate query.

  async function loadShip(playerId, campaignId) {
    if (!supabase || !playerId || !campaignId) return
    loading.value = true
    error.value   = null
    try {
      // Active crew assignment → ship details
      const { data: crewRows, error: crewErr } = await supabase
        .from('crew')
        .select('role, ship_id, ships(*)')
        .eq('player_id', campaignId ? playerId : playerId)
        .eq('campaign_id', campaignId)
        .is('left_tick', null)
        .limit(1)
        .single()

      if (crewErr?.code === 'PGRST116') {
        // no rows — player not currently assigned to a ship
        ship.value = null
        return
      }
      if (crewErr) throw new Error(crewErr.message)

      const s = crewRows.ships

      // Compute cargo currently in hold
      const { data: cargoRows, error: cargoErr } = await supabase
        .from('cargo')
        .select('tons')
        .eq('ship_id', s.id)
        .eq('campaign_id', campaignId)

      if (cargoErr) throw new Error(cargoErr.message)

      const usedTons = (cargoRows ?? []).reduce((sum, r) => sum + r.tons, 0)

      ship.value = {
        ...s,
        crew_role: crewRows.role,
        cargo_used: usedTons,
      }
    } catch (e) {
      error.value = e.message
      ship.value  = null
    } finally {
      loading.value = false
    }
  }

  // ── createShip ────────────────────────────────────────────────────────────
  // Create a new ship and immediately assign the creating player as captain.

  async function createShip({ campaignId, playerId, name, hullType, hullTons, cargoCapacity, currentTick = 0 }) {
    loading.value = true
    error.value   = null
    try {
      const { data: newShip, error: shipErr } = await supabase
        .from('ships')
        .insert({
          campaign_id:    campaignId,
          name,
          hull_type:      hullType   ?? null,
          hull_tons:      hullTons   ?? 200,
          cargo_capacity: cargoCapacity ?? 80,
        })
        .select()
        .single()

      if (shipErr) throw new Error(shipErr.message)

      const { error: crewErr } = await supabase
        .from('crew')
        .insert({
          campaign_id: campaignId,
          ship_id:     newShip.id,
          player_id:   playerId,
          role:        'captain',
          joined_tick: currentTick,
        })

      if (crewErr) throw new Error(crewErr.message)

      ship.value = { ...newShip, crew_role: 'captain', cargo_used: 0 }
      return { ok: true, ship: ship.value }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── updateLocation ────────────────────────────────────────────────────────
  // Record the ship's current position after a jump.

  async function updateLocation(worldHex, sector) {
    if (!ship.value) return
    const { error: err } = await supabase
      .from('ships')
      .update({ current_world: worldHex, current_sector: sector })
      .eq('id', ship.value.id)

    if (!err) {
      ship.value = { ...ship.value, current_world: worldHex, current_sector: sector }
    }
  }

  // ── adjustCredits ─────────────────────────────────────────────────────────
  // Update the ship's operating account.  delta is positive for income,
  // negative for expenditure.  The caller is responsible for writing the
  // matching transactions row for the ledger.

  async function adjustCredits(delta) {
    if (!ship.value) return { ok: false, error: 'No active ship' }
    const newBalance = ship.value.credits + delta
    const { error: err } = await supabase
      .from('ships')
      .update({ credits: newBalance })
      .eq('id', ship.value.id)

    if (err) return { ok: false, error: err.message }
    ship.value = { ...ship.value, credits: newBalance }
    return { ok: true }
  }

  function clear() {
    ship.value    = null
    loading.value = false
    error.value   = null
  }

  return {
    ship, loading, error,
    hasShip, cargoUsed, cargoCapacity, cargoAvailable,
    clearError, loadShip, createShip, updateLocation, adjustCredits, clear,
  }
})
