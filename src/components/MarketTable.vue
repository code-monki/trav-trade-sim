<template>
  <div class="market-table-wrap">
    <!-- Events banner -->
    <div v-if="worldEvents.length" class="events-banner">
      <span class="events-label">Active Events</span>
      <div class="event-chips">
        <span v-for="ev in worldEvents" :key="ev.id" class="event-chip"
              :class="(ev.sell_modifier_pct ?? ev.buy_modifier_pct ?? 0) > 0 ? 'chip-up' : 'chip-down'">
          <template v-if="ev.buy_modifier_pct != null">Buy {{ ev.buy_modifier_pct > 0 ? '+' : '' }}{{ ev.buy_modifier_pct }}%</template>
          <template v-if="ev.buy_modifier_pct != null && ev.sell_modifier_pct != null"> · </template>
          <template v-if="ev.sell_modifier_pct != null">Sell {{ ev.sell_modifier_pct > 0 ? '+' : '' }}{{ ev.sell_modifier_pct }}%</template>
          {{ ev.trade_good_die ? `· ${goodName(ev.trade_good_die)}` : '· all goods' }}
          — {{ ev.description }}
        </span>
      </div>
    </div>

    <!-- Loading / empty state -->
    <div v-if="tick.loading" class="market-placeholder">Generating market data…</div>
    <div v-else-if="!rows.length" class="market-placeholder">No market data</div>

    <!-- Table -->
    <template v-else>
      <div class="table-controls">
        <input v-model="filter" type="search" placeholder="Filter goods…" class="market-search"
               aria-label="Filter trade goods" />
        <span class="row-count">{{ filteredRows.length }} / {{ rows.length }} goods</span>
        <template v-if="auth.campaign?.trade_rules === 'MgT2022'">
          <button v-if="tick.blackMarketFound" class="compare-btn"
                  :class="{ active: viewingBlackMarket }"
                  :aria-pressed="viewingBlackMarket"
                  @click="toggleBlackMarketView">
            Black Market
          </button>
          <button v-else class="compare-btn" :disabled="blackMarketLoading" @click="onSeekBlackMarket">
            {{ blackMarketLoading ? 'Seeking…' : 'Seek Black Market' }}
          </button>
        </template>
        <button v-if="mobile" class="compare-btn"
                :class="{ active: compareMode }"
                :aria-pressed="compareMode"
                @click="toggleCompareMode">
          Compare
        </button>
      </div>
      <p v-if="auth.campaign?.trade_rules === 'MgT2022' && !tick.blackMarketFound && tick.blackMarketAttempts > 0"
         class="hint">
        Previous attempts this month: {{ tick.blackMarketAttempts }} (DM&minus;{{ tick.blackMarketAttempts }} on the next roll)
      </p>
      <p v-if="blackMarketResult === 'fail'" class="form-error">
        No contact this time — try again, or wait for a new month.
      </p>

      <div class="table-scroll">
        <table class="market-table">
          <thead>
            <tr>
              <th v-if="!mobile" class="chart-col">Plot</th>
              <th v-else-if="compareMode" class="chart-col compare-col">
                <span class="sr-only">Plotted</span>
              </th>
              <th @click="setSort('trade_good_name')" @keydown.enter.space.prevent="setSort('trade_good_name')"
                  class="sortable" tabindex="0" :aria-sort="ariaSort('trade_good_name')">
                Good {{ sortIcon('trade_good_name') }}
              </th>
              <th @click="setSort('trade_good_die')" @keydown.enter.space.prevent="setSort('trade_good_die')"
                  class="sortable ctr" tabindex="0" :aria-sort="ariaSort('trade_good_die')">
                Die {{ sortIcon('trade_good_die') }}
              </th>
              <th @click="setSort('purchase_price')" @keydown.enter.space.prevent="setSort('purchase_price')"
                  class="sortable num" tabindex="0" :aria-sort="ariaSort('purchase_price')">
                Buy (Cr/t) {{ sortIcon('purchase_price') }}
              </th>
              <template v-if="showSellColumns">
                <th @click="setSort('sale_price')" @keydown.enter.space.prevent="setSort('sale_price')"
                    class="sortable num" tabindex="0" :aria-sort="ariaSort('sale_price')">
                  Sell (Cr/t) {{ sortIcon('sale_price') }}
                </th>
                <th @click="setSort('spread')" @keydown.enter.space.prevent="setSort('spread')"
                    class="sortable num" tabindex="0" :aria-sort="ariaSort('spread')">
                  Spread {{ sortIcon('spread') }}
                </th>
              </template>
              <th @click="setSort('qty_available')" @keydown.enter.space.prevent="setSort('qty_available')"
                  class="sortable num" tabindex="0" :aria-sort="ariaSort('qty_available')">
                Qty (t) {{ sortIcon('qty_available') }}
              </th>
              <th v-if="showBuyButton"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredRows" :key="row.trade_good_die"
                :class="['market-row', {
                  'row-selected': !inCompare && selectedDie === row.trade_good_die,
                  'row-charted':  inCompare && isCharted(row),
                  'row-event':    row.hasEvent,
                }]"
                tabindex="0" role="button"
                :aria-pressed="inCompare ? isCharted(row) : selectedDie === row.trade_good_die"
                :aria-label="inCompare
                  ? `Plot ${row.trade_good_name} on the price chart`
                  : `Select ${row.trade_good_name} for purchase`"
                @click="activateRow(row)"
                @keydown.enter.space.prevent="activateRow(row)"
                @keydown="rowNavKeys"
                @touchstart="rowTouchStart(row)"
                @touchmove="rowTouchCancel"
                @touchend="rowTouchCancel">
              <td v-if="!mobile" class="chart-col" @click.stop>
                <input type="checkbox"
                       :checked="isCharted(row)"
                       class="chart-check"
                       :aria-label="`Plot ${row.trade_good_name} on the price chart`"
                       @change="$emit('toggle-chart', row.trade_good_die)"
                       @keydown.stop />
              </td>
              <td v-else-if="compareMode" class="chart-col compare-col">
                <span class="compare-mark" :class="{ on: isCharted(row) }" aria-hidden="true">
                  {{ isCharted(row) ? '✓' : '' }}
                </span>
              </td>
              <td class="good-name">{{ row.trade_good_name }}</td>
              <td class="ctr mono">{{ row.trade_good_die }}</td>
              <td class="num" :class="purchaseInfo(row).cls">
                <span class="price-indicator" aria-hidden="true">{{ purchaseInfo(row).symbol }}</span>
                <span class="sr-only">{{ purchaseInfo(row).label }}</span>
                {{ fmt(row.purchase_price) }}
              </td>
              <template v-if="showSellColumns">
                <td class="num" :class="saleInfo(row).cls">
                  <span class="price-indicator" aria-hidden="true">{{ saleInfo(row).symbol }}</span>
                  <span class="sr-only">{{ saleInfo(row).label }}</span>
                  {{ fmt(row.sale_price) }}
                </td>
                <td class="num" :class="row.spread >= 0 ? 'pos' : 'neg'">
                  {{ row.spread >= 0 ? '+' : '' }}{{ fmt(row.spread) }}
                </td>
              </template>
              <td class="num">{{ row.qty_available.toLocaleString() }}</td>
              <td v-if="showBuyButton" class="buy-col" @click.stop>
                <button class="buy-row-btn"
                        :disabled="row.qty_available <= 0"
                        @click="$emit('buy-good', row)">
                  Buy
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile compare toolbar: selection count + chart access -->
      <div v-if="mobile && (compareMode || chartedDies.length > 0)" class="compare-toolbar">
        <span class="compare-count" aria-live="polite">
          {{ chartedDies.length }} plotted
        </span>
        <button v-if="chartedDies.length" class="toolbar-btn" @click="$emit('clear-chart')">
          Clear
        </button>
        <button class="toolbar-btn primary"
                :disabled="!chartedDies.length"
                @click="$emit('view-chart')">
          View chart
        </button>
        <button v-if="compareMode" class="toolbar-btn" @click="compareMode = false">
          Done
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useTickStore } from '../stores/tick.js'
import { useAuthStore } from '../stores/auth.js'
import { CT2_TRADE_GOODS } from '../lib/traveller-data.js'
import { MGT2022_TRADE_GOODS } from '../lib/traveller-data-mgt2022.js'
import { starportFromUWP } from '../lib/trade-engine-ct7.js'
import { starportBrokerDM } from '../lib/trade-engine-mgt2022.js'

