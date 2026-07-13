import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { MILIEUS, BASE_CODES, TRAVEL_ZONE, FIELD_LABELS } from '../lib/traveller-data.js'
import { parseSectorRoutes, decodeUWP, parseTabDelimited } from '../lib/traveller-helpers.js'
import { cacheGetUniverse, cacheSaveUniverse, cacheGetSector, cacheSaveSector } from '../lib/travellermap-cache.js'

const API = 'https://travellermap.com'

export const useMapStore = defineStore('map', () => {
  // ── State ────────────────────────────────────────────────────────────────────
  const sectors          = ref([])
  const selectedMilieu   = ref('M1105')
  const selectedSectorName = ref('')
  const worlds           = ref([])
  const worldHeaders     = ref([])
  const sectorRoutes     = ref([])
  const subsectorNames   = ref({})   // { A: 'Cronor', B: 'Jewell', C: 'Regina', ... }
  const selectedWorld    = ref(null)
  const loading          = ref(false)
  const error            = ref(null)
  const searchQuery      = ref('')
  const showRaw          = ref(false)

  // Traveller Map is an external dependency with no server-side caching of
  // its own — these flags let the UI show "using cached data" instead of a
  // hard error when a cached copy exists but the live refresh failed.
  const usingCachedData  = ref(false)
  const cachedAt         = ref(null)

  // ── Computed ─────────────────────────────────────────────────────────────────
  const selectedSectorInfo = computed(() =>
    sectors.value.find(s => s.name === selectedSectorName.value) || null
  )

  const filteredWorlds = computed(() => {
    if (!searchQuery.value.trim()) return worlds.value
    const q = searchQuery.value.toLowerCase()
    return worlds.value.filter(w =>
      (w.Name || '').toLowerCase().includes(q) ||
      (w.Hex  || '').toLowerCase().includes(q)
    )
  })

  const decodedUWP = computed(() =>
    selectedWorld.value ? decodeUWP(selectedWorld.value.UWP) : []
  )

  const travelZoneLabel = computed(() => {
    const zone = selectedWorld.value?.Zone || ''
    return TRAVEL_ZONE[zone] || zone || 'Green — No Restrictions'
  })

  const zoneBadgeClass = computed(() => {
    const z = selectedWorld.value?.Zone || ''
    return { 'zone-green': !z, 'zone-amber': z === 'A', 'zone-red': z === 'R' }
  })

  const decodedBases = computed(() => {
    const bases = selectedWorld.value?.Bases || ''
    if (!bases.trim()) return ''
    return bases.split('').map(b => BASE_CODES[b] || b).join(', ')
  })

  const EXT_KEYS = ['{Ix}', '(Ex)', '[Cx]', 'Ix', 'Ex', 'Cx', 'Nobility']
  const extensionFields = computed(() =>
    EXT_KEYS
      .filter(k => worldHeaders.value.includes(k))
      .map(k => ({ key: k, label: FIELD_LABELS[k] || k }))
  )

  const hasExtensions = computed(() => extensionFields.value.length > 0)

  const worldByHex = computed(() => {
    const map = new Map()
    worlds.value.forEach(w => map.set(w.Hex, w))
    return map
  })

  const routesByHex = computed(() => {
    const map = new Map()

    function add(hex, partnerHex, route, crossSector) {
      if (!map.has(hex)) map.set(hex, [])
      const partner = worldByHex.value.get(partnerHex)
      map.get(hex).push({
        partnerHex,
        partnerName: partner?.Name || null,
        partnerUWP:  partner?.UWP  || null,
        allegiance:  route.allegiance,
        type:        route.type,
        style:       route.style,
        color:       route.color,
        crossSector,
      })
    }

    sectorRoutes.value.forEach(route => {
      const startCross = route.startOffsetX !== 0 || route.startOffsetY !== 0
      const endCross   = route.endOffsetX   !== 0 || route.endOffsetY   !== 0
      if (!startCross) add(route.start, route.end,   route, endCross)
      if (!endCross)   add(route.end,   route.start, route, startCross)
    })

    return map
  })

  const selectedWorldRoutes = computed(() => {
    if (!selectedWorld.value) return []
    return routesByHex.value.get(selectedWorld.value.Hex) || []
  })

  // ── Actions ──────────────────────────────────────────────────────────────────

  // Traveller Map has no offline fallback of its own, so every load here is
  // "cache-first, then revalidate": a cached copy (if any) paints instantly
  // with no blocking spinner, then a live fetch either refreshes it silently
  // or — if the network/API is down — leaves the cached copy on screen with
  // a soft notice instead of the hard error banner.
  async function loadSectors() {
    error.value = null

    let cached = null
    try {
      cached = await cacheGetUniverse(selectedMilieu.value)
    } catch { /* IndexedDB unavailable — proceed network-only */ }

    if (cached?.sectors?.length) {
      sectors.value          = cached.sectors
      usingCachedData.value  = true
      cachedAt.value         = cached.fetchedAt
    } else {
      loading.value = true
    }

    try {
      const res = await fetch(`${API}/api/universe?milieu=${selectedMilieu.value}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const data = await res.json()
      const parsed = (data.Sectors || [])
        .filter(s => s.Names?.length)
        .map(s => ({
          name:         s.Names[0].Text,
          abbreviation: s.Abbreviation || '',
          x: s.X,
          y: s.Y,
          tags: s.Tags || '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name))

      sectors.value         = parsed
      usingCachedData.value = false
      cachedAt.value        = null
      try { await cacheSaveUniverse(selectedMilieu.value, parsed) } catch { /* cache write is best-effort */ }
    } catch (e) {
      if (!(cached?.sectors?.length)) {
        error.value = `Failed to load sectors: ${e.message}`
      }
      // else: keep showing the cached list; usingCachedData/cachedAt stay set
    } finally {
      loading.value = false
    }
  }

  async function onSectorChange() {
    worlds.value        = []
    worldHeaders.value  = []
    sectorRoutes.value  = []
    subsectorNames.value = {}
    selectedWorld.value = null
    searchQuery.value   = ''
    showRaw.value       = false
    error.value         = null

    if (!selectedSectorName.value) return

    const mil = selectedMilieu.value
    const sectorName = selectedSectorName.value

    let cached = null
    try {
      cached = await cacheGetSector(mil, sectorName)
    } catch { /* IndexedDB unavailable — proceed network-only */ }

    if (cached) {
      worldHeaders.value     = cached.worldHeaders
      worlds.value           = cached.worlds
      sectorRoutes.value     = cached.sectorRoutes
      subsectorNames.value   = cached.subsectorNames
      usingCachedData.value  = true
      cachedAt.value         = cached.fetchedAt
    } else {
      loading.value = true
    }

    try {
      const enc = encodeURIComponent(sectorName)
      const [worldRes, metaRes] = await Promise.all([
        fetch(`${API}/api/sec?sector=${enc}&type=TabDelimited&milieu=${mil}`),
        fetch(`${API}/api/metadata?sector=${enc}&milieu=${mil}`),
      ])

      if (!worldRes.ok) throw new Error(`HTTP ${worldRes.status}: ${worldRes.statusText}`)
      const text = await worldRes.text()
      const { headers, worlds: parsed } = parseTabDelimited(text)

      let parsedSubsectorNames = {}
      let parsedRoutes = []
      if (metaRes.ok) {
        const metaText = await metaRes.text()
        try {
          // API returns JSON; extract subsector names and routes from it
          const meta = JSON.parse(metaText)
          parsedSubsectorNames = Object.fromEntries(
            (meta.Subsectors || []).map(s => [s.Index, s.Name])
          )
          parsedRoutes = (meta.Routes || []).map(r => ({
            start:        r.Start        || '',
            end:          r.End          || '',
            allegiance:   r.Allegiance   || '',
            type:         r.Type         || '',
            style:        r.Style        || '',
            color:        r.Color        || '',
            startOffsetX: r.StartOffsetX || 0,
            startOffsetY: r.StartOffsetY || 0,
            endOffsetX:   r.EndOffsetX   || 0,
            endOffsetY:   r.EndOffsetY   || 0,
          }))
        } catch {
          // Fallback: try legacy XML format
          parsedRoutes = parseSectorRoutes(metaText)
        }
      }

      worldHeaders.value    = headers
      worlds.value          = parsed
      subsectorNames.value  = parsedSubsectorNames
      sectorRoutes.value    = parsedRoutes
      usingCachedData.value = false
      cachedAt.value        = null

      try {
        await cacheSaveSector(mil, sectorName, {
          worldHeaders: headers, worlds: parsed,
          subsectorNames: parsedSubsectorNames, sectorRoutes: parsedRoutes,
        })
      } catch { /* cache write is best-effort */ }
    } catch (e) {
      if (!cached) {
        error.value = `Failed to load sector data: ${e.message}`
      }
      // else: keep showing the cached sector; usingCachedData/cachedAt stay set
    } finally {
      loading.value = false
    }
  }

  async function onMilieuChange() {
    sectors.value            = []
    worlds.value             = []
    worldHeaders.value       = []
    sectorRoutes.value       = []
    subsectorNames.value     = {}
    selectedSectorName.value = ''
    selectedWorld.value      = null
    searchQuery.value        = ''
    showRaw.value            = false
    usingCachedData.value    = false
    cachedAt.value           = null
    await loadSectors()
  }

  function selectWorld(world) {
    selectedWorld.value = world
    showRaw.value       = false
  }

  return {
    // constants
    MILIEUS,
    // state
    sectors, selectedMilieu, selectedSectorName,
    worlds, worldHeaders, sectorRoutes, subsectorNames,
    selectedWorld, loading, error, searchQuery, showRaw,
    usingCachedData, cachedAt,
    // computed
    selectedSectorInfo, filteredWorlds, decodedUWP,
    travelZoneLabel, zoneBadgeClass, decodedBases,
    extensionFields, hasExtensions,
    worldByHex, routesByHex, selectedWorldRoutes,
    // actions
    loadSectors, onSectorChange, onMilieuChange, selectWorld,
  }
})
