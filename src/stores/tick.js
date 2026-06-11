import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase.js'
import { useAuthStore } from './auth.js'
import { generateWorldSnapshot, tickToCalendar, formatImperialDate } from '../lib/market-tick.js'
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
  const worldSnapshots  = ref({})
  const snapshotWorldKey = ref('')   // '{campaignId}:{worldHex}:{sector}:{tick}'

  // Active events for current campaign (loaded once per session / tick advance)
  const activeEvents = ref([])

  // ── Computed ───────────────────────────────────────────────────────────────
  const imperialDate = computed(() => formatImperialDate(currentTick.value))

  // ── Calendar ───────────────────────────────────────────────────────────────

  async function loadCalendar() {
    const campaignId = auth.campaign?.id
    if (!campaignId) return

    const { data, error: err } = await supabase
      .from('campaign_calendar')
      .select('current_tick, year, day')
      .eq('campaign_id', campaignId)
      .single()

    if (err) { error.value = err.message; return }

    currentTick.value  = data.current_tick
    currentYear.value  = data.year
    currentDay.value   = data.day
    const cal = tickToCalendar(data.current_tick)
    currentMonth.value = cal.month
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
      const { data, error: rpcError } = await supabase.rpc('advance_tick', {
        p_campaign_id: auth.campaign.id,
      })
      if (rpcError) throw new Error(rpcError.message)
      if (data?.error) throw new Error(data.error)

      currentTick.value  = data.tick
      currentYear.value  = data.year
      currentDay.value   = data.day
      currentMonth.value = data.month

      // Invalidate snapshot cache — prices change each tick
      worldSnapshots.value    = {}
      snapshotWorldKey.value  = ''

      // Reload events after tick advance
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

    const { data } = await supabase
      .from('market_events')
      .select('*')
      .eq('campaign_id', campaignId)
      .or(`expires_tick.is.null,expires_tick.gt.${currentTick.value}`)

    activeEvents.value = data ?? []
  }

  async function maybeInsertEvent(world, sectorName) {
    const campaignId = auth.campaign?.id
    if (!campaignId) return

    const ev = maybeGenerateEvent({
      world,
      sectorName,
      campaignId,
      tick: currentTick.value,
    })
    if (!ev) return

    // Avoid duplicate events for the same (campaign, world, tick)
    const { count } = await supabase
      .from('market_events')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('tick', currentTick.value)
      .eq('world_hex', ev.world_hex ?? '')

    if (!count || count === 0) {
      await supabase.from('market_events').insert(ev)
      // Refresh active events to include the new one
      await loadActiveEvents()
    }
  }

  // ── World snapshot ─────────────────────────────────────────────────────────

  /**
   * Ensure market snapshots exist for a world at the current tick.
   * Generates and inserts them if missing (lazy evaluation — only when viewed).
   * Returns the 36 snapshot rows sorted by die code.
   */
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
      // Check if snapshots already exist in Supabase
      const { count } = await supabase
        .from('market_snapshots')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('world_hex', world.Hex)
        .eq('sector', sectorName)
        .eq('tick', currentTick.value)

      if (!count || count === 0) {
        // Maybe fire a market event first (affects prices below)
        await maybeInsertEvent(world, sectorName)

        // Get active events for this world
        const eventsForWorld = activeEventsForWorld(
          activeEvents.value,
          world.Hex,
          currentTick.value,
        )

        // Generate all 36 good snapshots deterministically
        const rows = generateWorldSnapshot({
          world,
          sectorName,
          campaignId,
          tick: currentTick.value,
          activeEvents: eventsForWorld,
        })

        const { error: insertErr } = await supabase
          .from('market_snapshots')
          .insert(rows)

        if (insertErr) throw new Error(insertErr.message)

        // Cache locally
        const cache = {}
        for (const row of rows) cache[row.trade_good_die] = row
        worldSnapshots.value   = cache
        snapshotWorldKey.value = cacheKey
        return rows
      }

      // Load from Supabase
      const { data, error: fetchErr } = await supabase
        .from('market_snapshots')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('world_hex', world.Hex)
        .eq('sector', sectorName)
        .eq('tick', currentTick.value)
        .order('trade_good_die')

      if (fetchErr) throw new Error(fetchErr.message)

      const cache = {}
      for (const row of data) cache[row.trade_good_die] = row
      worldSnapshots.value   = cache
      snapshotWorldKey.value = cacheKey
      return data
    } catch (e) {
      error.value = e.message
      return []
    } finally {
      loading.value = false
    }
  }

  // ── Price history ──────────────────────────────────────────────────────────

  /**
   * Load weekly price history for one good at one world.
   * Returns raw ticks suitable for a candlestick chart (time = tick).
   */
  async function loadWeeklyHistory(worldHex, sectorName, goodDie, limit = 52) {
    const campaignId = auth.campaign?.id
    if (!campaignId) return []

    const { data, error: err } = await supabase
      .from('market_snapshots')
      .select('tick, purchase_price, sale_price, qty_available')
      .eq('campaign_id', campaignId)
      .eq('world_hex', worldHex)
      .eq('sector', sectorName)
      .eq('trade_good_die', goodDie)
      .order('tick', { ascending: false })
      .limit(limit)

    if (err) { error.value = err.message; return [] }
    return (data ?? []).reverse()
  }

  /**
   * Load monthly OHLC history for candlestick charts.
   * Each bar = one Imperial month (4 ticks).
   */
  async function loadMonthlyHistory(worldHex, sectorName, goodDie, limit = 24) {
    const campaignId = auth.campaign?.id
    if (!campaignId) return []

    const { data, error: err } = await supabase
      .from('market_monthly')
      .select('year, month, open_price, high_price, low_price, close_price, volume_tons')
      .eq('campaign_id', campaignId)
      .eq('world_hex', worldHex)
      .eq('sector', sectorName)
      .eq('trade_good_die', goodDie)
      .order('year',  { ascending: false })
      .order('month', { ascending: false })
      .limit(limit)

    if (err) { error.value = err.message; return [] }
    return (data ?? []).reverse()
  }

  /**
   * Load annual OHLC history.
   */
  async function loadAnnualHistory(worldHex, sectorName, goodDie) {
    const campaignId = auth.campaign?.id
    if (!campaignId) return []

    const { data, error: err } = await supabase
      .from('market_annual')
      .select('year, open_price, high_price, low_price, close_price, volume_tons')
      .eq('campaign_id', campaignId)
      .eq('world_hex', worldHex)
      .eq('sector', sectorName)
      .eq('trade_good_die', goodDie)
      .order('year')

    if (err) { error.value = err.message; return [] }
    return data ?? []
  }

  // ── Active events for display ──────────────────────────────────────────────

  function eventsForWorld(worldHex) {
    return activeEventsForWorld(activeEvents.value, worldHex, currentTick.value)
  }

  return {
    // state
    currentTick, currentYear, currentDay, currentMonth,
    loading, error, activeEvents, worldSnapshots,
    // computed
    imperialDate,
    // actions
    loadCalendar,
    advanceTick,
    loadActiveEvents,
    ensureWorldSnapshot,
    loadWeeklyHistory,
    loadMonthlyHistory,
    loadAnnualHistory,
    eventsForWorld,
  }
})