const props = defineProps({
  world:         { type: Object,  required: true },
  sectorName:    { type: String,  required: true },
  chartedDies:   { type: Array,   default: () => [] },
  showBuyButton: { type: Boolean, default: false },
  // Narrow-viewport mode: the permanent Plot checkbox column is replaced by a
  // contextual Compare mode (header toggle or long-press) with a toolbar.
  mobile:        { type: Boolean, default: false },
})

const emit = defineEmits(['select-good', 'toggle-chart', 'buy-good', 'view-chart', 'clear-chart'])

const tick        = useTickStore()
const auth        = useAuthStore()
const filter      = ref('')
const sortKey     = ref('trade_good_die')
const sortAsc     = ref(true)
const selectedDie = ref(null)
const compareMode = ref(false)

const inCompare = computed(() => props.mobile && compareMode.value)

// CT7's real sell price depends on BOTH the world a cargo lot was bought
// at and the world it's sold at (Book 7's Cost of Goods/Market Price
// mechanic) — there's no meaningful "sell here" number for a good you
// haven't bought yet, since you don't know where you'll eventually sell
// it. Showing one anyway (as this table used to, self-referencing the
// current world as both source and market) implied an achievable price
// that mostly isn't. Real per-lot sell prices belong on RouteAnalysis.vue
// (Jump tab, HLD §7) and CargoHold.vue, which both know the lot's actual
// purchase world. MgT2022 has no such duality — its sell price is a
// genuine single-world property — so it keeps both columns.
const showSellColumns = computed(() => auth.campaign?.trade_rules !== 'CT7')

