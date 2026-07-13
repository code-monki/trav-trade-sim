import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../lib/api.js'
import { useTickStore } from './tick.js'
import { MGT2022_BASIC_PASSAGE_TONS } from '../lib/traveller-data-mgt2022.js'

export const useShipStore = defineStore('ship', () => {
  const ship          = ref(null)   // current ship record (or null if not aboard one)
  const cargo         = ref([])     // cargo rows currently in the hold
  const passengers    = ref([])     // passenger_manifests rows (in_transit)
  const mailContracts = ref([])     // mail_contracts rows (in_transit)
  const freight       = ref([])     // freight obligations rows (in_transit, MgT2022 only)
  const loading       = ref(false)
  const error         = ref(null)

  const hasShip        = computed(() => !!ship.value)
  const canTrade       = computed(() => ship.value?.can_trade ?? false)
  const cargoUsed      = computed(() => cargo.value.reduce((s, r) => s + r.tons, 0))
  const cargoCapacity  = computed(() => ship.value?.cargo_capacity ?? 0)
  // Basic Passage (MgT2022) consumes general cargo tonnage, not a dedicated
  // stateroom/berth — always 0 for CT7/T5 campaigns since 'basic' passage_type
  // never appears there.
  const basicPassageTonsUsed = computed(() =>
    passengers.value.filter(p => p.passage_type === 'basic')
      .reduce((s, p) => s + p.count * MGT2022_BASIC_PASSAGE_TONS, 0))
  const cargoAvailable = computed(() => cargoCapacity.value - cargoUsed.value - basicPassageTonsUsed.value)

  const stateroomsTotal     = computed(() => ship.value?.stateroom_capacity ?? 0)
  const crewStateroomsUsed  = computed(() => ship.value?.crew_staterooms ?? 0)
  const stateroomsUsed      = computed(() => {
    const passengerStaterooms = passengers.value
      .filter(p => p.passage_type !== 'low')
      .reduce((s, p) => s + p.count, 0)
    return crewStateroomsUsed.value + passengerStaterooms
  })
  const stateroomsAvailable = computed(() => stateroomsTotal.value - stateroomsUsed.value)

  const lowBerthsTotal     = computed(() => ship.value?.low_berth_capacity ?? 0)
  const lowBerthsUsed      = computed(() =>
    passengers.value.filter(p => p.passage_type === 'low').reduce((s, p) => s + p.count, 0))
  const lowBerthsAvailable = computed(() => lowBerthsTotal.value - lowBerthsUsed.value)

  function clearError() { error.value = null }

  // ── loadShip ──────────────────────────────────────────────────────────────
  // Single Worker call returns { ship, cargo, passengers, mailContracts }.

  async function loadShip(playerId, campaignId) {
    if (!playerId || !campaignId) return
    loading.value = true
    error.value   = null
    try {
      const { data, error: apiErr } = await api.get('/api/ships/current', {
        player_id: playerId, campaign_id: campaignId,
      })
      if (apiErr) throw new Error(apiErr)
      if (!data) {
        ship.value = null; cargo.value = []; passengers.value = []; mailContracts.value = []; freight.value = []
        return
      }
      ship.value          = data.ship
      cargo.value         = data.cargo ?? []
      passengers.value    = data.passengers ?? []
      mailContracts.value = data.mailContracts ?? []
      freight.value        = data.freight ?? []
    } catch (e) {
      error.value = e.message
      ship.value  = null; cargo.value = []; passengers.value = []; mailContracts.value = []; freight.value = []
    } finally {
      loading.value = false
    }
  }

  // ── createShip ────────────────────────────────────────────────────────────

  async function createShip({ campaignId, playerId, name, hullType, hullTons, cargoCapacity: cap, currentTick = 0 }) {
    loading.value = true
    error.value   = null
    try {
      const { data, error: apiErr } = await api.post('/api/ships', {
        campaign_id:    campaignId,
        player_id:      playerId,
        name,
        hull_type:      hullType   ?? null,
        hull_tons:      hullTons   ?? 200,
        cargo_capacity: cap        ?? 80,
        current_tick:   currentTick,
      })
      if (apiErr) throw new Error(apiErr)
      cargo.value = []
      ship.value  = data
      return { ok: true, ship: ship.value }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── updateLocation ────────────────────────────────────────────────────────
  // Updates ship location, optionally deducts fuel, then auto-delivers any
  // passengers/mail whose destination matches the new world.

  async function updateLocation(worldHex, sector, { tick, campaignId, playerId, fuelCost = 0 } = {}) {
    if (!ship.value) return { ok: false, error: 'No active ship' }

    const patchBody = { current_world: worldHex, current_sector: sector }

    // Deduct fuel only when the ship has a capacity set (0 = fuel not tracked)
    if (fuelCost > 0 && (ship.value.fuel_capacity ?? 0) > 0) {
      const available = ship.value.fuel_current ?? 0
      if (available < fuelCost) {
        return { ok: false, error: `Insufficient fuel: need ${fuelCost}t, have ${available}t` }
      }
      patchBody.fuel_current = available - fuelCost
    }

    const { error: err } = await api.patch(`/api/ships/${ship.value.id}`, patchBody)
    if (err) return { ok: false, error: err }

    ship.value = {
      ...ship.value,
      current_world:  worldHex,
      current_sector: sector,
      ...(patchBody.fuel_current !== undefined ? { fuel_current: patchBody.fuel_current } : {}),
    }

    if (tick != null && campaignId && playerId) {
      await autoDeliver(ship.value.id, worldHex, sector, tick, campaignId, playerId)
    }

    return { ok: true }
  }

  // ── autoDeliver ───────────────────────────────────────────────────────────
  // Deliver matching passengers and mail when the ship arrives at a world.

  async function autoDeliver(shipId, worldHex, sector, tick, campaignId, playerId) {
    const passengerIds = passengers.value
      .filter(p => p.dest_world_hex === worldHex && p.dest_sector === sector)
      .map(p => p.id)

    const mailToDeliver = mailContracts.value.filter(
      m => m.dest_world_hex === worldHex && m.dest_sector === sector
    )

    const freightToDeliver = freight.value.filter(
      f => f.dest_world_hex === worldHex && f.dest_sector === sector
    )

    const tasks = []

    if (passengerIds.length) {
      tasks.push(
        api.post(`/api/ships/${shipId}/deliver-passengers`, {
          ids: passengerIds, tick, campaign_id: campaignId,
        }).then(() => {
          passengers.value = passengers.value.filter(p => !passengerIds.includes(p.id))
        })
      )
    }

    if (mailToDeliver.length) {
      tasks.push(
        api.post(`/api/ships/${shipId}/deliver-mail`, {
          contracts: mailToDeliver, world_hex: worldHex, sector,
          tick, campaign_id: campaignId, player_id: playerId,
        }).then(({ data }) => {
          const deliveredIds = mailToDeliver.map(m => m.id)
          mailContracts.value = mailContracts.value.filter(m => !deliveredIds.includes(m.id))
          if (data && ship.value) {
            const totalPayment = mailToDeliver.reduce((s, m) => s + m.payment, 0)
            ship.value = { ...ship.value, credits: (ship.value.credits ?? 0) + totalPayment }
          }
        })
      )
    }

    if (freightToDeliver.length) {
      tasks.push(
        api.post(`/api/ships/${shipId}/deliver-freight`, {
          lots: freightToDeliver, world_hex: worldHex, sector,
          tick, campaign_id: campaignId, player_id: playerId,
        }).then(({ data }) => {
          const deliveredIds = freightToDeliver.map(f => f.id)
          freight.value = freight.value.filter(f => !deliveredIds.includes(f.id))
          // Freight was already credited at booking time; only a late-delivery
          // clawback (if any) still needs to be reflected here.
          if (data?.clawback > 0 && ship.value) {
            ship.value = { ...ship.value, credits: (ship.value.credits ?? 0) - data.clawback }
          }
        })
      )
    }

    await Promise.all(tasks)
  }

  // ── buyCargo ──────────────────────────────────────────────────────────────

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
      const { data, error: apiErr } = await api.post(`/api/ships/${ship.value.id}/buy-cargo`, {
        campaign_id: campaignId,
        player_id:   playerId,
        good, tons,
        world_hex:   worldHex,
        world_name:  worldName ?? '',
        sector, tick,
      })
      if (apiErr) throw new Error(apiErr)

      cargo.value = [...cargo.value, data]
      ship.value  = { ...ship.value, credits: (ship.value.credits ?? 0) - totalCost }

      // Decrement the cached snapshot so the market table reflects the purchase immediately
      const tickStore = useTickStore()
      const cached = tickStore.worldSnapshots[good.trade_good_die]
      if (cached) cached.qty_available = Math.max(0, (cached.qty_available ?? 0) - tons)

      return { ok: true }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── sellCargo ─────────────────────────────────────────────────────────────

  async function sellCargo({ campaignId, cargoItem, sellPricePerTon, marketWorldHex, marketSector, tick, tradeRules }) {
    if (!ship.value) return { ok: false, error: 'No active ship' }
    if (!canTrade.value) return { ok: false, error: 'Not authorized to trade — check with your referee' }

    const totalRevenue = sellPricePerTon * cargoItem.tons

    loading.value = true
    error.value   = null
    try {
      const { data, error: apiErr } = await api.post(`/api/ships/${ship.value.id}/sell-cargo`, {
        campaign_id:        campaignId,
        cargo_item:         cargoItem,
        sell_price_per_ton: sellPricePerTon,
        market_world_hex:   marketWorldHex,
        market_sector:      marketSector,
        tick,
        trade_rules:        tradeRules,
      })
      if (apiErr) throw new Error(apiErr)

      cargo.value = cargo.value.filter(c => c.id !== cargoItem.id)
      ship.value  = { ...ship.value, credits: (ship.value.credits ?? 0) + totalRevenue }
      return { ok: true, netProfit: data.net_profit }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── bookPassengers ────────────────────────────────────────────────────────

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
      const { data, error: apiErr } = await api.post(`/api/ships/${ship.value.id}/book-passengers`, {
        campaign_id:       campaignId,
        player_id:         playerId,
        passage_type:      passageType,
        count,
        embark_world_hex:  embarkWorldHex,
        embark_sector:     embarkSector,
        embark_world_name: embarkWorldName ?? '',
        dest_world_hex:    destWorldHex,
        dest_sector:       destSector,
        dest_world_name:   destWorldName ?? '',
        fare_per_head:     farePerHead,
        fare_total:        fareTotal,
        tick,
      })
      if (apiErr) throw new Error(apiErr)

      passengers.value = [...passengers.value, data]
      ship.value = { ...ship.value, credits: (ship.value.credits ?? 0) + fareTotal }
      return { ok: true }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── refundPassenger ───────────────────────────────────────────────────────

  async function refundPassenger(manifestId, tick, campaignId, playerId) {
    const manifest = passengers.value.find(p => p.id === manifestId)
    if (!manifest) return { ok: false, error: 'Manifest not found' }

    loading.value = true
    error.value   = null
    try {
      const { error: apiErr } = await api.post(`/api/ships/${ship.value.id}/refund-passenger`, {
        manifest_id: manifestId, tick, campaign_id: campaignId, player_id: playerId,
      })
      if (apiErr) throw new Error(apiErr)

      passengers.value = passengers.value.filter(p => p.id !== manifestId)
      ship.value = { ...ship.value, credits: (ship.value.credits ?? 0) - manifest.fare_total }
      return { ok: true }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── purchaseFuel ──────────────────────────────────────────────────────────

  async function purchaseFuel({ campaignId, playerId, fuelType, tons, pricePerTon, worldHex, sector, tick }) {
    if (!ship.value) return { ok: false, error: 'No active ship' }

    const fuelCapacity = ship.value.fuel_capacity ?? 0
    const fuelCurrent  = ship.value.fuel_current  ?? 0
    const tankSpace    = fuelCapacity - fuelCurrent
    if (fuelCapacity > 0 && tons > tankSpace)
      return { ok: false, error: `Tank can only hold ${tankSpace}t more fuel (capacity ${fuelCapacity}t)` }

    const totalCost = Math.round(tons * pricePerTon)
    if ((ship.value.credits ?? 0) < totalCost)
      return { ok: false, error: 'Insufficient credits' }

    loading.value = true
    error.value   = null
    try {
      const { data, error: apiErr } = await api.post(`/api/ships/${ship.value.id}/purchase-fuel`, {
        campaign_id:   campaignId,
        player_id:     playerId,
        fuel_type:     fuelType,
        tons,
        price_per_ton: pricePerTon,
        world_hex:     worldHex,
        sector, tick,
      })
      if (apiErr) throw new Error(apiErr)

      ship.value = { ...ship.value, credits: data.credits, fuel_current: data.fuel_current }
      return { ok: true, totalCost: data.total_cost }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── payDebt ────────────────────────────────────────────────────────────────

  async function payDebt({ campaignId, debtId, amount, tick }) {
    if (!ship.value) return { ok: false, error: 'No active ship' }
    if (!(amount > 0)) return { ok: false, error: 'Enter a payment amount' }
    if (amount > (ship.value.credits ?? 0)) return { ok: false, error: 'Insufficient credits' }

    loading.value = true
    error.value   = null
    try {
      const { data, error: apiErr } = await api.post(`/api/ships/${ship.value.id}/pay-debt`, {
        campaign_id: campaignId,
        debt_id:     debtId,
        amount, tick,
      })
      if (apiErr) throw new Error(apiErr)

      ship.value = { ...ship.value, credits: data.credits }
      return { ok: true, debt: data.debt }
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
      const { data, error: apiErr } = await api.post(`/api/ships/${ship.value.id}/accept-mail`, {
        campaign_id:       campaignId,
        player_id:         playerId,
        origin_world_hex:  originWorldHex,
        origin_sector:     originSector,
        origin_world_name: originWorldName ?? '',
        dest_world_hex:    destWorldHex,
        dest_sector:       destSector,
        dest_world_name:   destWorldName ?? '',
        parsecs, payment, tick,
      })
      if (apiErr) throw new Error(apiErr)
      mailContracts.value = [...mailContracts.value, data]
      return { ok: true }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── bookFreight ───────────────────────────────────────────────────────────
  // MgT2022 only. Charged upfront, same as passenger fares.

  async function bookFreight({
    campaignId, playerId,
    originWorldHex, originSector, originWorldName,
    destWorldHex, destSector, destWorldName,
    parsecs, freightTons, freightLotSize, ratePerTon, charge, dueTick, tick,
  }) {
    if (!ship.value) return { ok: false, error: 'No active ship' }

    loading.value = true
    error.value   = null
    try {
      const { data, error: apiErr } = await api.post(`/api/ships/${ship.value.id}/book-freight`, {
        campaign_id:       campaignId,
        player_id:         playerId,
        origin_world_hex:  originWorldHex,
        origin_sector:     originSector,
        origin_world_name: originWorldName ?? '',
        dest_world_hex:    destWorldHex,
        dest_sector:       destSector,
        dest_world_name:   destWorldName ?? '',
        parsecs,
        freight_tons:      freightTons,
        freight_lot_size:  freightLotSize,
        rate_per_ton:      ratePerTon,
        charge,
        due_tick:          dueTick,
        tick,
      })
      if (apiErr) throw new Error(apiErr)

      freight.value = [...freight.value, data]
      ship.value = { ...ship.value, credits: (ship.value.credits ?? 0) + charge }
      return { ok: true }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── refundFreight ─────────────────────────────────────────────────────────

  async function refundFreight(obligationId, tick, campaignId, playerId) {
    const obligation = freight.value.find(f => f.id === obligationId)
    if (!obligation) return { ok: false, error: 'Freight contract not found' }

    loading.value = true
    error.value   = null
    try {
      const { error: apiErr } = await api.post(`/api/ships/${ship.value.id}/refund-freight`, {
        obligation_id: obligationId, tick, campaign_id: campaignId, player_id: playerId,
      })
      if (apiErr) throw new Error(apiErr)

      freight.value = freight.value.filter(f => f.id !== obligationId)
      ship.value = { ...ship.value, credits: (ship.value.credits ?? 0) - obligation.charge }
      return { ok: true }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  function clear() {
    ship.value          = null
    cargo.value         = []
    passengers.value    = []
    mailContracts.value = []
    freight.value       = []
    loading.value       = false
    error.value         = null
  }

  return {
    ship, cargo, passengers, mailContracts, freight, loading, error,
    hasShip, canTrade,
    cargoUsed, cargoCapacity, cargoAvailable, basicPassageTonsUsed,
    stateroomsTotal, crewStateroomsUsed, stateroomsUsed, stateroomsAvailable,
    lowBerthsTotal, lowBerthsUsed, lowBerthsAvailable,
    clearError, loadShip, createShip, updateLocation,
    buyCargo, sellCargo,
    bookPassengers, refundPassenger,
    purchaseFuel,
    payDebt,
    acceptMailContract,
    bookFreight, refundFreight,
    clear,
  }
})
