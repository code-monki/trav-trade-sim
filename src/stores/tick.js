import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../lib/api.js'
import { useAuthStore } from './auth.js'
import { useShipStore } from './ship.js'
import {
  generateWorldSnapshot, tickToCalendar, formatImperialDate,
  TICKS_PER_YEAR, TICKS_PER_MONTH, shouldRollupMonth, shouldRollupYear,
  mgt2022PlayerGoodPrice, ct7PlayerSalePrice,
} from '../lib/market-tick.js'
import { maybeGenerateEvent, activeEventsForWorld } from '../lib/market-events.js'
import { generateTrafficSnapshot } from '../lib/traffic-tick.js'
import { generateCT7TrafficSnapshot } from '../lib/ct7-traffic-tick.js'

export const useTickStore = defineStore('tick', () => {
  const auth = useAuthStore()
  const ship = useShipStore()

  // ── State ──────────────────────────────────────────────────────────────────
  const currentTick   = ref(0)
  const currentYear   = ref(1105)
  const currentDay    = ref(1)
  const currentMonth  = ref(1)
  const loading       = ref(false)
  const error         = ref(null)

  // Cached snapshots for the currently viewed world: goodDie → snapshot row
  const worldSnapshots   = ref({})
  const snapshotWorldKey = ref('')   // '{campaignId}:{worldHex}:{sector}:{tick}'
  // Full world object/sector behind the worldSnapshots cache above — needed
  // by displaySnapshots' per-player recompute (Phase 4), which requires
  // world.UWP/Remarks/Zone without every caller having to re-pass them.
  const snapshotWorld  = ref(null)
  const snapshotSector = ref('')

  // Current player's own Broker skill level (CT7/MgT2022 per-player pricing,
  // Phase 4) — loaded once per world selection, not push-updated live.
  const brokerSkill = ref(0)

  // Active events for current campaign (loaded once per session / tick advance)
  const activeEvents = ref([])

  // All referee-created (manual) events for the Referee's events grid —
  // independent of activeEvents, which drives live pricing and always
  // includes auto-generated events too.
  const allEvents = ref([])

  // Full event history for the currently viewed world (active + expired)
  const worldEventHistory = ref([])

  // Referee-authored event_definitions for this campaign — joins the
  // built-in catalogue's pool in maybeGenerateEvent. Loaded once per
  // session (see loadCustomEventDefinitions) so a whole backfill run uses
  // one consistent snapshot of the pool rather than refetching per tick.
  const customEventDefinitions       = ref([])
  const customEventDefinitionsLoaded = ref(false)

  // MgT2022-only: current tick's passenger/freight/mail traffic-availability
  // counts for the currently viewed world. Always null for CT7/T5 campaigns.
  const trafficAvailability = ref(null)

  // ── Computed ───────────────────────────────────────────────────────────────
  const imperialDate = computed(() => formatImperialDate(currentTick.value))

  // Per-player pricing (Phase 4): for CT7/MgT2022, overlays worldSnapshots
  // with each good's price recomputed for the current player's own Broker
  // skill (MgT2022: both purchase and sale; CT7: sale only, per RAW — see
  // mgt2022PlayerGoodPrice/ct7PlayerSalePrice in market-tick.js). T5 and any
  // uncached state pass worldSnapshots through unchanged. This is the read
  // site every display/transaction consumer should use instead of
  // worldSnapshots directly, so a player's own skill actually changes the
  // price they see and pay.
  const displaySnapshots = computed(() => {
    const rules = auth.campaign?.trade_rules
    if (!snapshotWorld.value || (rules !== 'MgT2022' && rules !== 'CT7')) {
      return worldSnapshots.value
    }

    const world      = snapshotWorld.value
    const campaignId = auth.campaign.id
    const eventsForWorld = activeEventsForWorld(
      activeEvents.value, world.Hex, currentTick.value, snapshotSector.value,
    )

    const out = {}
    for (const [die, row] of Object.entries(worldSnapshots.value)) {
      if (rules === 'MgT2022') {
        const priced = mgt2022PlayerGoodPrice({
          campaignId, world, tick: currentTick.value, goodDie: die,
          activeEvents: eventsForWorld, brokerSkill: brokerSkill.value,
        })
        out[die] = priced
          ? { ...row, purchase_price: priced.purchasePrice, sale_price: priced.salePrice }
          : row
      } else { // CT7
        const salePrice = ct7PlayerSalePrice({
          campaignId, world, tick: currentTick.value, goodDie: die,
          activeEvents: eventsForWorld, brokerSkill: brokerSkill.value,
        })
        out[die] = salePrice != null ? { ...row, sale_price: salePrice } : row
      }
    }
    return out
  })

  // Per-player pricing overlay for the black-market row set — same
  // per-player Broker recompute as displaySnapshots above, just sourced
  // from blackMarketSnapshots instead of worldSnapshots. MgT2022-only,
  // since black market itself is MgT2022-only (see the Black Market
  // section below).
  const displayBlackMarketSnapshots = computed(() => {
    if (!snapshotWorld.value || auth.campaign?.trade_rules !== 'MgT2022') {
      return blackMarketSnapshots.value
    }

    const world      = snapshotWorld.value
    const campaignId = auth.campaign.id
    const eventsForWorld = activeEventsForWorld(
      activeEvents.value, world.Hex, currentTick.value, snapshotSector.value,
    )

    const out = {}
    for (const [die, row] of Object.entries(blackMarketSnapshots.value)) {
      const priced = mgt2022PlayerGoodPrice({
        campaignId, world, tick: currentTick.value, goodDie: die,
        activeEvents: eventsForWorld, brokerSkill: brokerSkill.value,
      })
      out[die] = priced
        ? { ...row, purchase_price: priced.purchasePrice, sale_price: priced.salePrice }
        : row
    }
    return out
  })

  // ── Broker skill (CT7/MgT2022 per-player pricing) ───────────────────────────

  async function loadBrokerSkill() {
    const campaignId = auth.campaign?.id
    if (!campaignId || !auth.player?.id) { brokerSkill.value = 0; return }
    const { data } = await api.get('/api/reports/skills', {
      campaign_id: campaignId, player_id: auth.player.id,
    })
    brokerSkill.value = (data ?? []).find(s => s.skill === 'Broker')?.level ?? 0
  }

  // ── Calendar ───────────────────────────────────────────────────────────────

  async function loadCalendar() {
    const campaignId = auth.campaign?.id
    if (!campaignId) return

    const { data, error: err } = await api.get(`/api/campaigns/${campaignId}/calendar`)
    if (err) { error.value = err; return }

    currentTick.value  = data.current_tick
    currentYear.value  = data.year
    currentDay.value   = data.day
    currentMonth.value = tickToCalendar(data.current_tick).month
  }

  // ── Tick advancement (referee only) ────────────────────────────────────────

  async function advanceTick() {
    if (!auth.isReferee) {
      error.value = 'Only the Referee can advance the tick.'
      return { ok: false }
    }

    loading.value = true
    error.value   = null
    try {
      const { data, error: apiErr } = await api.post(`/api/campaigns/${auth.campaign.id}/advance-tick`, {})
      if (apiErr) throw new Error(apiErr)

      currentTick.value  = data.tick
      currentYear.value  = data.year
      currentDay.value   = data.day
      currentMonth.value = data.month

      // Invalidate snapshot cache — prices change each tick
      worldSnapshots.value   = {}
      snapshotWorldKey.value = ''
      snapshotWorld.value    = null
      snapshotSector.value   = ''
      trafficAvailability.value = null

      await loadActiveEvents()
      await loadCustomEventDefinitions()
      return { ok: true, tick: data.tick }
    } catch (e) {
      error.value = e.message
      return { ok: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  // ── Market events ──────────────────────────────────────────────────────────

  async function loadActiveEvents() {
    const campaignId = auth.campaign?.id
    if (!campaignId) return

    const { data } = await api.get(`/api/campaigns/${campaignId}/events`, {
      active:       true,
      current_tick: currentTick.value,
    })
    activeEvents.value = data ?? []
  }

  // Referee events grid — all manual events for this campaign, regardless
  // of active/expired status.
  async function loadAllEvents(campaignId) {
    if (!campaignId) return

    const { data } = await api.get(`/api/campaigns/${campaignId}/events`, {
      source: 'manual',
    })
    allEvents.value = data ?? []
  }

  async function loadCustomEventDefinitions() {
    const campaignId = auth.campaign?.id
    if (!campaignId) return

    const { data } = await api.get(`/api/campaigns/${campaignId}/event-definitions`)
    customEventDefinitions.value       = data ?? []
    customEventDefinitionsLoaded.value = true
  }

  // Rolls (and inserts, if not already present) the deterministic event for
  // one world at one specific tick — current or historical (backfill).
  // Returns the event row if one fired, else null.
  async function maybeInsertEvent(world, sectorName, tick) {
    const campaignId = auth.campaign?.id
    if (!campaignId) return null

    if (!customEventDefinitionsLoaded.value) await loadCustomEventDefinitions()

    const ev = maybeGenerateEvent({
      world, sectorName, campaignId, tick,
      customDefinitions: customEventDefinitions.value,
    })
    if (!ev) return null

    // Check for an existing event at the same (campaign, tick, world_hex) first
    const { data: dupCheck, error: dupErr } = await api.post(`/api/campaigns/${campaignId}/events`, {
      ...ev, check_duplicate: true,
    })
    if (dupErr) throw new Error(dupErr)
    if (dupCheck?.count > 0) return ev

    const { data: inserted, error: insErr } = await api.post(`/api/campaigns/${campaignId}/events`, ev)
    if (insErr) throw new Error(insErr)
    return inserted ?? ev
  }

  // ── World snapshot ─────────────────────────────────────────────────────────

  async function ensureWorldSnapshot(world, sectorName) {
    const campaignId = auth.campaign?.id
    if (!campaignId) return []

    const cacheKey = `${campaignId}:${world.Hex}:${sectorName}:${currentTick.value}`
    if (snapshotWorldKey.value === cacheKey && Object.keys(worldSnapshots.value).length > 0) {
      return Object.values(worldSnapshots.value)
    }

    loading.value = true
    error.value   = null
    try {
      // Check if snapshots already exist
      const { data: countData } = await api.get(`/api/campaigns/${campaignId}/snapshots`, {
        count:     true,
        world_hex: world.Hex,
        sector:    sectorName,
        tick:      currentTick.value,
      })

      if (!(countData?.count > 0)) {
        // Maybe fire a market event first (affects prices below), then
        // refresh the cached active-events list so this tick's own price
        // generation sees it.
        await maybeInsertEvent(world, sectorName, currentTick.value)
        await loadActiveEvents()

        // Fill any gap since this world was last snapshotted — not just its
        // very first visit. Deterministic seeding means replaying skipped
        // ticks (events + prices) reproduces exactly what would have
        // happened, however long ago the gap started.
        const { data: lastTickData } = await api.get(`/api/campaigns/${campaignId}/snapshots/last-tick`, {
          world_hex: world.Hex,
          sector:    sectorName,
        })

        const yearStartTick = Math.floor(currentTick.value / TICKS_PER_YEAR) * TICKS_PER_YEAR
        const lastTick       = lastTickData?.lastTick
        const backfillStart  = Math.max(yearStartTick, lastTick == null ? yearStartTick : lastTick + 1)

        if (backfillStart < currentTick.value) {
          // Seed the local event pool with this world's known history
          // (local + subsector events) so backfilled ticks correctly see
          // events that started before the gap.
          const { data: knownEvents } = await api.get(`/api/campaigns/${campaignId}/events`, {
            world_hex: world.Hex,
            sector:    sectorName,
          })
          let eventPool = knownEvents ?? []

          const backfillRows      = []
          const boundariesToRepair = []

          for (let t = backfillStart; t < currentTick.value; t++) {
            const newEvent = await maybeInsertEvent(world, sectorName, t)
            if (newEvent && !eventPool.some(e => e.tick === newEvent.tick && e.world_hex === newEvent.world_hex && e.description === newEvent.description)) {
              eventPool = [...eventPool, newEvent]
            }

            const activeAtT = activeEventsForWorld(eventPool, world.Hex, t, sectorName)
            backfillRows.push(...generateWorldSnapshot({
              world, sectorName, campaignId, tick: t, activeEvents: activeAtT,
              tradeRules: auth.campaign?.trade_rules,
            }))

            if (shouldRollupMonth(t) || shouldRollupYear(t)) boundariesToRepair.push(t)
          }

          if (backfillRows.length) {
            const { error: backfillErr } = await api.post(`/api/campaigns/${campaignId}/snapshots`, { rows: backfillRows })
            if (backfillErr) throw new Error(backfillErr)
          }
          for (const t of boundariesToRepair) {
            const { error: repairErr } = await api.post(`/api/campaigns/${campaignId}/rollup-repair`, { tick: t })
            if (repairErr) throw new Error(repairErr)
          }
        }

        const eventsForWorld = activeEventsForWorld(
          activeEvents.value, world.Hex, currentTick.value, sectorName,
        )

        const rows = generateWorldSnapshot({
          world, sectorName, campaignId,
          tick:         currentTick.value,
          activeEvents: eventsForWorld,
          tradeRules:   auth.campaign?.trade_rules,
        })

        const { error: insertErr } = await api.post(`/api/campaigns/${campaignId}/snapshots`, { rows })
        if (insertErr) throw new Error(insertErr)

        const cache = {}
        for (const row of rows) cache[row.trade_good_die] = row
        worldSnapshots.value   = cache
        snapshotWorldKey.value = cacheKey
        snapshotWorld.value    = world
        snapshotSector.value   = sectorName
        return rows
      }

      // Load from D1
      const { data, error: fetchErr } = await api.get(`/api/campaigns/${campaignId}/snapshots`, {
        world_hex: world.Hex,
        sector:    sectorName,
        tick:      currentTick.value,
      })
      if (fetchErr) throw new Error(fetchErr)

      const cache = {}
      for (const row of data ?? []) cache[row.trade_good_die] = row
      worldSnapshots.value   = cache
      snapshotWorldKey.value = cacheKey
      snapshotWorld.value    = world
      snapshotSector.value   = sectorName
      return data ?? []
    } catch (e) {
      error.value = e.message
      return []
    } finally {
      loading.value = false
    }
  }

  // ── Traffic availability (MgT2022 only) ───────────────────────────────────

  // Deterministically generates this tick's passenger/freight/mail traffic
  // snapshot for a ship, for a specific origin→destination route, and
  // persists it (idempotent — INSERT OR IGNORE, and regeneration from the
  // same seed always produces the same row, so a race between two clients
  // is harmless). No-op for CT7/T5 campaigns or when the player has no ship
  // (traffic DMs depend on crew skills, so there's nothing to compute
  // without one). Per RAW, there's no ambient "how many passengers,
  // independent of destination" number — this is only ever called once a
  // booking form's destination is known, never on world visit alone.
  async function ensureTrafficSnapshot(world, sectorName, destWorld, destSectorName, parsecs) {
    const campaignId = auth.campaign?.id
    const rules       = auth.campaign?.trade_rules
    if (!campaignId || (rules !== 'MgT2022' && rules !== 'CT7') || !ship.hasShip || !destWorld?.Hex) {
      trafficAvailability.value = null
      return null
    }

    const row = rules === 'MgT2022'
      ? generateTrafficSnapshot({
          world, sectorName, destWorld, destSectorName, parsecs, campaignId, tick: currentTick.value,
          shipId: ship.ship.id,
          crewStewardMax:        ship.crewStewardMax,
          crewPassengerCheckMax: ship.crewPassengerCheckMax,
          crewFreightCheckMax:   ship.crewFreightCheckMax,
          crewNavalScoutRankMax: ship.crewNavalScoutRankMax,
          crewSocialStandingMax: ship.crewSocialStandingMax,
          shipArmed:             ship.shipArmed,
        })
      : generateCT7TrafficSnapshot({
          world, sectorName, destWorld, destSectorName, campaignId, tick: currentTick.value,
          shipId: ship.ship.id,
          crewStewardMax:    ship.crewStewardMax,
          crewAdminMax:      ship.crewAdminMax,
          crewStreetwiseMax: ship.crewStreetwiseMax,
          crewLiaisonMax:    ship.crewLiaisonMax,
        })
    await api.post(`/api/campaigns/${campaignId}/traffic`, row)
    trafficAvailability.value = row
    return row
  }

  // ── Black Market (MgT2022) ──────────────────────────────────────────────────
  // Ship-wide (not per-player, unlike Find a Supplier) — whichever crew
  // member has the highest Streetwise skill is used automatically, server-
  // side. Success unlocks the black-market composition for the whole
  // ship's crew for the rest of the game-month.

  const blackMarketFound    = ref(false)
  const blackMarketAttempts = ref(0)

  async function loadBlackMarketStatus(worldHex, sectorName) {
    const campaignId = auth.campaign?.id
    if (!campaignId || !ship.hasShip) return
    const { data } = await api.get(`/api/campaigns/${campaignId}/black-market`, {
      ship_id: ship.ship.id, world_hex: worldHex, sector: sectorName,
      month_key: Math.floor(currentTick.value / TICKS_PER_MONTH),
    })
    blackMarketFound.value    = !!data?.succeeded
    blackMarketAttempts.value = data?.attempts ?? 0
  }

  // @param {number} opts.starportDM — from starportBrokerDM(starportFromUWP(world.UWP))
  async function attemptBlackMarket(worldHex, sectorName, { starportDM = 0 } = {}) {
    const campaignId = auth.campaign?.id
    if (!campaignId || !ship.hasShip) return { success: false }

    const { data, error: apiErr } = await api.post(`/api/campaigns/${campaignId}/black-market`, {
      ship_id:     ship.ship.id,
      world_hex:   worldHex,
      sector:      sectorName,
      month_key:   Math.floor(currentTick.value / TICKS_PER_MONTH),
      starport_dm: starportDM,
    })
    if (apiErr) { error.value = apiErr; return { success: false } }

    blackMarketFound.value    = !!data.success
    blackMarketAttempts.value = data.attempts ?? blackMarketAttempts.value + 1
    return data
  }

  // Black-market goods composition — a second, parallel snapshot for the
  // SAME world/tick as the normal market (goods pricing isn't ship-
  // dependent, only whether a given ship has found access to it). Cached
  // separately from worldSnapshots so switching the Market tab's toggle
  // doesn't need to re-fetch.
  const blackMarketSnapshots = ref({})

  async function ensureBlackMarketSnapshot(world, sectorName) {
    const campaignId = auth.campaign?.id
    if (!campaignId || auth.campaign?.trade_rules !== 'MgT2022' || !blackMarketFound.value) {
      blackMarketSnapshots.value = {}
      return []
    }

    const { data: countData } = await api.get(`/api/campaigns/${campaignId}/snapshots`, {
      count: true, world_hex: world.Hex, sector: sectorName, tick: currentTick.value, is_black_market: true,
    })

    if (countData?.count > 0) {
      const { data } = await api.get(`/api/campaigns/${campaignId}/snapshots`, {
        world_hex: world.Hex, sector: sectorName, tick: currentTick.value, is_black_market: true,
      })
      const cache = {}
      for (const row of data ?? []) cache[row.trade_good_die] = row
      blackMarketSnapshots.value = cache
      return data ?? []
    }

    const eventsForWorld = activeEventsForWorld(activeEvents.value, world.Hex, currentTick.value, sectorName)
    const rows = generateWorldSnapshot({
      world, sectorName, campaignId,
      tick: currentTick.value, activeEvents: eventsForWorld,
      tradeRules: auth.campaign?.trade_rules, seekingBlackMarket: true,
    }).map(row => ({ ...row, is_black_market: true }))

    await api.post(`/api/campaigns/${campaignId}/snapshots`, { rows })
    const cache = {}
    for (const row of rows) cache[row.trade_good_die] = row
    blackMarketSnapshots.value = cache
    return rows
  }

  // ── Price history ──────────────────────────────────────────────────────────

  async function loadWeeklyHistory(worldHex, sectorName, goodDie, limit = 52) {
    const campaignId = auth.campaign?.id
    if (!campaignId) return []

    const { data, error: err } = await api.get(`/api/campaigns/${campaignId}/market/weekly`, {
      world_hex: worldHex, sector: sectorName, good_die: goodDie, limit,
    })
    if (err) { error.value = err; return [] }
    return data ?? []
  }

  async function loadMonthlyHistory(worldHex, sectorName, goodDie, limit = 24) {
    const campaignId = auth.campaign?.id
    if (!campaignId) return []

    const { data, error: err } = await api.get(`/api/campaigns/${campaignId}/market/monthly`, {
      world_hex: worldHex, sector: sectorName, good_die: goodDie, limit,
    })
    if (err) { error.value = err; return [] }
    return data ?? []
  }

  async function loadAnnualHistory(worldHex, sectorName, goodDie) {
    const campaignId = auth.campaign?.id
    if (!campaignId) return []

    const { data, error: err } = await api.get(`/api/campaigns/${campaignId}/market/annual`, {
      world_hex: worldHex, sector: sectorName, good_die: goodDie,
    })
    if (err) { error.value = err; return [] }
    return data ?? []
  }

  // ── Active events for display ──────────────────────────────────────────────

  function eventsForWorld(worldHex, sectorName) {
    return activeEventsForWorld(activeEvents.value, worldHex, currentTick.value, sectorName)
  }

  // ── World event history (active + expired) ─────────────────────────────────

  async function loadWorldEventHistory(worldHex, sectorName) {
    const campaignId = auth.campaign?.id
    if (!campaignId) return []

    const { data, error: err } = await api.get(`/api/campaigns/${campaignId}/events`, {
      world_hex: worldHex, sector: sectorName,
    })
    if (err) { error.value = err; return [] }
    worldEventHistory.value = data ?? []
    return data ?? []
  }

  // ── Find a Supplier (MgT2022) ───────────────────────────────────────────────
  // Character-based, one-click check gating whether the current player can
  // see a world's market this (game) month — not an ambient world property.
  // Deliberately per-world/month, not per-tick: once found, a supplier
  // relationship persists for the rest of that month rather than needing a
  // fresh roll every tick.

  const supplierFound    = ref(false)
  const supplierAttempts = ref(0)

  async function loadSupplierStatus(worldHex, sectorName) {
    const campaignId = auth.campaign?.id
    if (!campaignId) return
    const { data } = await api.get(`/api/campaigns/${campaignId}/find-supplier`, {
      player_id: auth.player?.id, world_hex: worldHex, sector: sectorName,
      month_key: Math.floor(currentTick.value / TICKS_PER_MONTH),
    })
    supplierFound.value    = !!data?.succeeded
    supplierAttempts.value = data?.attempts ?? 0
  }

  // @param {number} opts.skillLevel  — the player's own Broker/Streetwise/Admin skill
  // @param {number} opts.starportDM  — from starportBrokerDM(starportFromUWP(world.UWP))
  async function attemptFindSupplier(worldHex, sectorName, { skillLevel = 0, starportDM = 0 } = {}) {
    const campaignId = auth.campaign?.id
    if (!campaignId) return { success: false }

    const { data, error: apiErr } = await api.post(`/api/campaigns/${campaignId}/find-supplier`, {
      player_id:   auth.player?.id,
      world_hex:   worldHex,
      sector:      sectorName,
      month_key:   Math.floor(currentTick.value / TICKS_PER_MONTH),
      skill_level: skillLevel,
      starport_dm: starportDM,
    })
    if (apiErr) { error.value = apiErr; return { success: false } }

    supplierFound.value    = !!data.success
    supplierAttempts.value = data.attempts ?? supplierAttempts.value + 1
    return data
  }

  return {
    currentTick, currentYear, currentDay, currentMonth,
    loading, error, activeEvents, allEvents, worldSnapshots, worldEventHistory,
    customEventDefinitions,
    trafficAvailability,
    supplierFound, supplierAttempts,
    displaySnapshots, brokerSkill,
    blackMarketFound, blackMarketAttempts, blackMarketSnapshots, displayBlackMarketSnapshots,
    imperialDate,
    loadCalendar,
    advanceTick,
    loadActiveEvents,
    loadAllEvents,
    loadCustomEventDefinitions,
    ensureWorldSnapshot,
    ensureTrafficSnapshot,
    loadWeeklyHistory,
    loadMonthlyHistory,
    loadAnnualHistory,
    eventsForWorld,
    loadWorldEventHistory,
    loadSupplierStatus,
    attemptFindSupplier,
    loadBrokerSkill,
    loadBlackMarketStatus,
    attemptBlackMarket,
    ensureBlackMarketSnapshot,
  }
})
