<template>
  <div class="reports-panel">
    <div v-if="!ship.hasShip" class="placeholder">
      No ship assigned — contact your referee
    </div>

    <template v-else>
      <!-- ── Report picker ─────────────────────────────────────────── -->
      <div class="report-tabs">
        <button
          v-for="r in REPORTS"
          :key="r.key"
          :class="['rep-btn', { active: report === r.key }]"
          @click="switchReport(r.key)"
        >{{ r.label }}</button>
      </div>

      <!-- ── Time scope filter ─────────────────────────────────────── -->
      <div class="scope-row">
        <button :class="['scope-btn', { active: scopeMode === 'all' }]" @click="setAllTime">All Time</button>
        <button :class="['scope-btn', { active: scopeMode === 'year' }]" @click="setYearRange">Year Range</button>
        <template v-if="scopeMode === 'year'">
          <label class="scope-label">From</label>
          <input
            v-model.number="fromYear"
            type="number"
            class="year-input"
            min="1105"
            :max="toYear"
            @change="reload"
          />
          <label class="scope-label">To</label>
          <input
            v-model.number="toYear"
            type="number"
            class="year-input"
            :min="fromYear"
            @change="reload"
          />
        </template>
      </div>

      <!-- ── Ledger ────────────────────────────────────────────────── -->
      <template v-if="report === 'ledger'">
        <div v-if="ledgerLoading" class="placeholder">Loading…</div>
        <div v-else-if="!ledgerRows.length" class="placeholder">No transactions found</div>
        <template v-else>
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th class="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in ledgerRows" :key="t.id">
                <td class="mono date-col">{{ formatImperialDate(t.tick) }}</td>
                <td><span class="txn-type" :data-type="t.type">{{ TYPE_LABEL[t.type] ?? t.type }}</span></td>
                <td class="desc-col">{{ txnDesc(t) }}</td>
                <td :class="['right', 'mono', t.total_cr >= 0 ? 'pos' : 'neg']">
                  {{ t.total_cr >= 0 ? '+' : '' }}Cr{{ Math.abs(t.total_cr).toLocaleString() }}
                </td>
              </tr>
            </tbody>
          </table>
          <button v-if="ledgerHasMore" class="load-more-btn" @click="loadMoreLedger">Load more</button>
        </template>
      </template>

      <!-- ── Trades ────────────────────────────────────────────────── -->
      <template v-if="report === 'trades'">
        <div v-if="tradesLoading" class="placeholder">Loading…</div>
        <div v-else-if="!tradesRows.length" class="placeholder">No completed trades found</div>
        <template v-else>
          <table class="data-table trades-table">
            <thead>
              <tr>
                <th>Date Sold</th>
                <th>Good</th>
                <th>From</th>
                <th>To</th>
                <th class="right">Qty</th>
                <th class="right">Buy/t</th>
                <th class="right">Sell/t</th>
                <th class="right">Net Profit</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in tradesRows" :key="t.id">
                <td class="mono date-col">{{ formatImperialDate(t.sell_tick) }}</td>
                <td>{{ t.trade_good_name }}</td>
                <td>
                  <span class="world-name">{{ t.source_world_hex }}</span>
                  <span class="world-meta">{{ t.source_sector }}</span>
                </td>
                <td>
                  <span class="world-name">{{ t.market_world_hex }}</span>
                  <span class="world-meta">{{ t.market_sector }}</span>
                </td>
                <td class="right mono">{{ t.tons }}t</td>
                <td class="right mono">{{ t.buy_price_per_ton.toLocaleString() }}</td>
                <td class="right mono">{{ t.sell_price_per_ton.toLocaleString() }}</td>
                <td :class="['right', 'mono', 'profit', t.net_profit >= 0 ? 'pos' : 'neg']">
                  {{ t.net_profit >= 0 ? '+' : '' }}Cr{{ Math.abs(t.net_profit).toLocaleString() }}
                </td>
              </tr>
            </tbody>
          </table>
          <button v-if="tradesHasMore" class="load-more-btn" @click="loadMoreTrades">Load more</button>
        </template>
      </template>

      <!-- ── Income Breakdown ──────────────────────────────────────── -->
      <template v-if="report === 'income'">
        <div v-if="incomeLoading" class="placeholder">Loading…</div>
        <div v-else class="income-breakdown">
          <div class="breakdown-section">
            <div class="breakdown-heading">Income</div>
            <div v-for="row in incomeRows" :key="row.label" class="breakdown-row">
              <span class="breakdown-label">{{ row.label }}</span>
              <span class="breakdown-val pos mono">+Cr{{ row.amount.toLocaleString() }}</span>
            </div>
            <div v-if="!incomeRows.length" class="breakdown-row muted">
              <span class="breakdown-label">—</span>
              <span class="breakdown-val mono">Cr0</span>
            </div>
            <div class="breakdown-row subtotal">
              <span class="breakdown-label">Total Income</span>
              <span class="breakdown-val pos mono">+Cr{{ totalIncome.toLocaleString() }}</span>
            </div>
          </div>

          <div class="breakdown-section">
            <div class="breakdown-heading">Expenses</div>
            <div v-for="row in expenseRows" :key="row.label" class="breakdown-row">
              <span class="breakdown-label">{{ row.label }}</span>
              <span class="breakdown-val neg mono">-Cr{{ Math.abs(row.amount).toLocaleString() }}</span>
            </div>
            <div v-if="!expenseRows.length" class="breakdown-row muted">
              <span class="breakdown-label">—</span>
              <span class="breakdown-val mono">Cr0</span>
            </div>
            <div class="breakdown-row subtotal">
              <span class="breakdown-label">Total Expenses</span>
              <span class="breakdown-val neg mono">-Cr{{ Math.abs(totalExpenses).toLocaleString() }}</span>
            </div>
          </div>

          <div class="breakdown-net">
            <span class="breakdown-label">Net Position</span>
            <span :class="['breakdown-val', 'mono', 'net', netPosition >= 0 ? 'pos' : 'neg']">
              {{ netPosition >= 0 ? '+' : '' }}Cr{{ Math.abs(netPosition).toLocaleString() }}
            </span>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useShipStore } from '../stores/ship.js'
