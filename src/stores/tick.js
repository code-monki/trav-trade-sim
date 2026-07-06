import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../lib/api.js'
import { useAuthStore } from './auth.js'
import { generateWorldSnapshot, tickToCalendar, formatImperialDate, TICKS_PER_YEAR } from '../lib/market-tick.js'
import { maybeGenerateEvent, activeEventsForWorld } from '../lib/market-events.js'

export const useTickStore = defineStore('tick', () => {
  const auth = useAuthStore()

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

  // Active events for current campaign (loaded once per session / tick advance)
  const activeEvents = ref([])

  // Full event history for the currently viewed world (active + expired)
  const worldEventHistory = ref([])

  // ── Computed ───────────────────────────────────────────────────────────────
  const imperialDate = computed(() => formatImperialDate(currentTick.value))

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

      await loadActiveEvents()
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

  async function maybeInsertEvent(world, sectorName) {
    const campaignId = auth.campaign?.id
    if (!campaignId) return

    const ev = maybeGenerateEvent({ world, sectorName, campaignId, tick: currentTick.value })
    if (!ev) return

    // Check for an existing event at the same (campaign, tick, world_hex) first
    const { data: dupCheck } = await api.post(`/api/campaigns/${campaignId}/events`, {
      ...ev, check_duplicate: true,
    })
    if (dupCheck?.count > 0) return

    await api.post(`/api/campaigns/${campaignId}/events`, ev)
    await loadActiveEvents()
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
        // Maybe fire a market event first (affects prices below)
        await maybeInsertEvent(world, sectorName)

        // Check if any prior snapshots exist for backfill decision
        const { data: priorData } = await api.get(`/api/campaigns/${campaignId}/snapshots/prior-count`, {
          world_hex: world.Hex,
          sector:    sectorName,
        })

        const yearStartTick = Math.floor(currentTick.value / TICKS_PER_YEAR) * TICKS_PER_YEAR

        if (!(priorData?.count > 0) && currentTick.value > yearStartTick) {
          const backfillRows = []
          for (let t = yearStartTick; t < currentTick.value; t++) {
            backfillRows.push(...generateWorldSnapshot({
              world, sectorName, campaignId, tick: t, activeEvents: [],
            }))
          }
          if (backfillRows.length) {
            await api.post(`/api/campaigns/${campaignId}/snapshots`, { rows: backfillRows })
          }
        }

        const eventsForWorld = activeEventsForWorld(
          activeEvents.value, world.Hex, currentTick.value, sectorName,
        )

        const rows = generateWorldSnapshot({
          world, sectorName, campaignId,
          tick:         currentTick.value,
          activeEvents: eventsForWorld,
        })

        const { error: insertErr } = await api.post(`/api/campaigns/${campaignId}/snapshots`, { rows })
        if (insertErr) throw new Error(insertErr)

        const cache = {}
        for (const row of rows) cache[row.trade_good_die] = row
        worldSnapshots.value   = cache
        snapshotWorldKey.value = cacheKey
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
      return data ?? []
    } catch (e) {
      error.value = e.message
      return []
    } finally {
      loading.value = false
    }
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

  return {
    currentTick, currentYear, currentDay, currentMonth,
    loading, error, activeEvents, worldSnapshots, worldEventHistory,
    imperialDate,
    loadCalendar,
    advanceTick,
    loadActiveEvents,
    ensureWorldSnapshot,
    loadWeeklyHistory,
    loadMonthlyHistory,
    loadAnnualHistory,
    eventsForWorld,
    loadWorldEventHistory,
  }
})