watch(showSellColumns, (shown) => {
  if (!shown && (sortKey.value === 'sale_price' || sortKey.value === 'spread')) sortKey.value = 'trade_good_die'
})

function isCharted(row) { return props.chartedDies.includes(row.trade_good_die) }

function toggleCompareMode() { compareMode.value = !compareMode.value }

// Leaving mobile (rotation / resize to desktop) exits compare mode — the
// checkbox column takes over again.
watch(() => props.mobile, (m) => { if (!m) compareMode.value = false })

// Lookup map: goodDie → goodName
const goodNameMap = Object.fromEntries(CT2_TRADE_GOODS.map(g => [g.die, g.name]))
function goodName(die) { return goodNameMap[die] ?? die }

// Lookup map: goodDie → basePriceCr, for MgT2022's price-color reference
// (see priceInfo below) — CT7's costOfGoods()/marketBasePrice() base
// constants (4000/5000) are meaningless for MgT2022's per-good base prices.
const mgt2022BaseByDie = Object.fromEntries(MGT2022_TRADE_GOODS.map(g => [g.die, g.basePriceCr]))

// ── Load snapshots when world changes ─────────────────────────────────────────
async function loadSnapshots() {
  if (!props.world?.Hex) return
  await tick.ensureWorldSnapshot(props.world, props.sectorName)
  if (viewingBlackMarket.value) await tick.ensureBlackMarketSnapshot(props.world, props.sectorName)
}

onMounted(loadSnapshots)
watch(() => [props.world?.Hex, props.sectorName, tick.currentTick], loadSnapshots)

// Clear row selection and the black-market view when world changes — a new
// world's black-market status hasn't been checked yet (MapView resets
// tick.blackMarketFound on its own world-change watcher).
watch(() => props.world?.Hex, () => { selectedDie.value = null; viewingBlackMarket.value = false })

// ── Black Market (MgT2022) ──────────────────────────────────────────────────
// Ship-wide one-click check (see tick.js) — success unlocks a toggle here to
// switch the table between the normal and black-market row sets.
const viewingBlackMarket  = ref(false)
const blackMarketLoading  = ref(false)
const blackMarketResult   = ref(null) // null | 'fail'

const starportDM = computed(() => starportBrokerDM(starportFromUWP(props.world?.UWP ?? '')))

async function onSeekBlackMarket() {
  blackMarketLoading.value = true
  blackMarketResult.value  = null
  const result = await tick.attemptBlackMarket(props.world.Hex, props.sectorName, {
    starportDM: starportDM.value,
  })
  blackMarketLoading.value = false
  if (!result.success) { blackMarketResult.value = 'fail'; return }
  await toggleBlackMarketView()
}

async function toggleBlackMarketView() {
  viewingBlackMarket.value = !viewingBlackMarket.value
  if (viewingBlackMarket.value) await tick.ensureBlackMarketSnapshot(props.world, props.sectorName)
}

// ── Active events for this world ─────────────────────────────────────────────
const worldEvents = computed(() =>
  tick.eventsForWorld(props.world?.Hex ?? '', props.sectorName ?? '')
)

// Build a set of affected goodDie → {pct, desc} for quick row lookup
const eventIndex = computed(() => {
  const idx = {}
  for (const ev of worldEvents.value) {
    const key = ev.trade_good_die ?? '__all__'
    if (!idx[key]) idx[key] = { pct: 0, desc: ev.description }
    idx[key].pct += ev.sell_modifier_pct ?? ev.buy_modifier_pct ?? 0
  }
  return idx
})

