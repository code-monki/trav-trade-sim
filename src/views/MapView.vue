<template>
  <header>
    <div class="header-left">
      <h1>Traveller Trade Simulator</h1>
      <span class="campaign-label">{{ auth.campaign?.label }}</span>
    </div>
    <div class="header-center">
      <div class="imperial-date">
        <span class="date-value">{{ tick.imperialDate }}</span>
        <span class="date-sub">Tick {{ tick.currentTick }} · {{ auth.campaign?.trade_rules }}</span>
      </div>
      <button v-if="auth.isReferee"
              class="advance-btn"
              :disabled="tick.loading"
              @click="doAdvanceTick">
        {{ tick.loading ? 'Advancing…' : 'Advance Tick ›' }}
      </button>
    </div>
    <div class="header-right">
      <div class="milieu-control">
        <label for="milieu-select">Milieu</label>
        <select
          id="milieu-select"
          class="milieu-select"
          v-model="map.selectedMilieu"
          @change="map.onMilieuChange"
          :disabled="map.loading"
        >
          <option v-for="m in map.MILIEUS" :key="m.code" :value="m.code">{{ m.label }}</option>
        </select>
      </div>
      <div class="session-info">
        <span class="session-char">{{ auth.player?.character_name }}</span>
        <span class="session-campaign">{{ auth.campaign?.code }}</span>
        <span v-if="auth.isReferee" class="role-badge">REF</span>
        <HamburgerMenu
          :is-referee="auth.isReferee"
          @themes="showThemes = true"
          @about="showAbout = true"
          @help="showHelp = true"
          @manage-character="showCharacter = true"
          @manage-campaign="router.push({ name: 'referee' })"
          @signout="doLogout"
        />
      </div>
    </div>
  </header>

  <div class="layout">
    <!-- Left sidebar -->
    <aside class="sidebar">
      <section class="panel">
        <h2>Sector</h2>
        <div v-if="map.loading && !map.sectors.length" class="loading">Loading sectors…</div>
        <template v-else>
          <input v-model="sectorFilter" type="search" placeholder="Filter sectors…"
                 class="search-input" :disabled="map.loading" />
          <select v-model="map.selectedSectorName" @change="map.onSectorChange" :disabled="map.loading">
            <option value="">— Select a Sector —</option>
            <option v-for="sector in filteredSectors" :key="sector.name" :value="sector.name">
              {{ sector.name }}
            </option>
          </select>
        </template>
        <div v-if="map.selectedSectorInfo" class="sector-meta">
          <span>Coordinates: ({{ map.selectedSectorInfo.x }}, {{ map.selectedSectorInfo.y }})</span>
          <span v-if="map.selectedSectorInfo.abbreviation">Abbrev: {{ map.selectedSectorInfo.abbreviation }}</span>
        </div>
      </section>

      <section class="panel world-list-panel">
        <h2>
          Worlds
          <span v-if="map.worlds.length" class="count">({{ map.filteredWorlds.length }} / {{ map.worlds.length }})</span>
        </h2>
        <input v-if="map.worlds.length" v-model="map.searchQuery"
               placeholder="Filter worlds…" class="search-input" type="search" />
        <div v-if="map.worlds.length" class="world-list-header">
          <span>World</span>
          <span>Hex</span>
        </div>
        <div v-if="map.loading && map.selectedSectorName && !map.worlds.length" class="loading">Loading worlds…</div>
        <div v-else-if="!map.selectedSectorName" class="placeholder">Select a sector above</div>
        <div v-else-if="map.worlds.length === 0" class="placeholder">No worlds found</div>
        <ul v-else class="world-list" role="listbox" aria-label="Worlds">
          <li v-for="world in map.filteredWorlds" :key="world.Hex"
              role="option"
              tabindex="0"
              :aria-selected="!!(map.selectedWorld && map.selectedWorld.Hex === world.Hex)"
              :class="{
                selected: map.selectedWorld && map.selectedWorld.Hex === world.Hex,
                'zone-red': world.Zone === 'R',
                'zone-amber': world.Zone === 'A',
              }"
              @click="onWorldSelect(world)"
              @keydown.enter.prevent="onWorldSelect(world)"
              @keydown.space.prevent="onWorldSelect(world)">
            <span class="world-name">{{ world.Name || '(unnamed)' }}</span>
            <span class="world-hex">{{ world.Hex }}</span>
          </li>
        </ul>
      </section>
    </aside>

    <!-- Main panel -->
    <main id="main-content" class="detail">
      <div v-if="!map.selectedWorld" class="placeholder large">
        <p>Select a world from the list to view its data</p>
      </div>

      <div v-else class="world-detail">
        <!-- World header -->
        <div class="detail-header">
          <div>
            <h2>{{ map.selectedWorld.Name || '(unnamed)' }}</h2>
            <div class="location-line">
              <span>{{ map.selectedSectorName }}</span>
              <span class="sep">·</span>
              <span>Hex {{ map.selectedWorld.Hex }}</span>
              <span v-if="map.selectedWorld.SS" class="sep">·</span>
              <span v-if="map.selectedWorld.SS">Subsector {{ map.selectedWorld.SS }}</span>
            </div>
          </div>
          <div class="detail-header-right">
            <a :href="travellerMapUrl"
               target="_blank" rel="noopener noreferrer"
               class="uwp-badge uwp-link"
               title="View on Traveller Map">
              <span class="uwp-code">{{ map.selectedWorld.UWP }} ↗</span>
              <span class="zone-badge" :class="map.zoneBadgeClass">{{ map.travelZoneLabel }}</span>
            </a>
          </div>
        </div>

        <!-- Detail tabs -->
        <div class="detail-tabs">
          <button v-for="t in DETAIL_TABS" :key="t.key"
                  :class="['dtab', { active: detailTab === t.key }]"
                  @click="detailTab = t.key">
            {{ t.label }}
          </button>
        </div>

        <!-- ── Overview tab ──────────────────────────────────────────────── -->
        <template v-if="detailTab === 'overview'">
          <section class="field-group" v-if="map.selectedWorld.UWP">
            <h3>Universal World Profile</h3>
            <div class="field-grid">
              <div class="field" v-for="item in map.decodedUWP" :key="item.label">
                <label>{{ item.label }}</label>
                <div class="field-value">
                  <span class="code-val">{{ item.value }}</span>
                  <span class="desc-val">{{ item.description }}</span>
                </div>
              </div>
            </div>
          </section>

          <section class="field-group">
            <h3>System Data</h3>
            <div class="field-grid">
              <div class="field">
                <label>Allegiance</label>
                <div class="field-value"><span class="code-val">{{ map.selectedWorld.Allegiance || '—' }}</span></div>
              </div>
              <div class="field">
                <label>Stellar Data</label>
                <div class="field-value">{{ map.selectedWorld.Stars || '—' }}</div>
              </div>
              <div class="field">
                <label>Bases</label>
                <div class="field-value">
                  <span class="code-val">{{ map.selectedWorld.Bases || 'None' }}</span>
                  <span v-if="map.decodedBases" class="desc-val">{{ map.decodedBases }}</span>
                </div>
              </div>
              <div class="field">
                <label>Trade Codes / Remarks</label>
                <div class="field-value">{{ map.selectedWorld.Remarks || '—' }}</div>
              </div>
              <div class="field">
                <label>Pop. Multiplier / Belts / Gas Giants</label>
                <div class="field-value">{{ map.selectedWorld.PBG || '—' }}</div>
              </div>
              <div class="field">
                <label>Worlds in System</label>
                <div class="field-value">{{ map.selectedWorld.W || '—' }}</div>
              </div>
              <div class="field">
                <label>Resource Units</label>
                <div class="field-value">{{ map.selectedWorld.RU || '—' }}</div>
              </div>
            </div>
          </section>

          <section class="field-group" v-if="map.hasExtensions">
            <h3>T5 Extensions</h3>
            <div class="field-grid">
              <div class="field" v-for="ext in map.extensionFields" :key="ext.key">
                <label>{{ ext.label }}</label>
                <div class="field-value"><span class="code-val">{{ map.selectedWorld[ext.key] || '—' }}</span></div>
              </div>
            </div>
          </section>

          <section class="field-group">
            <h3>Routes <span class="count">({{ map.selectedWorldRoutes.length }})</span></h3>
            <div v-if="!map.selectedWorldRoutes.length" class="placeholder">No routes defined for this world</div>
            <div v-else class="route-list">
              <div class="route-entry" v-for="(route, i) in map.selectedWorldRoutes" :key="i"
                   :style="route.color ? { borderLeftColor: route.color } : {}">
                <div class="route-dest">
                  <span class="route-name">{{ route.partnerName || '(unnamed)' }}</span>
                  <span class="route-hex">{{ route.partnerHex }}</span>
                  <span v-if="route.crossSector" class="cross-sector-badge">cross-sector</span>
                </div>
                <div class="route-meta">
                  <span v-if="route.partnerUWP" class="code-val">{{ route.partnerUWP }}</span>
                  <span v-if="route.allegiance" class="route-tag">{{ route.allegiance }}</span>
                  <span v-if="route.type" class="route-tag">{{ route.type }}</span>
                  <span v-if="route.style" class="route-tag muted">{{ route.style }}</span>
                </div>
              </div>
            </div>
          </section>

          <section class="field-group raw-section">
            <h3>
              All Fields
              <button class="toggle-btn" @click="map.showRaw = !map.showRaw">{{ map.showRaw ? 'Hide' : 'Show' }}</button>
            </h3>
            <div v-if="map.showRaw" class="field-grid">
              <div class="field" v-for="key in map.worldHeaders" :key="key">
                <label>{{ key }}</label>
                <div class="field-value">{{ map.selectedWorld[key] || '—' }}</div>
              </div>
            </div>
          </section>
        </template>

        <!-- ── Market tab ────────────────────────────────────────────────── -->
        <template v-if="detailTab === 'market'">
          <div class="market-layout" ref="marketLayoutEl">
            <MarketTable
              :world="map.selectedWorld"
              :sector-name="map.selectedSectorName"
              :charted-dies="[...chartedGoods]"
              :show-buy-button="ship.hasShip && ship.canTrade"
              @select-good="onGoodSelect"
              @toggle-chart="onToggleChart"
              @buy-good="onBuyGoodDirect"
            />

            <!-- Chart: shown when any goods are checked -->
            <template v-if="chartedGoods.size > 0">
              <div class="resize-handle"
                   role="separator" tabindex="0"
                   aria-label="Resize chart panel — use arrow keys"
                   :aria-valuenow="chartHeight"
                   :aria-valuemin="MIN_CHART"
                   :aria-valuemax="600"
                   @mousedown.prevent="startResize"
                   @keydown="resizeWithKeys" />
              <PriceChart
                :world-hex="map.selectedWorld.Hex"
                :sector-name="map.selectedSectorName"
                :goods="chartedGoodsArray"
                :style="{ height: chartHeight + 'px' }"
              />
            </template>
          </div>

          <BuyDialog
            v-if="selectedGood"
            v-model="showBuyDialog"
            :good="selectedGood"
            :cargo-available="ship.cargoAvailable"
            :credits="ship.ship?.credits ?? 0"
            :loading="buyLoading"
            @confirm="onBuyConfirm"
          />
        </template>

        <!-- ── Cargo tab ─────────────────────────────────────────────────── -->
        <template v-if="detailTab === 'cargo'">
          <div class="cargo-tab-wrap">
            <CargoHold
              :world="map.selectedWorld"
              :sector-name="map.selectedSectorName"
            />
          </div>
        </template>

        <!-- ── Events tab ────────────────────────────────────────────────── -->
        <template v-if="detailTab === 'events'">
          <div class="events-tab-wrap">
            <EventsHistory
              :world-hex="map.selectedWorld.Hex"
              :sector-name="map.selectedSectorName"
            />
          </div>
        </template>

        <!-- ── Jump tab ──────────────────────────────────────────────────── -->
        <template v-if="detailTab === 'jump'">
          <div class="jump-tab-wrap">
            <RouteAnalysis
              :world="map.selectedWorld"
              :sector-name="map.selectedSectorName"
              @select-world="detailTab = 'market'"
            />
          </div>
        </template>
      </div>
    </main>
  </div>

  <!-- Dialogs -->
  <ThemeDialog     v-model="showThemes"    />
  <AboutDialog     v-model="showAbout"     />
  <HelpDialog      v-model="showHelp"      />
  <CharacterDialog v-model="showCharacter" />

  <!-- Error banner -->
  <div v-if="map.error || tick.error || ship.error" class="error-banner">
    {{ map.error || tick.error || ship.error }}
    <button @click="map.error = null; tick.error = null; ship.clearError()">✕</button>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMapStore }  from '../stores/map.js'
