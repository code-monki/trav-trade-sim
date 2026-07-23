<template>
  <div class="chart-wrap">
    <div class="chart-header">
      <div class="chart-legend">
        <span v-if="!props.goods.length" class="legend-empty">
          Check goods in the table to plot price history
        </span>
        <span v-for="(g, i) in props.goods" :key="g.die" class="legend-item">
          <span class="legend-dot" :style="{ background: palette[i % palette.length] }"></span>
          {{ g.name }}
        </span>
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
    <div v-else-if="!props.goods.length" class="chart-placeholder">No goods selected</div>
    <div v-else-if="!hasData" class="chart-placeholder">
      <template v-if="activeTab === 'realized'">No realized trades at this world yet.</template>
      <template v-else>No history yet — visit this world each tick to record prices.</template>
    </div>
    <div ref="chartEl" class="chart-el" aria-hidden="true"
         v-show="props.goods.length && hasData && !tick.loading"></div>
    <p class="sr-only" aria-live="polite">
      {{ chartSummary }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts'
import { useTickStore }  from '../stores/tick.js'
import { useThemeStore } from '../stores/theme.js'
import { useAuthStore }  from '../stores/auth.js'
import { api }           from '../lib/api.js'
import { formatImperialDate, tickToCalendar } from '../lib/market-tick.js'

const props = defineProps({
  worldHex:   { type: String,  required: true },
  sectorName: { type: String,  required: true },
  goods:      { type: Array,   default: () => [] },  // [{ die, name }]
  // While true (bottom sheet dragging/animating), chart gestures are disabled
  // and the canvas is not resized; a single resize happens when it flips back.
  paused:     { type: Boolean, default: false },
  // Mobile bottom-sheet mode: vertical touch drags belong to the sheet, so the
  // chart only pans horizontally, and the crosshair snaps to data points.
  sheetMode:  { type: Boolean, default: false },
})

const tick       = useTickStore()
const themeStore = useThemeStore()
const auth       = useAuthStore()
const chartEl    = ref(null)
const activeTab  = ref('weekly')
const hasData    = ref(false)

const TABS = [
  { key: 'weekly',   label: 'Weekly'   },
  { key: 'monthly',  label: 'Monthly'  },
  { key: 'annual',   label: 'Annual'   },
  { key: 'realized', label: 'Realized' },
]

// Visually distinct colors for overlaid series
const palette = [
  '#60a5fa',  // blue
  '#fbbf24',  // amber
  '#34d399',  // emerald
  '#f87171',  // red
  '#a78bfa',  // violet
  '#22d3ee',  // cyan
]

// ── Time helpers ──────────────────────────────────────────────────────────────
const BASE_SEC      = new Date('1985-01-07').getTime() / 1000
const SECS_PER_TICK = 7 * 86400

function tickToTime(t)            { return BASE_SEC + t * SECS_PER_TICK }
function monthToTime(year, month) { return BASE_SEC + ((year-1105)*48 + (month-1)*4) * SECS_PER_TICK }
function yearToTime(year)         { return BASE_SEC + (year-1105)*48 * SECS_PER_TICK }
function tsToTick(ts)             { return Math.max(0, Math.round((ts - BASE_SEC) / SECS_PER_TICK)) }

function imperialTickMark(ts, type) {
  const { year, day, month } = tickToCalendar(tsToTick(ts))
  if (type === 0) return `${year}`
  if (type === 1) return `M${String(month).padStart(2,'0')}-${year}`
  return `${String(day).padStart(3,'0')}-${year}`
}

function imperialDateStr(ts) { return formatImperialDate(tsToTick(ts)) }

// ── Theme helpers ─────────────────────────────────────────────────────────────
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function chartOpts() {
  return {
    layout: {
      background: { type: ColorType.Solid, color: cssVar('--bg-panel') },
      textColor:  cssVar('--text-dim'),
    },
    grid: {
      vertLines: { color: cssVar('--bg-item') },
      horzLines: { color: cssVar('--bg-item') },
    },
    crosshair: {
      vertLine: { color: cssVar('--border') },
      horzLine: { color: cssVar('--border') },
      ...(props.sheetMode ? { mode: CrosshairMode.Magnet } : {}),
    },
    rightPriceScale: { borderColor: cssVar('--border') },
    timeScale: {
      borderColor:       cssVar('--border'),
      timeVisible:       false,
      tickMarkFormatter: imperialTickMark,
    },
    localization: { timeFormatter: imperialDateStr },
  }
}

function candleOpts(color) {
  return {
    upColor:       color ?? cssVar('--green'),
    downColor:     color ?? cssVar('--red'),
    borderVisible: false,
    wickUpColor:   color ?? cssVar('--green'),
    wickDownColor: color ?? cssVar('--red'),
  }
}

function lineOpts(color) {
  return {
    color,
    lineWidth:              2,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius:  4,
  }
}

// ── Chart instance ────────────────────────────────────────────────────────────
let chart     = null
let seriesMap = new Map()   // die → series
let ro        = null

function interactionOpts() {
  const on = !props.paused
  return {
    handleScroll: {
      horzTouchDrag:    on,
      vertTouchDrag:    on && !props.sheetMode,
      mouseWheel:       on,
      pressedMouseMove: on,
    },
    handleScale: {
      pinch:                on,
      mouseWheel:           on,
      axisPressedMouseMove: on,
    },
  }
}

function applySize() {
  if (!chart || !chartEl.value) return
  chart.applyOptions({
    width:  chartEl.value.clientWidth  || 400,
    height: chartEl.value.clientHeight || 200,
  })
}

function initChart() {
  if (!chartEl.value) return
  destroyChart()
  const w = chartEl.value.clientWidth  || 400
  const h = chartEl.value.clientHeight || 200
  chart = createChart(chartEl.value, {
    ...chartOpts(),
    ...interactionOpts(),
    width:  w,
    height: h,
  })

  ro = new ResizeObserver(() => { if (!props.paused) applySize() })
  ro.observe(chartEl.value)
}

function destroyChart() {
  ro?.disconnect()
  chart?.remove()
  chart = null
  seriesMap.clear()
  ro = null
}

// ── Series management ─────────────────────────────────────────────────────────
async function loadSeriesData(series, goodDie) {
  if (activeTab.value === 'weekly') {
    const raw = await tick.loadWeeklyHistory(props.worldHex, props.sectorName, goodDie)
    if (!raw.length) return false
    series.setData(raw.map(r => ({ time: tickToTime(r.tick), value: r.purchase_price })))
  } else if (activeTab.value === 'monthly') {
    const raw = await tick.loadMonthlyHistory(props.worldHex, props.sectorName, goodDie)
    if (!raw.length) return false
    if (props.goods.length === 1) {
      series.setData(raw.map(r => ({
        time:  monthToTime(r.year, r.month),
        open:  r.open_price,
        high:  r.high_price,
        low:   r.low_price,
        close: r.close_price,
      })))
    } else {
      series.setData(raw.map(r => ({ time: monthToTime(r.year, r.month), value: r.close_price })))
    }
  } else if (activeTab.value === 'realized') {
    const { data: raw } = await api.get(`/api/campaigns/${auth.campaign?.id}/market/realized`, {
      world_hex: props.worldHex,
      sector:    props.sectorName,
      good_die:  goodDie,
    })
    if (!raw?.length) return false
    if (props.goods.length === 1) {
      series.setData(raw.map(r => ({
        time:  monthToTime(r.year, r.month),
        open:  r.open_price,
        high:  r.high_price,
        low:   r.low_price,
        close: r.close_price,
      })))
    } else {
      series.setData(raw.map(r => ({ time: monthToTime(r.year, r.month), value: r.close_price })))
    }
  } else {
    const raw = await tick.loadAnnualHistory(props.worldHex, props.sectorName, goodDie)
    if (!raw.length) return false
    if (props.goods.length === 1) {
      series.setData(raw.map(r => ({
        time:  yearToTime(r.year),
        open:  r.open_price,
        high:  r.high_price,
        low:   r.low_price,
        close: r.close_price,
      })))
    } else {
      series.setData(raw.map(r => ({ time: yearToTime(r.year), value: r.close_price })))
    }
  }
  return true
}

function addSeries(color) {
  if (!chart) return null
  const single = props.goods.length === 1
  const useCandle = single && activeTab.value !== 'weekly'
  return useCandle
    ? chart.addCandlestickSeries(candleOpts(color))
    : chart.addLineSeries(lineOpts(color))
}

async function rebuildAllSeries() {
  if (!chart) return
  // Remove all existing series
  seriesMap.forEach(s => chart.removeSeries(s))
  seriesMap.clear()

  if (!props.goods.length) { hasData.value = false; return }

  const results = await Promise.all(
    props.goods.map(async (g, i) => {
      const color  = palette[i % palette.length]
      const series = addSeries(color)
      if (!series) return false
      const ok = await loadSeriesData(series, g.die)
      if (ok) {
        seriesMap.set(g.die, series)
        if (props.goods.length === 1) applyEventMarkers(series)
      } else {
        chart.removeSeries(series)
      }
      return ok
    })
  )

  hasData.value = results.some(Boolean)
  if (hasData.value) chart.timeScale().fitContent()
}

// ── Event markers (single-good mode only) ─────────────────────────────────────
function applyEventMarkers(series) {
  if (!series || !tick.worldEventHistory.length) return
  const sevColor = {
    minor:  cssVar('--accent-dim'),
    major:  cssVar('--amber'),
    crisis: cssVar('--red'),
  }
  const SEV_SHAPE = { minor: 'circle', major: 'square', crisis: 'arrowDown' }
  const markers = tick.worldEventHistory
    .map(ev => ({
      time:     tickToTime(ev.tick),
      position: (ev.sell_modifier_pct ?? ev.buy_modifier_pct ?? 0) > 0 ? 'aboveBar' : 'belowBar',
      color:    sevColor[ev.severity] ?? cssVar('--text-dim'),
      shape:    SEV_SHAPE[ev.severity] ?? 'circle',
      text:     [
        ev.buy_modifier_pct  != null ? `B${ev.buy_modifier_pct  > 0 ? '+' : ''}${ev.buy_modifier_pct}%`  : null,
        ev.sell_modifier_pct != null ? `S${ev.sell_modifier_pct > 0 ? '+' : ''}${ev.sell_modifier_pct}%` : null,
      ].filter(Boolean).join('/'),
      size:     ev.severity === 'crisis' ? 2 : 1,
    }))
    .sort((a, b) => a.time - b.time)
  series.setMarkers(markers)
}

function reapplyEventMarkers() {
  if (props.goods.length !== 1) return
  const series = seriesMap.values().next().value
  if (series) applyEventMarkers(series)
}

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyThemeToChart() {
  if (!chart) return
  chart.applyOptions(chartOpts())
}

async function setTab(key) {
  activeTab.value = key
  await nextTick()
  initChart()
  await rebuildAllSeries()
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  await nextTick()
  initChart()
  await rebuildAllSeries()
})

