import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../lib/api.js'

export const useRefereeStore = defineStore('referee', () => {
  const ships       = ref([])   // ships with active crew embedded
  const players     = ref([])   // all players with skills + current ship name
  const templates   = ref([])   // ship templates for this campaign's ruleset
  const organizations = ref([]) // campaign-wide list of Organizations
  const loading     = ref(false)
  const error       = ref(null)

  function clearError() { error.value = null }

  // ── Ships ──────────────────────────────────────────────────────────────────

  async function loadShips(campaignId) {
    loading.value = true
    error.value   = null
    try {
      const { data, error: apiErr } = await api.get('/api/referee/ships', { campaign_id: campaignId })
      if (apiErr) throw new Error(apiErr)
      ships.value = data ?? []
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function createShip(campaignId, {
    name, hullType, hullTons, cargoCapacity, credits, jumpRating, maneuverRating,
    staterooms, lowBerths, fuelCapacity, fuelCurrent, marketValue,
  }) {
    const { data, error: apiErr } = await api.post('/api/referee/ships', {
      campaign_id:           campaignId,
      name:                  name.trim(),
      hull_type:             hullType      || null,
      hull_tons:             hullTons      ?? 200,
      cargo_capacity:        cargoCapacity ?? 80,
      credits:               credits       ?? 0,
      jump_rating:           jumpRating    || null,
      maneuver_drive_rating: maneuverRating || null,
      stateroom_capacity:    staterooms    ?? 0,
      low_berth_capacity:    lowBerths     ?? 0,
      fuel_capacity:         fuelCapacity  ?? 0,
      fuel_current:          fuelCurrent   ?? 0,
      market_value:          marketValue   ?? 0,
    })
    if (apiErr) throw new Error(apiErr)
    ships.value = [...ships.value, { ...data, crew: [] }].sort((a, b) => a.name.localeCompare(b.name))
    return data
  }

  async function updateShip(shipId, fields) {
    const { data, error: apiErr } = await api.patch(`/api/referee/ships/${shipId}`, fields)
    if (apiErr) throw new Error(apiErr)
    ships.value = ships.value.map(s => s.id === shipId ? { ...s, ...data } : s)
    return data
  }

  // ── Ship Templates ─────────────────────────────────────────────────────────

  async function loadShipTemplates() {
    const { data, error: apiErr } = await api.get('/api/referee/ship-templates')
    if (apiErr) throw new Error(apiErr)
    templates.value = data ?? []
  }

  async function createShipTemplate({
    name, hullType, hullTons, cargoCapacity, jumpRating, maneuverRating,
    staterooms, lowBerths, fuelCapacity, marketValue, notes,
  }) {
    const { data, error: apiErr } = await api.post('/api/referee/ship-templates', {
      name:                  name.trim(),
      hull_type:             hullType      || null,
      hull_tons:             hullTons      ?? 200,
      cargo_capacity:        cargoCapacity ?? 80,
      jump_rating:           jumpRating    || null,
      maneuver_drive_rating: maneuverRating || null,
      stateroom_capacity:    staterooms    ?? 0,
      low_berth_capacity:    lowBerths     ?? 0,
      fuel_capacity:         fuelCapacity  ?? 0,
      market_value:          marketValue   ?? 0,
      notes:                 notes         || null,
    })
    if (apiErr) throw new Error(apiErr)
    templates.value = [...templates.value, data].sort((a, b) => a.name.localeCompare(b.name))
    return data
  }

  async function updateShipTemplate(templateId, fields) {
    const { data, error: apiErr } = await api.patch(`/api/referee/ship-templates/${templateId}`, fields)
    if (apiErr) throw new Error(apiErr)
    templates.value = templates.value.map(t => t.id === templateId ? { ...t, ...data } : t)
    return data
  }

  async function deleteShipTemplate(templateId) {
    const { error: apiErr } = await api.delete(`/api/referee/ship-templates/${templateId}`)
    if (apiErr) throw new Error(apiErr)
    templates.value = templates.value.filter(t => t.id !== templateId)
  }

  // ── Organizations ───────────────────────────────────────────────────────────

  async function loadOrganizations() {
    const { data, error: apiErr } = await api.get('/api/organizations')
    if (apiErr) throw new Error(apiErr)
    organizations.value = data ?? []
  }

  async function createOrganization({ name, treasuryCredits, duesRate, notes }) {
    const { data, error: apiErr } = await api.post('/api/organizations', {
      name:             name.trim(),
      treasury_credits: treasuryCredits ?? 0,
      dues_rate:        duesRate ?? null,
      notes:            notes || null,
    })
    if (apiErr) throw new Error(apiErr)
    organizations.value = [...organizations.value, data].sort((a, b) => a.name.localeCompare(b.name))
    return data
  }

  async function updateOrganization(orgId, fields) {
    const { data, error: apiErr } = await api.patch(`/api/organizations/${orgId}`, fields)
    if (apiErr) throw new Error(apiErr)
    organizations.value = organizations.value.map(o => o.id === orgId ? { ...o, ...data } : o)
    return data
  }

  async function deleteOrganization(orgId) {
    const { error: apiErr } = await api.delete(`/api/organizations/${orgId}`)
    if (apiErr) throw new Error(apiErr)
    organizations.value = organizations.value.filter(o => o.id !== orgId)
  }

  // ── Crew ───────────────────────────────────────────────────────────────────

  async function assignCrew(campaignId, shipId, playerId, role, currentTick) {
    const { data, error: apiErr } = await api.post('/api/referee/crew', {
      campaign_id:  campaignId,
      ship_id:      shipId,
      player_id:    playerId,
      role,
      can_trade:    role === 'captain',
      joined_tick:  currentTick ?? 0,
    })
    if (apiErr) throw new Error(apiErr)
    ships.value = ships.value.map(s =>
      s.id === shipId ? { ...s, crew: [...s.crew, data] } : s
    )
    players.value = players.value.map(p =>
      p.id === playerId ? { ...p, current_ship: ships.value.find(s => s.id === shipId)?.name ?? '' } : p
    )
  }

  async function setCrewCanTrade(crewRow, canTrade) {
    const { error: apiErr } = await api.patch(`/api/referee/crew/${crewRow.id}`, { can_trade: canTrade })
    if (apiErr) throw new Error(apiErr)
    crewRow.can_trade = canTrade
  }

  async function setCrewStateroomOccupancy(crewRow, hasStaterroom) {
    const { error: apiErr } = await api.patch(`/api/referee/crew/${crewRow.id}`, { has_stateroom: hasStaterroom ? 1 : 0 })
    if (apiErr) throw new Error(apiErr)
    crewRow.has_stateroom = hasStaterroom
  }

  async function updateCrewRole(crewRow, newRole) {
    const updates = { role: newRole }
    if (newRole === 'captain') updates.can_trade = true
    const { error: apiErr } = await api.patch(`/api/referee/crew/${crewRow.id}`, updates)
    if (apiErr) throw new Error(apiErr)
    crewRow.role = newRole
    if (updates.can_trade !== undefined) crewRow.can_trade = updates.can_trade
  }

  async function removeCrew(crewId, currentTick) {
    const { error: apiErr } = await api.patch(`/api/referee/crew/${crewId}`, { left_tick: currentTick })
    if (apiErr) throw new Error(apiErr)
    ships.value = ships.value.map(s => ({
      ...s,
      crew: s.crew.filter(c => c.id !== crewId),
    }))
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
      const { data, error: apiErr } = await api.get('/api/referee/players', { campaign_id: campaignId })
      if (apiErr) throw new Error(apiErr)
      players.value = data ?? []
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  // ── Skills ─────────────────────────────────────────────────────────────────

  async function upsertSkill(campaignId, playerId, skill, level) {
    const { data, error: apiErr } = await api.post('/api/referee/skills', {
      campaign_id: campaignId, player_id: playerId, skill: skill.trim(), level,
    })
    if (apiErr) throw new Error(apiErr)
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
    const { error: apiErr } = await api.delete(`/api/referee/skills/${skillId}`)
    if (apiErr) throw new Error(apiErr)
    players.value = players.value.map(p =>
      p.id === playerId
        ? { ...p, skills: p.skills.filter(s => s.id !== skillId) }
        : p
    )
  }

  // ── Manual market events ───────────────────────────────────────────────────

  async function createEvent(campaignId, { worldHex, sector, scope, tradeGoodDie, buyModifierPct, sellModifierPct, description, durationTicks, currentTick }) {
    const { data, error: apiErr } = await api.post(`/api/campaigns/${campaignId}/events`, {
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
    if (apiErr) throw new Error(apiErr)
    return data
  }

  async function expireEvent(eventId, currentTick) {
    const { error: apiErr } = await api.patch(`/api/campaigns/event/${eventId}/expire`, { current_tick: currentTick })
    if (apiErr) throw new Error(apiErr)
  }

  function clear() {
    ships.value         = []
    players.value       = []
    templates.value     = []
    organizations.value = []
    error.value         = null
  }

  return {
    ships, players, templates, organizations, loading, error,
    clearError, clear,
    loadShips, createShip, updateShip,
    loadShipTemplates, createShipTemplate, updateShipTemplate, deleteShipTemplate,
    loadOrganizations, createOrganization, updateOrganization, deleteOrganization,
    assignCrew, removeCrew, setCrewCanTrade, setCrewStateroomOccupancy, updateCrewRole,
    loadPlayers, upsertSkill, removeSkill,
    createEvent, expireEvent,
  }
})