import { useTickStore } from '../stores/tick.js'
import { api } from '../lib/api.js'
import { formatImperialDate } from '../lib/market-tick.js'
import { yearToTickRange } from '../lib/reports.js'

const ship = useShipStore()
const tick = useTickStore()

const REPORTS = [
  { key: 'ledger', label: 'Ledger' },
  { key: 'trades', label: 'Trades' },
  { key: 'income', label: 'Income' },
]

const TYPE_LABEL = {
  buy:              'Buy',
  sell:             'Sell',
  fuel:             'Fuel',
  passenger_fare:   'Passage',
  passenger_refund: 'Refund',
  mail:             'Mail',
  fee:              'Fee',
  event:            'Event',
}

const INCOME_TYPES = {
  sell:           'Cargo Sales',
  passenger_fare: 'Passenger Fares',
  mail:           'Mail Deliveries',
}

const EXPENSE_TYPES = {
  buy:              'Cargo Purchases',
  fuel:             'Fuel Purchases',
  passenger_refund: 'Passenger Refunds',
  fee:              'Fees',
  event:            'Event Debits',
}

const report    = ref('ledger')
const scopeMode = ref('all')
const fromYear  = ref(tick.currentYear)
const toYear    = ref(tick.currentYear)

const ledgerRows    = ref([])
const ledgerLimit   = ref(100)
const ledgerHasMore = ref(false)
const ledgerLoading = ref(false)

const tradesRows    = ref([])
const tradesLimit   = ref(100)
const tradesHasMore = ref(false)
const tradesLoading = ref(false)