onUnmounted(destroyChart)

// World or tick change → full reinit
watch(
  () => [props.worldHex, props.sectorName, tick.currentTick],
  async () => {
    await nextTick()
    if (!chart) initChart()
    await rebuildAllSeries()
  },
)

// Goods list change → rebuild series (chart stays)
watch(
  () => props.goods.map(g => g.die).join(','),
  async () => {
    await nextTick()
    if (!chart) initChart()
    await rebuildAllSeries()
  },
)

watch(() => tick.worldEventHistory.length, reapplyEventMarkers)
watch(() => themeStore.revision, applyThemeToChart)

// Sheet drag/animation lifecycle: gestures off while moving, then a single
// canvas resize once the sheet has settled (the ResizeObserver callback is a
// no-op while paused).
watch(() => props.paused, (paused) => {
  chart?.applyOptions(interactionOpts())
  if (!paused) applySize()
})

// ── Accessible summary of what the canvas shows ──────────────────────────────
const chartSummary = computed(() => {
  if (!props.goods.length) return ''
  const names = props.goods.map(g => g.name).join(', ')
  const tab   = TABS.find(t => t.key === activeTab.value)?.label ?? activeTab.value
  return `${tab} price history chart for ${names}.`
})
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
  touch-action: none;
}

.chart-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  flex-shrink: 0;
}

/* Legend */
.chart-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  flex: 1;
  min-width: 0;
}

.legend-empty {
  font-size: 0.75rem;
  color: var(--text-dim);
  font-style: italic;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  color: var(--text);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Tabs */
.chart-tabs { display: flex; gap: 0.25rem; flex-shrink: 0; }

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

/* Chart canvas */
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

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