import { useAuthStore } from '../stores/auth.js'
import { useTickStore } from '../stores/tick.js'
import MarketTable    from '../components/MarketTable.vue'
import PriceChart     from '../components/PriceChart.vue'
import EventsHistory  from '../components/EventsHistory.vue'
import CargoHold      from '../components/CargoHold.vue'
import BuyDialog      from '../components/BuyDialog.vue'
import HamburgerMenu  from '../components/HamburgerMenu.vue'
import AboutDialog     from '../components/AboutDialog.vue'
import HelpDialog      from '../components/HelpDialog.vue'
import ThemeDialog     from '../components/ThemeDialog.vue'
import CharacterDialog from '../components/CharacterDialog.vue'
import RouteAnalysis   from '../components/RouteAnalysis.vue'
import { useShipStore } from '../stores/ship.js'

const map    = useMapStore()
const auth   = useAuthStore()
const tick   = useTickStore()
const ship   = useShipStore()
const router = useRouter()

const sectorFilter   = ref('')
const filteredSectors = computed(() => {
  const q = sectorFilter.value.trim().toLowerCase()
  return q ? map.sectors.filter(s => s.name.toLowerCase().includes(q)) : map.sectors
})

const detailTab      = ref('overview')
const selectedGood   = ref(null)
const chartedGoods   = ref(new Set())
const showAbout      = ref(false)
const showHelp       = ref(false)
const showThemes     = ref(false)
const showCharacter  = ref(false)
const showBuyDialog  = ref(false)
const buyLoading     = ref(false)