// ── Table rows ────────────────────────────────────────────────────────────────
const rows = computed(() => {
  const source = viewingBlackMarket.value ? tick.displayBlackMarketSnapshots : tick.displaySnapshots
  const snaps  = Object.values(source)
  if (!snaps.length) return []

  return snaps.map(s => {
    const hasEvent = !!(eventIndex.value[s.trade_good_die] ?? eventIndex.value['__all__'])
    return {
      ...s,
      spread: s.sale_price - s.purchase_price,
      hasEvent,
    }
  })
})

const filteredRows = computed(() => {
  let r = rows.value
  if (filter.value.trim()) {
    const q = filter.value.toLowerCase()
    r = r.filter(row =>
      row.trade_good_name.toLowerCase().includes(q) ||
      row.trade_good_die.includes(q)
    )
  }
  return [...r].sort((a, b) => {
    const av = a[sortKey.value]
    const bv = b[sortKey.value]
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
    return sortAsc.value ? cmp : -cmp
  })
})

// ── Row activation ────────────────────────────────────────────────────────────
// Normal mode: select the good for purchase. Compare mode (mobile): the whole
// row is a tap target that toggles the good on the price chart.
function activateRow(row) {
  if (longPressFired) { longPressFired = false; return }
  if (inCompare.value) { emit('toggle-chart', row.trade_good_die); return }
  selectRow(row)
}

function selectRow(row) {
  selectedDie.value = row.trade_good_die
  emit('select-good', row)
}

// Long-press on a row (mobile, outside compare mode) enters compare mode and
// plots that row's good.
let longPressTimer = null
let longPressFired = false

function rowTouchStart(row) {
  longPressFired = false
  if (!props.mobile || compareMode.value) return
  clearTimeout(longPressTimer)
  longPressTimer = setTimeout(() => {
    longPressFired    = true
    compareMode.value = true
    emit('toggle-chart', row.trade_good_die)
  }, 500)
}

function rowTouchCancel() { clearTimeout(longPressTimer) }

// Arrow keys move focus between rows (keyboard parity with the tap targets).
function rowNavKeys(e) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  e.preventDefault()
  const sibling = e.key === 'ArrowDown'
    ? e.currentTarget.nextElementSibling
    : e.currentTarget.previousElementSibling
  sibling?.focus()
}

// ── Sort ──────────────────────────────────────────────────────────────────────
function setSort(key) {
  if (sortKey.value === key) sortAsc.value = !sortAsc.value
  else { sortKey.value = key; sortAsc.value = true }
}
function sortIcon(key) {
  if (sortKey.value !== key) return ''
  return sortAsc.value ? '↑' : '↓'
}
function ariaSort(key) {
  if (sortKey.value !== key) return 'none'
  return sortAsc.value ? 'ascending' : 'descending'
}

// ── Formatting ────────────────────────────────────────────────────────────────
function fmt(n) { return n.toLocaleString() }

// Price vs. base: colour AND a symbol/label pair, so the signal isn't
// colour-only (WCAG 2.2 SC 1.4.1) — ▼ below base (buyer's market),
// ▲ above base (seller's market). CT7's costOfGoods()/marketBasePrice()
// constants are 4000/5000, so those hardcoded defaults are correct for
// CT7 (and used as-is for T5, which has no distinct base of its own in
// this app) — but meaningless for MgT2022, whose per-good basePriceCr
// ranges 20,000–150,000+, so MgT2022 rows compare against their own good's
// base price instead.
function purchaseInfo(row) {
  const base = auth.campaign?.trade_rules === 'MgT2022' ? mgt2022BaseByDie[row.trade_good_die] ?? 4000 : 4000
  return priceInfo(row.purchase_price, base)
}
function saleInfo(row) {
  const base = auth.campaign?.trade_rules === 'MgT2022' ? mgt2022BaseByDie[row.trade_good_die] ?? 5000 : 5000
  return priceInfo(row.sale_price, base)
}
function priceInfo(price, base) {
  const ratio = price / base
  if (ratio < 0.85) return { cls: 'price-low', symbol: '▼', label: 'Below base price: ' }
  if (ratio > 1.15) return { cls: 'price-high', symbol: '▲', label: 'Above base price: ' }
  return { cls: 'price-mid', symbol: '', label: '' }
}
</script>

<style scoped>
.market-table-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
  min-height: 0;
}

/* Events banner */
.events-banner {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background: rgba(232, 160, 32, 0.07);
  border: 1px solid rgba(232, 160, 32, 0.3);
  border-radius: var(--radius);
  padding: 0.6rem 0.85rem;
}

.events-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--amber);
  font-weight: 600;
}

