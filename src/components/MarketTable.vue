<template>
  <div class="market-table-wrap">
    <!-- Events banner -->
    <div v-if="worldEvents.length" class="events-banner">
      <span class="events-label">Active Events</span>
      <div class="event-chips">
        <span v-for="ev in worldEvents" :key="ev.id" class="event-chip"
              :class="ev.effect_pct > 0 ? 'chip-up' : 'chip-down'">
          {{ ev.effect_pct > 0 ? '+' : '' }}{{ ev.effect_pct }}%
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
        <input v-model="filter" type="search" placeholder="Filter goods…" class="market-search" />
        <span class="row-count">{{ filteredRows.length }} / {{ rows.length }} goods</span>
      </div>

      <p class="chart-hint">Check a good to plot its price history below the table.</p>

      <div class="table-scroll">
        <table class="market-table">
          <thead>
            <tr>
              <th class="chart-col" title="Show on chart"></th>
              <th @click="setSort('trade_good_name')" class="sortable">
                Good {{ sortIcon('trade_good_name') }}
              </th>
              <th @click="setSort('trade_good_die')" class="sortable ctr">
                Die {{ sortIcon('trade_good_die') }}
              </th>
              <th @click="setSort('purchase_price')" class="sortable num">
                Buy (Cr/t) {{ sortIcon('purchase_price') }}
              </th>
              <th @click="setSort('sale_price')" class="sortable num">
                Sell (Cr/t) {{ sortIcon('sale_price') }}
              </th>
              <th @click="setSort('spread')" class="sortable num">
                Spread {{ sortIcon('spread') }}
              </th>
              <th @click="setSort('qty_available')" class="sortable num">
                Qty (t) {{ sortIcon('qty_available') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredRows" :key="row.trade_good_die"
                :class="['market-row', { 'row-selected': selectedDie === row.trade_good_die, 'row-event': row.hasEvent }]"
                @click="selectRow(row)">
              <td class="chart-col" @click.stop>
                <input type="checkbox"
                       :checked="chartedDies.includes(row.trade_good_die)"
                       class="chart-check"
                       @change="$emit('toggle-chart', row.trade_good_die)" />
              </td>
              <td class="good-name">{{ row.trade_good_name }}</td>
              <td class="ctr mono">{{ row.trade_good_die }}</td>
              <td class="num" :class="priceClass(row.purchase_price, 4000)">
                {{ fmt(row.purchase_price) }}
              </td>
              <td class="num" :class="priceClass(row.sale_price, 5000)">
                {{ fmt(row.sale_price) }}
              </td>
              <td class="num" :class="row.spread >= 0 ? 'pos' : 'neg'">
                {{ row.spread >= 0 ? '+' : '' }}{{ fmt(row.spread) }}
              </td>
              <td class="num">{{ row.qty_available.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useTickStore } from '../stores/tick.js'
import { CT2_TRADE_GOODS } from '../lib/traveller-data.js'

const props = defineProps({
  world:       { type: Object,  required: true },
  sectorName:  { type: String,  required: true },
  chartedDies: { type: Array,   default: () => [] },
})

const emit = defineEmits(['select-good', 'toggle-chart'])

const tick        = useTickStore()
const filter      = ref('')
const sortKey     = ref('trade_good_die')
const sortAsc     = ref(true)
const selectedDie = ref(null)

// Lookup map: goodDie → goodName
const goodNameMap = Object.fromEntries(CT2_TRADE_GOODS.map(g => [g.die, g.name]))
function goodName(die) { return goodNameMap[die] ?? die }

// ── Load snapshots when world changes ─────────────────────────────────────────
async function loadSnapshots() {
  if (!props.world?.Hex) return
  await tick.ensureWorldSnapshot(props.world, props.sectorName)
}

onMounted(loadSnapshots)
watch(() => [props.world?.Hex, props.sectorName, tick.currentTick], loadSnapshots)

// Clear row selection when world changes
watch(() => props.world?.Hex, () => { selectedDie.value = null })

// ── Active events for this world ─────────────────────────────────────────────
const worldEvents = computed(() =>
  tick.eventsForWorld(props.world?.Hex ?? '')
)

// Build a set of affected goodDie → {pct, desc} for quick row lookup
const eventIndex = computed(() => {
  const idx = {}
  for (const ev of worldEvents.value) {
    const key = ev.trade_good_die ?? '__all__'
    if (!idx[key]) idx[key] = { pct: 0, desc: ev.description }
    idx[key].pct += ev.effect_pct
  }
  return idx
})

// ── Table rows ────────────────────────────────────────────────────────────────
const rows = computed(() => {
  const snaps = Object.values(tick.worldSnapshots)
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

// ── Row selection (for buying) ────────────────────────────────────────────────
function selectRow(row) {
  selectedDie.value = row.trade_good_die
  emit('select-good', row)
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

// ── Formatting ────────────────────────────────────────────────────────────────
function fmt(n) { return n.toLocaleString() }

// Price color: compare to CT7 base price (green = below base, red = above)
function priceClass(price, base) {
  const ratio = price / base
  if (ratio < 0.85) return 'price-low'
  if (ratio > 1.15) return 'price-high'
  return 'price-mid'
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

.chart-hint {
  font-size: 0.72rem;
  color: var(--text-dim);
  font-style: italic;
  margin: 0;
}

/* Table */
.table-scroll {
  overflow-y: auto;
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

.pos { color: var(--green); }
.neg { color: var(--red); }


.market-placeholder {
  color: var(--text-dim);
  font-size: 0.85rem;
  padding: 1.5rem 0;
  text-align: center;
}
</style>