const DETAIL_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'market',   label: 'Market'   },
  { key: 'cargo',    label: 'Cargo'    },
  { key: 'events',   label: 'Events'   },
  { key: 'jump',     label: 'Jump'     },
]

function fmt(n) { return (n ?? 0).toLocaleString() }

const chartedGoodsArray = computed(() =>
  [...chartedGoods.value].map(die => ({
    die,
    name: tick.worldSnapshots[die]?.trade_good_name ?? die,
  }))
)

function onToggleChart(die) {
  const next = new Set(chartedGoods.value)
  if (next.has(die)) next.delete(die)
  else next.add(die)
  chartedGoods.value = next
}

const travellerMapUrl = computed(() => {
  const milieu  = auth.campaign?.milieu ?? 'M1105'
  const sector  = encodeURIComponent(map.selectedSectorName ?? '')
  const hex     = encodeURIComponent(map.selectedWorld?.Hex ?? '')
  return `https://travellermap.com/?milieu=${milieu}&sector=${sector}&hex=${hex}`
})

// ── Chart resize ──────────────────────────────────────────────────────────────
const marketLayoutEl = ref(null)
const chartHeight    = ref(260)
const MIN_CHART      = 80
const MIN_TABLE      = 120

let _resizeStartY = 0
let _resizeStartH = 0

