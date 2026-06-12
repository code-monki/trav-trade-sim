<template>
  <div class="chart-wrap">
    <div class="chart-header">
      <div class="chart-title">
        <span class="good-name">{{ goodName }}</span>
        <span class="good-die mono">{{ goodDie }}</span>
      </div>
      <div class="chart-tabs">
        <button v-for="t in TABS" :key="t.key"
                :class="['ctab', { active: activeTab === t.key }]"
                @click="setTab(t.key)">
          {{ t.label }}
        </button>
      </div>
    </div>

    <div v-if="tick.loading" class="chart-placeholder">Loading price history…</div>
    <div v-else-if="!hasData" class="chart-placeholder">
      No history yet — visit this world each tick to record prices.
    </div>
    <div ref="chartEl" class="chart-el" v-show="hasData && !tick.loading"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { createChart, ColorType } from 'lightweight-charts'
import { useTickStore } from '../stores/tick.js'
import { formatImperialDate, tickToCalendar } from '../lib/market-tick.js'

const props = defineProps({
  worldHex:   { type: String, required: true },
  sectorName: { type: String, required: true },
  goodDie:    { type: String, required: true },
  goodName:   { type: String, default: '' },
})

const tick    = useTickStore()
const chartEl = ref(null)
const activeTab = ref('weekly')
const hasData   = ref(false)

const TABS = [
  { key: 'weekly',  label: 'Weekly'  },
  { key: 'monthly', label: 'Monthly' },
  { key: 'annual',  label: 'Annual'  },
]

// ── Time conversion helpers ───────────────────────────────────────────────────
// Proxy: Imperial tick 0 → 1985-01-07; each tick = 7 days.
const BASE_MS  = new Date('1985-01-07').getTime()
const BASE_SEC = BASE_MS / 1000

function tickToDateStr(t) {
  return new Date(BASE_MS + t * 7 * 86400000).toISOString().slice(0, 10)
}

function monthToDateStr(year, month) {
  const y = 1985 + (year - 1105)
  return `${y}-${String(month).padStart(2, '0')}-01`
}

// Convert proxy date back to an Imperial date label.
// lightweight-charts passes a BusinessDay {year,month,day} for YYYY-MM-DD data,
// or a UTCTimestamp (seconds) for time-series data.
function imperialTickMark(ts, type) {
  const ms = (typeof ts === 'object' && ts !== null)
    ? Date.UTC(ts.year, ts.month - 1, ts.day)
    : ts * 1000
  const t = Math.max(0, Math.round((ms - BASE_MS) / (7 * 86400000)))
  const { year, day, month } = tickToCalendar(t)
  if (type === 0) return `${year}`
  if (type === 1) return `M${String(month).padStart(2, '0')}-${year}`
  return `${String(day).padStart(3, '0')}-${year}`
}

// ── Chart instance ────────────────────────────────────────────────────────────
let chart  = null
let series = null
let ro     = null

function imperialDateStr(ts) {
  const ms = (typeof ts === 'object' && ts !== null)
    ? Date.UTC(ts.year, ts.month - 1, ts.day)
    : ts * 1000
  const t = Math.max(0, Math.round((ms - BASE_MS) / (7 * 86400000)))
  return formatImperialDate(t)
}

const CHART_OPTS = {
  layout: {
    background: { type: ColorType.Solid, color: '#13162a' },
    textColor: '#6b789a',
  },
  grid: {
    vertLines: { color: '#1a1e36' },
    horzLines: { color: '#1a1e36' },
  },
  crosshair: { vertLine: { color: '#2a3050' }, horzLine: { color: '#2a3050' } },
  rightPriceScale: { borderColor: '#2a3050' },
  timeScale: {
    borderColor: '#2a3050',
    timeVisible: false,
    tickMarkFormatter: imperialTickMark,
  },
  localization: {
    timeFormatter: imperialDateStr,
  },
}

const CANDLE_OPTS = {
  upColor:       '#4caf72',
  downColor:     '#d93a3a',
  borderVisible: false,
  wickUpColor:   '#4caf72',
  wickDownColor: '#d93a3a',
}

const LINE_OPTS = {
  color: '#7ec8e3',
  lineWidth: 2,
  crosshairMarkerVisible: true,
  crosshairMarkerRadius: 4,
}

function initChart() {
  if (!chartEl.value) return
  chart?.remove()
  const w = chartEl.value.clientWidth  || 400
  const h = chartEl.value.clientHeight || 200
  chart  = createChart(chartEl.value, { ...CHART_OPTS, width: w, height: h })
  series = null

  ro = new ResizeObserver(() => {
    if (chartEl.value) {
      chart?.applyOptions({
        width:  chartEl.value.clientWidth  || 400,
        height: chartEl.value.clientHeight || 200,
      })
    }
  })
  ro.observe(chartEl.value)
}

function destroyChart() {
  ro?.disconnect()
  chart?.remove()
  chart = series = ro = null
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadData() {
  if (!chart) return

  series?.remove?.()
  series = null

  if (activeTab.value === 'weekly') {
    const raw = await tick.loadWeeklyHistory(props.worldHex, props.sectorName, props.goodDie)
    hasData.value = raw.length > 0
    if (!raw.length) return
    series = chart.addLineSeries(LINE_OPTS)
    series.setData(raw.map(r => ({ time: tickToDateStr(r.tick), value: r.purchase_price })))

  } else if (activeTab.value === 'monthly') {
    const raw = await tick.loadMonthlyHistory(props.worldHex, props.sectorName, props.goodDie)
    hasData.value = raw.length > 0
    if (!raw.length) return
    series = chart.addCandlestickSeries(CANDLE_OPTS)
    series.setData(raw.map(r => ({
      time:  monthToDateStr(r.year, r.month),
      open:  r.open_price,
      high:  r.high_price,
      low:   r.low_price,
      close: r.close_price,
    })))

  } else {
    const raw = await tick.loadAnnualHistory(props.worldHex, props.sectorName, props.goodDie)
    hasData.value = raw.length > 0
    if (!raw.length) return
    series = chart.addCandlestickSeries(CANDLE_OPTS)
    series.setData(raw.map(r => ({
      time:  `${1985 + (r.year - 1105)}-01-01`,
      open:  r.open_price,
      high:  r.high_price,
      low:   r.low_price,
      close: r.close_price,
    })))
  }

  chart.timeScale().fitContent()
}

async function setTab(key) {
  activeTab.value = key
  await nextTick()
  initChart()
  await loadData()
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  await nextTick()
  initChart()
  await loadData()
})

onUnmounted(destroyChart)

watch(
  () => [props.worldHex, props.goodDie, tick.currentTick],
  async () => {
    await nextTick()
    if (!chart) initChart()
    await loadData()
  },
)
</script>

<style scoped>
.chart-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.75rem;
  flex-shrink: 0;
  overflow: hidden;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  flex-shrink: 0;
}

.chart-title {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.good-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
}

.mono {
  font-family: monospace;
  font-size: 0.72rem;
  color: var(--text-dim);
  background: var(--bg-item);
  padding: 1px 6px;
  border-radius: 3px;
}

.chart-tabs { display: flex; gap: 0.25rem; }

.ctab {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 0.72rem;
  padding: 3px 10px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.1s;
}

.ctab:hover { border-color: var(--accent-dim); color: var(--text); }
.ctab.active { background: var(--bg-selected); border-color: var(--accent-dim); color: var(--accent); }

/* chart-el fills whatever height the parent leaves after the header */
.chart-el {
  width: 100%;
  flex: 1;
  min-height: 0;
}

.chart-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
  font-size: 0.85rem;
  min-height: 120px;
}
</style>
