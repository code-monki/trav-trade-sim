import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { MILIEUS, BASE_CODES, TRAVEL_ZONE, FIELD_LABELS } from '../lib/traveller-data.js'
import { parseSectorRoutes, decodeUWP, parseTabDelimited } from '../lib/traveller-helpers.js'

const API = 'https://travellermap.com'

export const useMapStore = defineStore('map', () => {
  // ── State ────────────────────────────────────────────────────────────────────
  const sectors          = ref([])
  const selectedMilieu   = ref('M1105')
  const selectedSectorName = ref('')
  const worlds           = ref([])
  const worldHeaders     = ref([])
  const sectorRoutes     = ref([])
  const selectedWorld    = ref(null)
  const loading          = ref(false)
  const error            = ref(null)
  const searchQuery      = ref('')
  const showRaw          = ref(false)

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
  async function loadSectors() {
    loading.value = true
    error.value   = null
    try {
      const res = await fetch(`${API}/api/universe?milieu=${selectedMilieu.value}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const data = await res.json()
      sectors.value = (data.Sectors || [])
        .filter(s => s.Names?.length)
        .map(s => ({
          name:         s.Names[0].Text,
          abbreviation: s.Abbreviation || '',
          x: s.X,
          y: s.Y,
          tags: s.Tags || '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    } catch (e) {
      error.value = `Failed to load sectors: ${e.message}`
    } finally {
      loading.value = false
    }
  }

  async function onSectorChange() {
    worlds.value       = []
    worldHeaders.value = []
    sectorRoutes.value = []
    selectedWorld.value = null
    searchQuery.value  = ''
    showRaw.value      = false

    if (!selectedSectorName.value) return

    loading.value = true
    error.value   = null
    try {
      const enc = encodeURIComponent(selectedSectorName.value)
      const mil = selectedMilieu.value
      const [worldRes, routeRes] = await Promise.all([
        fetch(`${API}/api/sec?sector=${enc}&type=TabDelimited&milieu=${mil}`),
        fetch(`${API}/api/metadata?sector=${enc}&milieu=${mil}`),
      ])

      if (!worldRes.ok) throw new Error(`HTTP ${worldRes.status}: ${worldRes.statusText}`)
      const text = await worldRes.text()
      const { headers, worlds: parsed } = parseTabDelimited(text)
      worldHeaders.value = headers
      worlds.value       = parsed

      if (routeRes.ok) {
        const xml = await routeRes.text()
        sectorRoutes.value = parseSectorRoutes(xml)
      }
    } catch (e) {
      error.value = `Failed to load sector data: ${e.message}`
    } finally {
      loading.value = false
    }
  }

  async function onMilieuChange() {
    sectors.value          = []
    worlds.value           = []
    worldHeaders.value     = []
    sectorRoutes.value     = []
    selectedSectorName.value = ''
    selectedWorld.value    = null
    searchQuery.value      = ''
    showRaw.value          = false
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
    worlds, worldHeaders, sectorRoutes,
    selectedWorld, loading, error, searchQuery, showRaw,
    // computed
    selectedSectorInfo, filteredWorlds, decodedUWP,
    travelZoneLabel, zoneBadgeClass, decodedBases,
    extensionFields, hasExtensions,
    worldByHex, routesByHex, selectedWorldRoutes,
    // actions
    loadSectors, onSectorChange, onMilieuChange, selectWorld,
  }
})
