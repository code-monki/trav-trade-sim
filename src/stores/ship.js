import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase.js'

export const useShipStore = defineStore('ship', () => {
  const ship    = ref(null)   // current ship record (or null if not aboard one)
  const cargo   = ref([])     // cargo rows currently in the hold
  const loading = ref(false)
  const error   = ref(null)

  const hasShip        = computed(() => !!ship.value)
  const canTrade       = computed(() => ship.value?.can_trade ?? false)
  const cargoUsed      = computed(() => cargo.value.reduce((s, r) => s + r.tons, 0))
  const cargoCapacity  = computed(() => ship.value?.cargo_capacity ?? 0)
  const cargoAvailable = computed(() => cargoCapacity.value - cargoUsed.value)

  function clearError() { error.value = null }

  // ── loadShip ──────────────────────────────────────────────────────────────
  // Find the active ship for a player (crew row with left_tick IS NULL).
  // Loads full cargo rows so the hold display and cargoUsed are always current.

  async function loadShip(playerId, campaignId) {
    if (!supabase || !playerId || !campaignId) return
    loading.value = true
    error.value   = null
    try {
      const { data: crewRows, error: crewErr } = await supabase
        .from('crew')
        .select('role, can_trade, ship_id, ships(*)')
        .eq('player_id', playerId)
        .eq('campaign_id', campaignId)
        .is('left_tick', null)
        .limit(1)
        .single()

      if (crewErr?.code === 'PGRST116') {
        ship.value  = null
        cargo.value = []
        return
      }
      if (crewErr) throw new Error(crewErr.message)

      const s = crewRows.ships

      const { data: cargoRows, error: cargoErr } = await supabase
        .from('cargo')
        .select('*')
        .eq('ship_id', s.id)
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true })

      if (cargoErr) throw new Error(cargoErr.message)

      cargo.value = cargoRows ?? []
      ship.value  = { ...s, crew_role: crewRows.role, can_trade: crewRows.can_trade }
    } catch (e) {
      error.value = e.message
      ship.value  = null
      cargo.value = []
    } finally {
      loading.value = false
    }
  }

  // ── createShip ────────────────────────────────────────────────────────────

  async function createShip({ campaignId, playerId, name, hullType, hullTons, cargoCapacity: cap, currentTick = 0 }) {
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
          cargo_capacity: cap        ?? 80,
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

      cargo.value = []
      ship.value  = { ...newShip, crew_role: 'captain' }
      return { ok: true, ship: ship.value }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── updateLocation ────────────────────────────────────────────────────────

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

  // ── buyCargo ──────────────────────────────────────────────────────────────
  // Purchase cargo at a world.  Inserts a cargo row, debits the ship's credit
  // account, and writes an immutable transaction ledger entry.

  async function buyCargo({ campaignId, playerId, good, tons, worldHex, sector, tick }) {
    if (!ship.value) return { ok: false, error: 'No active ship' }
    if (!canTrade.value) return { ok: false, error: 'Not authorized to trade — check with your referee' }

    const totalCost = good.purchase_price * tons
    if ((ship.value.credits ?? 0) < totalCost)
      return { ok: false, error: 'Insufficient credits' }
    if (cargoAvailable.value < tons)
      return { ok: false, error: 'Insufficient cargo space' }

    loading.value = true
    error.value   = null
    try {
      const { data: cargoRow, error: cargoErr } = await supabase
        .from('cargo')
        .insert({
          campaign_id:     campaignId,
          player_id:       playerId,
          ship_id:         ship.value.id,
          trade_good_die:  good.trade_good_die,
          trade_good_name: good.trade_good_name,
          tons,
          purchase_price:  good.purchase_price,
          purchased_tick:  tick,
          purchase_world:  worldHex,
          purchase_sector: sector,
        })
        .select()
        .single()

      if (cargoErr) throw new Error(cargoErr.message)

      const { error: txnErr } = await supabase
        .from('transactions')
        .insert({
          campaign_id:     campaignId,
          player_id:       playerId,
          ship_id:         ship.value.id,
          tick,
          type:            'buy',
          trade_good_die:  good.trade_good_die,
          trade_good_name: good.trade_good_name,
          tons,
          price_per_ton:   good.purchase_price,
          total_cr:        -totalCost,
          world_hex:       worldHex,
          sector,
        })

      if (txnErr) throw new Error(txnErr.message)

      const credResult = await adjustCredits(-totalCost)
      if (!credResult.ok) throw new Error(credResult.error)

      cargo.value = [...cargo.value, cargoRow]
      return { ok: true }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── sellCargo ─────────────────────────────────────────────────────────────
  // Sell a cargo item at a destination world.  Removes the cargo row, credits
  // the ship's account, and writes a transaction + completed trade_record.

  async function sellCargo({ campaignId, cargoItem, sellPricePerTon, marketWorldHex, marketSector, tick, tradeRules }) {
    if (!ship.value) return { ok: false, error: 'No active ship' }
    if (!canTrade.value) return { ok: false, error: 'Not authorized to trade — check with your referee' }

    const totalRevenue = sellPricePerTon * cargoItem.tons
    const totalCost    = cargoItem.purchase_price * cargoItem.tons
    const netProfit    = totalRevenue - totalCost

    loading.value = true
    error.value   = null
    try {
      const { error: delErr } = await supabase
        .from('cargo')
        .delete()
        .eq('id', cargoItem.id)

      if (delErr) throw new Error(delErr.message)

      const { error: txnErr } = await supabase
        .from('transactions')
        .insert({
          campaign_id:     campaignId,
          player_id:       cargoItem.player_id,
          ship_id:         ship.value.id,
          tick,
          type:            'sell',
          trade_good_die:  cargoItem.trade_good_die,
          trade_good_name: cargoItem.trade_good_name,
          tons:            cargoItem.tons,
          price_per_ton:   sellPricePerTon,
          total_cr:        totalRevenue,
          world_hex:       marketWorldHex,
          sector:          marketSector,
        })

      if (txnErr) throw new Error(txnErr.message)

      const { error: trErr } = await supabase
        .from('trade_records')
        .insert({
          campaign_id:          campaignId,
          player_id:            cargoItem.player_id,
          ship_id:              ship.value.id,
          trade_rules:          tradeRules,
          trade_good_die:       cargoItem.trade_good_die,
          trade_good_name:      cargoItem.trade_good_name,
          tons:                 cargoItem.tons,
          source_world_hex:     cargoItem.purchase_world,
          source_sector:        cargoItem.purchase_sector,
          purchase_tick:        cargoItem.purchased_tick,
          buy_price_per_ton:    cargoItem.purchase_price,
          total_cost:           totalCost,
          market_world_hex:     marketWorldHex,
          market_sector:        marketSector,
          sell_tick:            tick,
          trade_price_per_ton:  sellPricePerTon,
          sell_price_per_ton:   sellPricePerTon,
          total_revenue:        totalRevenue,
          net_profit:           netProfit,
        })

      if (trErr) throw new Error(trErr.message)

      const credResult = await adjustCredits(totalRevenue)
      if (!credResult.ok) throw new Error(credResult.error)

      cargo.value = cargo.value.filter(c => c.id !== cargoItem.id)
      return { ok: true, netProfit }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  function clear() {
    ship.value    = null
    cargo.value   = []
    loading.value = false
    error.value   = null
  }

  return {
    ship, cargo, loading, error,
    hasShip, canTrade, cargoUsed, cargoCapacity, cargoAvailable,
    clearError, loadShip, createShip, updateLocation, adjustCredits,
    buyCargo, sellCargo, clear,
  }
})
