import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase.js'

export const useShipStore = defineStore('ship', () => {
  const ship          = ref(null)   // current ship record (or null if not aboard one)
  const cargo         = ref([])     // cargo rows currently in the hold
  const passengers    = ref([])     // passenger_manifests rows (in_transit)
  const mailContracts = ref([])     // mail_contracts rows (in_transit)
  const loading       = ref(false)
  const error         = ref(null)

  const hasShip        = computed(() => !!ship.value)
  const canTrade       = computed(() => ship.value?.can_trade ?? false)
  const cargoUsed      = computed(() => cargo.value.reduce((s, r) => s + r.tons, 0))
  const cargoCapacity  = computed(() => ship.value?.cargo_capacity ?? 0)
  const cargoAvailable = computed(() => cargoCapacity.value - cargoUsed.value)

  const stateroomsTotal     = computed(() => ship.value?.stateroom_capacity ?? 0)
  const stateroomsUsed      = computed(() =>
    passengers.value.filter(p => p.passage_type !== 'low').reduce((s, p) => s + p.count, 0))
  const stateroomsAvailable = computed(() => stateroomsTotal.value - stateroomsUsed.value)

  const lowBerthsTotal     = computed(() => ship.value?.low_berth_capacity ?? 0)
  const lowBerthsUsed      = computed(() =>
    passengers.value.filter(p => p.passage_type === 'low').reduce((s, p) => s + p.count, 0))
  const lowBerthsAvailable = computed(() => lowBerthsTotal.value - lowBerthsUsed.value)

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

      const [{ data: passengerRows, error: passErr }, { data: mailRows, error: mailErr }] =
        await Promise.all([
          supabase
            .from('passenger_manifests')
            .select('*')
            .eq('ship_id', s.id)
            .eq('campaign_id', campaignId)
            .eq('status', 'in_transit')
            .order('created_at', { ascending: true }),
          supabase
            .from('mail_contracts')
            .select('*')
            .eq('ship_id', s.id)
            .eq('campaign_id', campaignId)
            .eq('status', 'in_transit')
            .order('created_at', { ascending: true }),
        ])

      if (passErr) throw new Error(passErr.message)
      if (mailErr) throw new Error(mailErr.message)

      cargo.value         = cargoRows    ?? []
      passengers.value    = passengerRows ?? []
      mailContracts.value = mailRows      ?? []
      ship.value  = { ...s, crew_role: crewRows.role, can_trade: crewRows.can_trade }
    } catch (e) {
      error.value = e.message
      ship.value  = null
      cargo.value = []
      passengers.value    = []
      mailContracts.value = []
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
  // Updates ship location then auto-delivers any passengers/mail whose
  // destination matches the new world.

  async function updateLocation(worldHex, sector, { tick, campaignId, playerId } = {}) {
    if (!ship.value) return
    const { error: err } = await supabase
      .from('ships')
      .update({ current_world: worldHex, current_sector: sector })
      .eq('id', ship.value.id)

    if (!err) {
      ship.value = { ...ship.value, current_world: worldHex, current_sector: sector }
      if (tick != null && campaignId) {
        await deliverPassengers(worldHex, sector, tick, campaignId)
        await deliverMail(worldHex, sector, tick, campaignId, playerId)
      }
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

  async function buyCargo({ campaignId, playerId, good, tons, worldHex, worldName, sector, tick }) {
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
          purchase_world:      worldHex,
          purchase_world_name: worldName ?? '',
          purchase_sector:     sector,
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

  // ── bookPassengers ────────────────────────────────────────────────────────
  // Record a new passenger booking.  Debits the fare from ship credits and
  // writes a transaction entry for the ledger.  The fare is collected now
  // (pre-payment model) and reversed only if the referee issues a refund.

  async function bookPassengers({
    campaignId, playerId, passageType, count,
    embarkWorldHex, embarkSector, embarkWorldName,
    destWorldHex, destSector, destWorldName,
    farePerHead, fareTotal, tick,
  }) {
    if (!ship.value) return { ok: false, error: 'No active ship' }

    loading.value = true
    error.value   = null
    try {
      const { data: manifest, error: mErr } = await supabase
        .from('passenger_manifests')
        .insert({
          campaign_id:       campaignId,
          ship_id:           ship.value.id,
          player_id:         playerId,
          passage_type:      passageType,
          count,
          embark_world_hex:  embarkWorldHex,
          embark_sector:     embarkSector,
          embark_world_name: embarkWorldName ?? '',
          embark_tick:       tick,
          dest_world_hex:    destWorldHex,
          dest_sector:       destSector,
          dest_world_name:   destWorldName ?? '',
          fare_per_head:     farePerHead,
          fare_total:        fareTotal,
        })
        .select()
        .single()

      if (mErr) throw new Error(mErr.message)

      const { error: txnErr } = await supabase
        .from('transactions')
        .insert({
          campaign_id:  campaignId,
          player_id:    playerId,
          ship_id:      ship.value.id,
          tick,
          type:         'passenger_fare',
          total_cr:     fareTotal,
          world_hex:    embarkWorldHex,
          sector:       embarkSector,
          notes:        `${count}× ${passageType} → ${destWorldName || destWorldHex}`,
        })

      if (txnErr) throw new Error(txnErr.message)

      const credResult = await adjustCredits(fareTotal)
      if (!credResult.ok) throw new Error(credResult.error)

      passengers.value = [...passengers.value, manifest]
      return { ok: true }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── deliverPassengers ─────────────────────────────────────────────────────
  // Auto-called when ship location changes.  Marks any in_transit passengers
  // whose destination matches the new world as delivered.
  // No credit movement: fare was collected at embarkation.

  async function deliverPassengers(worldHex, sector, tick, campaignId) {
    const toDeliver = passengers.value.filter(
      p => p.dest_world_hex === worldHex && p.dest_sector === sector
    )
    if (!toDeliver.length) return

    const ids = toDeliver.map(p => p.id)
    const { error: err } = await supabase
      .from('passenger_manifests')
      .update({ status: 'delivered', resolve_tick: tick })
      .in('id', ids)
      .eq('campaign_id', campaignId)

    if (!err) {
      passengers.value = passengers.value.filter(p => !ids.includes(p.id))
    }
  }

  // ── refundPassenger ───────────────────────────────────────────────────────
  // Referee action: mark a passenger booking as refunded and reverse the fare.

  async function refundPassenger(manifestId, tick, campaignId, playerId) {
    const manifest = passengers.value.find(p => p.id === manifestId)
    if (!manifest) return { ok: false, error: 'Manifest not found' }

    loading.value = true
    error.value   = null
    try {
      const { error: mErr } = await supabase
        .from('passenger_manifests')
        .update({ status: 'refunded', resolve_tick: tick })
        .eq('id', manifestId)
        .eq('campaign_id', campaignId)

      if (mErr) throw new Error(mErr.message)

      const { error: txnErr } = await supabase
        .from('transactions')
        .insert({
          campaign_id: campaignId,
          player_id:   playerId,
          ship_id:     ship.value.id,
          tick,
          type:        'passenger_refund',
          total_cr:    -manifest.fare_total,
          world_hex:   manifest.embark_world_hex,
          sector:      manifest.embark_sector,
          notes:       `Refund: ${manifest.count}× ${manifest.passage_type}`,
        })

      if (txnErr) throw new Error(txnErr.message)

      const credResult = await adjustCredits(-manifest.fare_total)
      if (!credResult.ok) throw new Error(credResult.error)

      passengers.value = passengers.value.filter(p => p.id !== manifestId)
      return { ok: true }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── purchaseFuel ──────────────────────────────────────────────────────────
  // Record a fuel purchase.  Debits ship credits and writes a transaction.

  async function purchaseFuel({ campaignId, playerId, fuelType, tons, pricePerTon, worldHex, sector, tick }) {
    if (!ship.value) return { ok: false, error: 'No active ship' }

    const totalCost = Math.round(tons * pricePerTon)
    if ((ship.value.credits ?? 0) < totalCost)
      return { ok: false, error: 'Insufficient credits' }

    loading.value = true
    error.value   = null
    try {
      const { error: txnErr } = await supabase
        .from('transactions')
        .insert({
          campaign_id:  campaignId,
          player_id:    playerId,
          ship_id:      ship.value.id,
          tick,
          type:         'fuel',
          tons,
          price_per_ton: pricePerTon,
          total_cr:     -totalCost,
          world_hex:    worldHex,
          sector,
          notes:        `${fuelType} fuel`,
        })

      if (txnErr) throw new Error(txnErr.message)

      const credResult = await adjustCredits(-totalCost)
      if (!credResult.ok) throw new Error(credResult.error)

      return { ok: true, totalCost }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── acceptMailContract ────────────────────────────────────────────────────

  async function acceptMailContract({
    campaignId, playerId,
    originWorldHex, originSector, originWorldName,
    destWorldHex, destSector, destWorldName,
    parsecs, payment, tick,
  }) {
    if (!ship.value) return { ok: false, error: 'No active ship' }

    loading.value = true
    error.value   = null
    try {
      const { data: contract, error: cErr } = await supabase
        .from('mail_contracts')
        .insert({
          campaign_id:       campaignId,
          ship_id:           ship.value.id,
          player_id:         playerId,
          origin_world_hex:  originWorldHex,
          origin_sector:     originSector,
          origin_world_name: originWorldName ?? '',
          accept_tick:       tick,
          dest_world_hex:    destWorldHex,
          dest_sector:       destSector,
          dest_world_name:   destWorldName ?? '',
          parsecs,
          payment,
        })
        .select()
        .single()

      if (cErr) throw new Error(cErr.message)

      mailContracts.value = [...mailContracts.value, contract]
      return { ok: true }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── deliverMail ───────────────────────────────────────────────────────────
  // Auto-called when ship location changes.  Delivers matching mail contracts
  // and credits the payment.

  async function deliverMail(worldHex, sector, tick, campaignId, playerId) {
    const toDeliver = mailContracts.value.filter(
      m => m.dest_world_hex === worldHex && m.dest_sector === sector
    )
    if (!toDeliver.length) return

    for (const contract of toDeliver) {
      const { error: cErr } = await supabase
        .from('mail_contracts')
        .update({ status: 'delivered', resolve_tick: tick })
        .eq('id', contract.id)
        .eq('campaign_id', campaignId)

      if (cErr) continue

      await supabase.from('transactions').insert({
        campaign_id: campaignId,
        player_id:   playerId,
        ship_id:     ship.value.id,
        tick,
        type:        'mail',
        total_cr:    contract.payment,
        world_hex:   worldHex,
        sector,
        notes:       `Mail delivered from ${contract.origin_world_name || contract.origin_world_hex}`,
      })

      await adjustCredits(contract.payment)
    }

    const deliveredIds = toDeliver.map(m => m.id)
    mailContracts.value = mailContracts.value.filter(m => !deliveredIds.includes(m.id))
  }

  function clear() {
    ship.value          = null
    cargo.value         = []
    passengers.value    = []
    mailContracts.value = []
    loading.value       = false
    error.value         = null
  }

  return {
    ship, cargo, passengers, mailContracts, loading, error,
    hasShip, canTrade,
    cargoUsed, cargoCapacity, cargoAvailable,
    stateroomsTotal, stateroomsUsed, stateroomsAvailable,
    lowBerthsTotal, lowBerthsUsed, lowBerthsAvailable,
    clearError, loadShip, createShip, updateLocation, adjustCredits,
    buyCargo, sellCargo,
    bookPassengers, deliverPassengers, refundPassenger,
    purchaseFuel,
    acceptMailContract, deliverMail,
    clear,
  }
})