const incomeLoading = ref(false)
const byType        = ref({})

function tickFilter() {
  if (scopeMode.value === 'all') return null
  return yearToTickRange(fromYear.value, toYear.value)
}

function txnDesc(t) {
  if ((t.type === 'buy' || t.type === 'sell') && t.trade_good_name) {
    return `${t.trade_good_name} × ${t.tons}t`
  }
  return t.notes ?? '—'
}

async function loadLedger() {
  if (!ship.ship?.id) return
  ledgerLoading.value = true
  const lim    = ledgerLimit.value
  const tf     = tickFilter()
  const params = { ship_id: ship.ship.id, limit: lim + 1 }
  if (tf) { params.from_tick = tf.gte; params.to_tick = tf.lt }
  const { data } = await api.get('/api/reports/ledger', params)
  if (data) {
    ledgerHasMore.value = data.length > lim
    ledgerRows.value    = data.slice(0, lim)
  }
  ledgerLoading.value = false
}

async function loadTrades() {
  if (!ship.ship?.id) return
  tradesLoading.value = true
  const lim    = tradesLimit.value
  const tf     = tickFilter()
  const params = { ship_id: ship.ship.id, limit: lim + 1 }
  if (tf) { params.from_tick = tf.gte; params.to_tick = tf.lt }
  const { data } = await api.get('/api/reports/trades', params)
  if (data) {
    tradesHasMore.value = data.length > lim
    tradesRows.value    = data.slice(0, lim)
  }
  tradesLoading.value = false
}

async function loadIncome() {
  if (!ship.ship?.id) return
  incomeLoading.value = true
  const tf     = tickFilter()
  const params = { ship_id: ship.ship.id }
  if (tf) { params.from_tick = tf.gte; params.to_tick = tf.lt }
  const { data } = await api.get('/api/reports/income', params)
  if (data) byType.value = data   // Worker returns byType map directly
  incomeLoading.value = false
}

async function reload() {
  if (report.value === 'ledger') await loadLedger()
  else if (report.value === 'trades') await loadTrades()
  else await loadIncome()
}

async function loadMoreLedger() {
  ledgerLimit.value += 100
  await loadLedger()
}

async function loadMoreTrades() {
  tradesLimit.value += 100
  await loadTrades()
}

function switchReport(key) {
  report.value = key
}

function setAllTime() {
  scopeMode.value = 'all'
}

function setYearRange() {
  if (scopeMode.value !== 'year') {
    fromYear.value  = tick.currentYear
    toYear.value    = tick.currentYear
    scopeMode.value = 'year'
  }
}

// Reload when report or scope mode changes
watch([report, scopeMode, fromYear, toYear], () => reload(), { immediate: true })

// ── Income computed ───────────────────────────────────────────────────────────

const incomeRows = computed(() =>
  Object.entries(INCOME_TYPES)
    .map(([type, label]) => ({ label, amount: byType.value[type] ?? 0 }))
    .filter(r => r.amount !== 0)
)

const expenseRows = computed(() =>
  Object.entries(EXPENSE_TYPES)
    .map(([type, label]) => ({ label, amount: byType.value[type] ?? 0 }))
    .filter(r => r.amount !== 0)
)

const totalIncome   = computed(() => incomeRows.value.reduce((s, r) => s + r.amount, 0))
const totalExpenses = computed(() => expenseRows.value.reduce((s, r) => s + r.amount, 0))
const netPosition   = computed(() => totalIncome.value + totalExpenses.value)
</script>