function startResize(e) {
  _resizeStartY = e.clientY
  _resizeStartH = chartHeight.value
  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup',  stopResize)
}

function doResize(e) {
  const delta     = _resizeStartY - e.clientY   // drag up → chart grows
  const available = marketLayoutEl.value?.clientHeight ?? 600
  chartHeight.value = Math.max(MIN_CHART,
    Math.min(_resizeStartH + delta, available - MIN_TABLE - 10))
}

function stopResize() {
  document.removeEventListener('mousemove', doResize)
  document.removeEventListener('mouseup',  stopResize)
}

// WCAG 2.5.7: keyboard alternative for drag resize (arrow keys, 10px steps)
function resizeWithKeys(e) {
  const available = marketLayoutEl.value?.clientHeight ?? 600
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    chartHeight.value = Math.min(chartHeight.value + 10, available - MIN_TABLE - 10)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    chartHeight.value = Math.max(chartHeight.value - 10, MIN_CHART)
  }
}

onUnmounted(() => {
  document.removeEventListener('mousemove', doResize)
  document.removeEventListener('mouseup',  stopResize)
  document.removeEventListener('keydown',  handleGlobalKey)
})

// ── Global keyboard shortcuts ─────────────────────────────────────────────────
function handleGlobalKey(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'
      || e.target.isContentEditable) return
  if (showAbout.value || showHelp.value) return   // dialogs handle Esc themselves

  switch (e.key) {
    case '?': showHelp.value = true; break
    case 'o': case 'O': if (map.selectedWorld) detailTab.value = 'overview'; break
    case 'm': case 'M': if (map.selectedWorld) detailTab.value = 'market';   break
    case 'e': case 'E': if (map.selectedWorld) detailTab.value = 'events';   break
    case 'c': case 'C': if (map.selectedWorld) detailTab.value = 'cargo';    break
    case 'j': case 'J': if (map.selectedWorld) detailTab.value = 'jump';     break
    case 't': case 'T':
      if (auth.isReferee && !tick.loading) doAdvanceTick()
      break
  }
}

