import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'

export const useRefereeStore = defineStore('referee', () => {
  const ships   = ref([])   // ships with active crew embedded
  const players = ref([])   // all players with skills + current ship name
  const loading = ref(false)
  const error   = ref(null)

  function clearError() { error.value = null }

  // ── Ships ──────────────────────────────────────────────────────────────────

  async function loadShips(campaignId) {
    loading.value = true
    error.value   = null
    try {
      const { data: shipRows, error: shipErr } = await supabase
        .from('ships')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('name')
      if (shipErr) throw new Error(shipErr.message)

      const { data: crewRows, error: crewErr } = await supabase
        .from('crew')
        .select('id, ship_id, role, can_trade, joined_tick, players(id, character_name, role)')
        .eq('campaign_id', campaignId)
        .is('left_tick', null)
      if (crewErr) throw new Error(crewErr.message)

      // Embed active crew into each ship
      ships.value = (shipRows ?? []).map(s => ({
        ...s,
        crew: (crewRows ?? []).filter(c => c.ship_id === s.id),
      }))
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function createShip(campaignId, { name, hullType, hullTons, cargoCapacity, credits, jumpRating, maneuverRating }) {
    const { data, error: err } = await supabase
      .from('ships')
      .insert({
        campaign_id:           campaignId,
        name:                  name.trim(),
        hull_type:             hullType      || null,
        hull_tons:             hullTons      ?? 200,
        cargo_capacity:        cargoCapacity ?? 80,
        credits:               credits       ?? 0,
        jump_rating:           jumpRating    || null,
        maneuver_drive_rating: maneuverRating || null,
      })
      .select()
      .single()
    if (err) throw new Error(err.message)
    ships.value = [...ships.value, { ...data, crew: [] }].sort((a, b) => a.name.localeCompare(b.name))
    return data
  }

  async function updateShip(shipId, fields) {
    const { data, error: err } = await supabase
      .from('ships')
      .update(fields)
      .eq('id', shipId)
      .select()
      .single()
    if (err) throw new Error(err.message)
    ships.value = ships.value.map(s =>
      s.id === shipId ? { ...s, ...data } : s
    )
    return data
  }

  // ── Crew ───────────────────────────────────────────────────────────────────

  async function assignCrew(campaignId, shipId, playerId, role, currentTick) {
    const { data, error: err } = await supabase
      .from('crew')
      .insert({
        campaign_id: campaignId,
        ship_id:     shipId,
        player_id:   playerId,
        role,
        can_trade:   role === 'captain',
        joined_tick: currentTick ?? 0,
      })
      .select('id, ship_id, role, can_trade, joined_tick, players(id, character_name, role)')
      .single()
    if (err) throw new Error(err.message)
    ships.value = ships.value.map(s =>
      s.id === shipId ? { ...s, crew: [...s.crew, data] } : s
    )
    // Reflect new ship on players list
    players.value = players.value.map(p =>
      p.id === playerId ? { ...p, current_ship: ships.value.find(s => s.id === shipId)?.name ?? '' } : p
    )
  }

  async function setCrewCanTrade(crewRow, canTrade) {
    const { error: err } = await supabase
      .from('crew')
      .update({ can_trade: canTrade })
      .eq('id', crewRow.id)
    if (err) throw new Error(err.message)
    crewRow.can_trade = canTrade
  }

  async function removeCrew(crewId, currentTick) {
    const { error: err } = await supabase
      .from('crew')
      .update({ left_tick: currentTick })
      .eq('id', crewId)
    if (err) throw new Error(err.message)
    ships.value = ships.value.map(s => ({
      ...s,
      crew: s.crew.filter(c => c.id !== crewId),
    }))
    // Clear ship from players list
    players.value = players.value.map(p => {
      const stillCrewed = ships.value.some(s => s.crew.some(c => c.players?.id === p.id))
      return stillCrewed ? p : { ...p, current_ship: '' }
    })
  }

  // ── Players ────────────────────────────────────────────────────────────────

  async function loadPlayers(campaignId) {
    loading.value = true
    error.value   = null
    try {
      const { data: playerRows, error: playerErr } = await supabase
        .from('players')
        .select('id, character_name, role, credits')
        .eq('campaign_id', campaignId)
        .order('character_name')
      if (playerErr) throw new Error(playerErr.message)

      const { data: skillRows, error: skillErr } = await supabase
        .from('player_skills')
        .select('id, player_id, skill, level')
        .eq('campaign_id', campaignId)
      if (skillErr) throw new Error(skillErr.message)

      const { data: crewRows, error: crewErr } = await supabase
        .from('crew')
        .select('player_id, ships(name)')
        .eq('campaign_id', campaignId)
        .is('left_tick', null)
      if (crewErr) throw new Error(crewErr.message)

      const crewMap  = Object.fromEntries((crewRows ?? []).map(c => [c.player_id, c.ships?.name ?? '']))
      const skillMap = {}
      for (const s of skillRows ?? []) {
        if (!skillMap[s.player_id]) skillMap[s.player_id] = []
        skillMap[s.player_id].push(s)
      }

      players.value = (playerRows ?? []).map(p => ({
        ...p,
        current_ship: crewMap[p.id] ?? '',
        skills: skillMap[p.id] ?? [],
      }))
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  // ── Skills ─────────────────────────────────────────────────────────────────

  async function upsertSkill(campaignId, playerId, skill, level) {
    const { data, error: err } = await supabase
      .from('player_skills')
      .upsert(
        { campaign_id: campaignId, player_id: playerId, skill: skill.trim(), level },
        { onConflict: 'player_id,skill' }
      )
      .select()
      .single()
    if (err) throw new Error(err.message)
    players.value = players.value.map(p => {
      if (p.id !== playerId) return p
      const existing = p.skills.find(s => s.skill === skill.trim())
      const skills = existing
        ? p.skills.map(s => s.skill === skill.trim() ? data : s)
        : [...p.skills, data]
      return { ...p, skills }
    })
  }

  async function removeSkill(playerId, skillId) {
    const { error: err } = await supabase
      .from('player_skills')
      .delete()
      .eq('id', skillId)
    if (err) throw new Error(err.message)
    players.value = players.value.map(p =>
      p.id === playerId
        ? { ...p, skills: p.skills.filter(s => s.id !== skillId) }
        : p
    )
  }

  // ── Manual market events ───────────────────────────────────────────────────

  async function createEvent(campaignId, { worldHex, sector, scope, tradeGoodDie, buyModifierPct, sellModifierPct, description, durationTicks, currentTick }) {
    const { data, error: err } = await supabase
      .from('market_events')
      .insert({
        campaign_id:       campaignId,
        tick:              currentTick,
        scope,
        world_hex:         scope === 'local' ? worldHex : null,
        sector,
        trade_good_die:    tradeGoodDie || null,
        buy_modifier_pct:  buyModifierPct  ?? null,
        sell_modifier_pct: sellModifierPct ?? null,
        description:       description.trim(),
        expires_tick:      currentTick + durationTicks,
      })
      .select()
      .single()
    if (err) throw new Error(err.message)
    return data
  }

  async function expireEvent(eventId, currentTick) {
    const { error: err } = await supabase
      .from('market_events')
      .update({ expires_tick: currentTick })
      .eq('id', eventId)
    if (err) throw new Error(err.message)
  }

  function clear() {
    ships.value   = []
    players.value = []
    error.value   = null
  }

  return {
    ships, players, loading, error,
    clearError, clear,
    loadShips, createShip, updateShip,
    assignCrew, removeCrew, setCrewCanTrade,
    loadPlayers, upsertSkill, removeSkill,
    createEvent, expireEvent,
  }
})