<style scoped>
.reports-panel {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ── Picker / scope ───────────────────────────────────────────────────────── */

.report-tabs {
  display: flex;
  gap: 0.25rem;
}

.rep-btn {
  padding: 0.3rem 0.9rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-dim);
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
.rep-btn:hover  { background: var(--bg-hover); color: var(--text); }
.rep-btn.active { background: var(--bg-selected); color: var(--accent); border-color: var(--accent); }

.scope-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.scope-btn {
  padding: 0.2rem 0.7rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-dim);
  font-size: 0.75rem;
  cursor: pointer;
}
.scope-btn:hover  { background: var(--bg-hover); color: var(--text); }
.scope-btn.active { background: var(--bg-selected); color: var(--accent); border-color: var(--accent); }

.scope-label {
  font-size: 0.72rem;
  color: var(--text-dim);
  margin-left: 0.25rem;
}

.year-input {
  width: 5rem;
  padding: 0.2rem 0.4rem;
  background: var(--bg-input, var(--bg-panel));
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.8rem;
}
.year-input:focus { outline: none; border-color: var(--accent); }

/* ── Tables ───────────────────────────────────────────────────────────────── */

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.data-table th {
  text-align: left;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  padding: 0.3rem 0.5rem;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.data-table td {
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid var(--border-subtle, var(--border));
  color: var(--text);
  vertical-align: middle;
}

.date-col { white-space: nowrap; color: var(--text-dim); font-size: 0.78rem; }
.desc-col { color: var(--text); }

.world-name { display: block; font-size: 0.8rem; }
.world-meta { display: block; font-size: 0.7rem; color: var(--text-dim); }

.center { text-align: center; }
.right  { text-align: right; }
.mono   { font-family: monospace; }
.muted  { color: var(--text-dim); }

.pos { color: var(--green, #34d399); }
.neg { color: var(--red,   #f87171); }

/* ── Transaction type badge ───────────────────────────────────────────────── */

.txn-type {
  display: inline-block;
  font-size: 0.68rem;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 500;
  white-space: nowrap;
}
.txn-type[data-type="buy"]              { background: rgba(99,102,241,0.15); color: #818cf8; }
.txn-type[data-type="sell"]             { background: rgba(52,211,153,0.15); color: #34d399; }
.txn-type[data-type="fuel"]             { background: rgba(251,191,36,0.15);  color: #fbbf24; }
.txn-type[data-type="passenger_fare"]   { background: rgba(167,139,250,0.15); color: #a78bfa; }
.txn-type[data-type="passenger_refund"] { background: rgba(248,113,113,0.15); color: #f87171; }
.txn-type[data-type="mail"]             { background: rgba(34,211,238,0.15);  color: #22d3ee; }
.txn-type[data-type="fee"],
.txn-type[data-type="event"]            { background: var(--bg-panel); color: var(--text-dim); border: 1px solid var(--border); }

/* ── Load more ────────────────────────────────────────────────────────────── */

.load-more-btn {
  align-self: center;
  padding: 0.3rem 1.2rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-dim);
  font-size: 0.78rem;
  cursor: pointer;
  margin-top: 0.25rem;
}
.load-more-btn:hover { background: var(--bg-hover); color: var(--text); }

/* ── Income Breakdown ─────────────────────────────────────────────────────── */

.income-breakdown {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.breakdown-section {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.6rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.breakdown-heading {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-dim);
  margin-bottom: 0.2rem;
}

.breakdown-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.83rem;
}
.breakdown-row.muted { color: var(--text-dim); }

.breakdown-row.subtotal {
  border-top: 1px solid var(--border);
  padding-top: 0.3rem;
  margin-top: 0.15rem;
  font-weight: 600;
}

.breakdown-label { color: var(--text); }
.breakdown-val   { font-family: monospace; }

.breakdown-net {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.92rem;
  font-weight: 700;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.breakdown-net .breakdown-label { color: var(--text); }
.breakdown-net .net { font-size: 1rem; }

/* ── Placeholder ──────────────────────────────────────────────────────────── */

.placeholder {
  color: var(--text-dim);
  font-size: 0.85rem;
  font-style: italic;
  padding: 1.5rem 0;
  text-align: center;
}
</style>