.event-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }

.event-chip {
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid;
}

.chip-up   { color: var(--red);   border-color: var(--red);   background: rgba(217,58,58,.08); }
.chip-down { color: var(--green); border-color: var(--green); background: rgba(76,175,114,.08); }

/* Controls */
.table-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.market-search {
  flex: 1;
  background: var(--bg-item);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.35rem 0.6rem;
  font-size: 0.82rem;
  outline: none;
}

.market-search:focus { border-color: var(--accent-dim); }

.row-count { font-size: 0.72rem; color: var(--text-dim); white-space: nowrap; }

.hint { font-size: 0.72rem; color: var(--text-dim); font-style: italic; margin: 0; }
.form-error { font-size: 0.78rem; color: var(--red, #e05); margin: 0; }

/* Table */
.table-scroll {
  overflow-y: auto;
  overscroll-behavior: contain;
  flex: 1;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.market-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.market-table thead {
  position: sticky;
  top: 0;
  background: var(--bg-panel);
  z-index: 1;
}

.market-table th {
  padding: 0.45rem 0.75rem;
  text-align: left;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-dim);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.market-table th.sortable { cursor: pointer; user-select: none; }
.market-table th.sortable:hover { color: var(--text); }
.market-table th.num { text-align: right; }
.market-table th.ctr { text-align: center; }
.market-table td.ctr { text-align: center; }

.chart-col {
  width: 2rem;
  text-align: center;
  padding: 0.4rem 0.4rem 0.4rem 0.6rem !important;
}

.chart-check {
  width: 0.9rem;
  height: 0.9rem;
  cursor: pointer;
  accent-color: var(--accent);
  margin: 0;
  display: block;
}

.market-row {
  cursor: pointer;
  border-bottom: 1px solid rgba(42, 48, 80, 0.5);
  transition: background 0.1s;
}

.market-row:hover { background: var(--bg-item); }
.market-row.row-selected { background: var(--bg-selected); }
.market-row.row-event { border-left: 2px solid var(--amber); }

.market-table td {
  padding: 0.4rem 0.75rem;
  vertical-align: middle;
}

.market-table td.num { text-align: right; }
.market-table td.mono { font-family: monospace; }

.good-name { font-weight: 500; }

/* Price colors */
.price-low  { color: var(--green); }
.price-mid  { color: var(--text); }
.price-high { color: var(--red); }

.price-indicator { display: inline-block; width: 0.9em; font-size: 0.75em; }

.pos { color: var(--green); }
.neg { color: var(--red); }


.market-placeholder {
  color: var(--text-dim);
  font-size: 0.85rem;
  padding: 1.5rem 0;
  text-align: center;
}

.buy-col {
  width: 4rem;
  text-align: center;
  padding: 0.25rem 0.5rem !important;
}

.buy-row-btn {
  background: var(--accent-dim);
  color: var(--accent-text);
  border: none;
  border-radius: var(--radius);
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: 0.04em;
  white-space: nowrap;
  transition: background 0.15s;
}

.buy-row-btn:hover:not(:disabled) { background: var(--accent); }
.buy-row-btn:disabled { opacity: 0.35; cursor: not-allowed; }

/* ── Mobile compare mode ────────────────────────────────────────────────────── */
.compare-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 0.75rem;
  padding: 0.35rem 0.7rem;
  min-height: 2rem;
  border-radius: var(--radius);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.1s;
}

.compare-btn.active {
  background: var(--bg-selected);
  border-color: var(--accent-dim);
  color: var(--accent);
}

.compare-col { width: 2rem; }

.compare-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.15rem;
  height: 1.15rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.8rem;
  color: var(--accent-text);
  margin: 0 auto;
}

.compare-mark.on {
  background: var(--accent);
  border-color: var(--accent);
}

.row-charted { background: var(--bg-selected); }

.compare-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  padding: 0.4rem 0.2rem;
}

.compare-count {
  flex: 1;
  font-size: 0.78rem;
  color: var(--text-dim);
}

.toolbar-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 0.8rem;
  padding: 0.5rem 0.9rem;
  min-height: 44px;
  border-radius: var(--radius);
  cursor: pointer;
}

.toolbar-btn.primary {
  background: var(--accent-dim);
  border-color: var(--accent-dim);
  color: var(--accent-text);
  font-weight: 600;
}

.toolbar-btn:disabled { opacity: 0.35; cursor: not-allowed; }

/* Bigger row tap targets while selecting on a touch screen */
@media (max-width: 640px) {
  .market-table td { padding: 0.65rem 0.75rem; }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