onMounted(async () => {
  if (auth.campaign?.milieu) map.selectedMilieu = auth.campaign.milieu
  map.loadSectors()
  await tick.loadCalendar()
  await tick.loadActiveEvents()
  ship.loadShip(auth.player?.id, auth.campaign?.id)
  document.addEventListener('keydown', handleGlobalKey)
})

// Reset selections and pre-load event history when world changes
watch(() => map.selectedWorld, (world) => {
  selectedGood.value  = null
  chartedGoods.value  = new Set()
  if (world) tick.loadWorldEventHistory(world.Hex, map.selectedSectorName)
})

function onWorldSelect(world) {
  map.selectWorld(world)
}

function onGoodSelect(row) {
  selectedGood.value = row
}

function onBuyGoodDirect(row) {
  selectedGood.value = row
  showBuyDialog.value = true
}

async function onBuyConfirm({ tons }) {
  buyLoading.value = true
  await ship.buyCargo({
    campaignId: auth.campaign.id,
    playerId:   auth.player.id,
    good:       selectedGood.value,
    tons,
    worldHex:   map.selectedWorld.Hex,
    sector:     map.selectedSectorName,
    tick:       tick.currentTick,
  })
  buyLoading.value = false
}

async function doAdvanceTick() {
  await tick.advanceTick()
}

function doLogout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<style scoped>
/* ── Header layout ─────────────────────────────────────────────────────────── */
header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1rem;
  padding: 0.55rem 1.25rem;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.campaign-label {
  font-size: 0.78rem;
  color: var(--text-dim);
  letter-spacing: 0.04em;
}

.header-center {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.imperial-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.2;
}

.date-value {
  font-family: monospace;
  font-size: 1rem;
  color: var(--code);
  letter-spacing: 0.08em;
}

.date-sub {
  font-size: 0.65rem;
  color: var(--text-dim);
  letter-spacing: 0.06em;
}

.advance-btn {
  background: var(--accent-dim);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  padding: 0.35rem 0.9rem;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: 0.04em;
  transition: background 0.15s;
  white-space: nowrap;
}

.advance-btn:hover:not(:disabled) { background: var(--accent); }
.advance-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.session-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
}

.session-char   { color: var(--text); font-weight: 500; }
.session-campaign { color: var(--text-dim); font-family: monospace; }

.role-badge {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--amber);
  border: 1px solid var(--amber);
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: 0.06em;
}


/* ── World detail header ───────────────────────────────────────────────────── */
.detail-header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4rem;
}

.uwp-link {
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.15s;
}
.uwp-link:hover { opacity: 0.8; }

/* ── Detail tabs ───────────────────────────────────────────────────────────── */
.detail-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.5rem;
}

.dtab {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-dim);
  font-size: 0.8rem;
  padding: 0.3rem 0.9rem;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.1s;
}

.dtab:hover { color: var(--text); border-color: var(--border); }
.dtab.active {
  background: var(--bg-selected);
  border-color: var(--accent-dim);
  color: var(--accent);
}

/* ── World list column header ──────────────────────────────────────────────── */
.world-list-header {
  display: flex;
  justify-content: space-between;
  padding: 0.2rem 0.6rem;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-dim);
  border-bottom: 1px solid var(--border);
  margin-bottom: 0.35rem;
}

/* ── Market tab layout ─────────────────────────────────────────────────────── */
.market-layout {
  display: flex;
  flex-direction: column;
  gap: 0;
  height: calc(100vh - 248px);
  min-height: 420px;
  overflow: hidden;
}

.resize-handle {
  flex-shrink: 0;
  height: 8px;
  cursor: row-resize;
  background: var(--border);
  border-radius: 4px;
  margin: 3px 0;
  transition: background 0.15s;
}

.resize-handle:hover { background: var(--accent-dim); }

/* ── Events tab ────────────────────────────────────────────────────────────── */
.events-tab-wrap {
  height: calc(100vh - 248px);
  min-height: 420px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── Cargo tab ─────────────────────────────────────────────────────────────── */
.cargo-tab-wrap {
  height: calc(100vh - 248px);
  min-height: 420px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── Jump tab ──────────────────────────────────────────────────────────────── */
.jump-tab-wrap {
  height: calc(100vh - 248px);
  min-height: 420px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

</style>
