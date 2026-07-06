<template>
  <div class="cargo-hold">

    <!-- No ship -->
    <div v-if="!ship.hasShip" class="hold-empty-state">
      <p>No ship assigned.</p>
      <p class="dim">Ask your referee to assign you to a vessel.</p>
    </div>

    <template v-else>

      <!-- Ship status bar -->
      <div class="ship-bar">
        <span class="ship-name">{{ ship.ship.name }}</span>
        <div class="ship-stats">
          <div class="stat">
            <label>Credits</label>
            <span class="mono">Cr {{ fmt(ship.ship.credits) }}</span>
          </div>
          <div class="stat">
            <label>Hold</label>
            <span class="mono">{{ ship.cargoUsed }}/{{ ship.cargoCapacity }} t</span>
          </div>
          <div class="stat">
            <label>Free</label>
            <span class="mono">{{ ship.cargoAvailable }} t</span>
          </div>
          <div v-if="props.world" class="stat">
            <label>At</label>
            <span class="mono">{{ ship.ship.current_world || '—' }}</span>
          </div>
        </div>
        <button v-if="props.world && !isCurrentLocation" class="locate-btn"
                @click="setLocation">
          Set Here
        </button>
      </div>

      <!-- Error -->
      <div v-if="ship.error" class="hold-error">
        {{ ship.error }}
        <button @click="ship.clearError()">✕</button>
      </div>

      <!-- Not authorized to trade -->
      <div v-if="!ship.canTrade" class="trade-auth-notice">
        You are not authorized to buy or sell cargo. Ask your referee to grant trading rights.
      </div>

      <!-- Empty hold -->
      <div v-if="!ship.cargo.length" class="hold-empty-state">
        <p>Hold is empty.</p>
        <p class="dim">Visit the Market tab to purchase cargo.</p>
      </div>

      <!-- Cargo table -->
      <div v-else class="cargo-table-wrap">
        <table class="cargo-table">
          <thead>
            <tr>
              <th>Good</th>
              <th class="num">Tons</th>
              <th class="num">Bought</th>
              <th>Source</th>
              <th class="num">Sells for</th>
              <th class="num">Profit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in ship.cargo" :key="item.id">
              <!-- Normal row -->
              <tr v-if="pendingSellId !== item.id" class="cargo-row">
                <td class="good-name">{{ item.trade_good_name }}</td>
                <td class="num">{{ item.tons }}</td>
                <td class="num mono">Cr {{ fmt(item.purchase_price) }}/t</td>
                <td class="source-world" :data-sector="item.purchase_sector">{{ worldLabel(item) }}</td>
                <td class="num mono">
                  <span v-if="sellPriceFor(item) !== null">Cr {{ fmt(sellPriceFor(item)) }}/t</span>
                  <span v-else class="dim">—</span>
                </td>
                <td class="num" :class="profitClass(item)">
                  <span v-if="sellPriceFor(item) !== null">
                    {{ profitLabel(item) }}
                  </span>
                  <span v-else class="dim">—</span>
                </td>
                <td class="action-cell">
                  <button
                    class="sell-btn"
                    :disabled="sellPriceFor(item) === null || ship.loading || !ship.canTrade"
                    @click="startSell(item)"
                  >
                    Sell
                  </button>
                </td>
              </tr>

              <!-- Confirm sell row -->
              <tr v-else class="cargo-row confirm-row">
                <td colspan="5" class="confirm-text">
                  Sell {{ item.tons }} t of {{ item.trade_good_name }}
                  for <strong>Cr {{ fmt(sellPriceFor(item) * item.tons) }}</strong>?
                  <span v-if="sellPriceFor(item) !== null" :class="profitClass(item)">
                    ({{ profitLabel(item) }})
                  </span>
                </td>
                <td class="num">
                  <button class="confirm-btn" :disabled="ship.loading" @click="doSell(item)">
                    {{ ship.loading ? '…' : 'Confirm' }}
                  </button>
                </td>
                <td>
                  <button class="cancel-btn" @click="pendingSellId = null">Cancel</button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

    </template>

    <!-- Sale result flash -->
    <Transition name="flash">
      <div v-if="lastResult" class="result-flash" :class="lastResult.profit >= 0 ? 'flash-pos' : 'flash-neg'">
        {{ lastResult.profit >= 0 ? '+' : '' }}Cr {{ fmt(Math.abs(lastResult.profit)) }}
        {{ lastResult.profit >= 0 ? 'profit' : 'loss' }}
        on {{ lastResult.name }}
      </div>
    </Transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useShipStore } from '../stores/ship.js'
import { useTickStore } from '../stores/tick.js'
import { useAuthStore } from '../stores/auth.js'
import { useMapStore  } from '../stores/map.js'

const props = defineProps({
  world:      { type: Object, default: null },
  sectorName: { type: String, default: '' },
})

const ship = useShipStore()
const tick = useTickStore()
const auth = useAuthStore()
const map  = useMapStore()

function worldLabel(item) {
  const hex  = item.purchase_world
  const name = item.purchase_world_name || map.worlds.find(w => w.Hex === hex)?.Name
  return name ? `${hex}-${name}` : (hex || '—')
}

const pendingSellId = ref(null)
const lastResult    = ref(null)

const isCurrentLocation = computed(() =>
  ship.ship?.current_world  === props.world?.Hex &&
  ship.ship?.current_sector === props.sectorName
)

async function setLocation() {
  // No fuel cost for manual location set (not a jump)
  await ship.updateLocation(props.world.Hex, props.sectorName, {
    tick:       tick.currentTick,
    campaignId: auth.campaign?.id,
    playerId:   auth.player?.id,
  })
}

// Ensure market snapshots are loaded for the selected world (to display sell prices)
async function loadSnapshots() {
  if (!props.world?.Hex || !props.sectorName) return
  await tick.ensureWorldSnapshot(props.world, props.sectorName)
}

onMounted(loadSnapshots)
watch(() => [props.world?.Hex, props.sectorName, tick.currentTick], loadSnapshots)

// ── Sell price lookup from current world's snapshot cache ─────────────────

function sellPriceFor(item) {
  const snap = tick.worldSnapshots[item.trade_good_die]
  return snap ? snap.sale_price : null
}

// ── Profit display ─────────────────────────────────────────────────────────

function profitPerTon(item) {
  const sp = sellPriceFor(item)
  if (sp === null) return null
  return sp - item.purchase_price
}

function profitLabel(item) {
  const ppt  = profitPerTon(item)
  if (ppt === null) return '—'
  const total = ppt * item.tons
  const sign  = total >= 0 ? '+' : ''
  return `${sign}Cr ${fmt(total)}`
}

function profitClass(item) {
  const ppt = profitPerTon(item)
  if (ppt === null) return ''
  return ppt >= 0 ? 'pos' : 'neg'
}

// ── Sell flow ──────────────────────────────────────────────────────────────

function startSell(item) {
  pendingSellId.value = item.id
}

async function doSell(item) {
  const sellPrice = sellPriceFor(item)
  if (sellPrice === null) return

  const result = await ship.sellCargo({
    campaignId:      auth.campaign.id,
    cargoItem:       item,
    sellPricePerTon: sellPrice,
    marketWorldHex:  props.world.Hex,
    marketSector:    props.sectorName,
    tick:            tick.currentTick,
    tradeRules:      auth.campaign.trade_rules,
  })

  pendingSellId.value = null

  if (result.ok) {
    lastResult.value = { profit: result.netProfit, name: item.trade_good_name }
    setTimeout(() => { lastResult.value = null }, 4000)
  }
}

function fmt(n) { return (n ?? 0).toLocaleString() }
</script>

<style scoped>
.cargo-hold {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  overflow: hidden;
}

/* ── Ship status bar ────────────────────────────────────────────────────── */
.ship-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.55rem 0.85rem;
}

.ship-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
  flex: 1;
}

.locate-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: var(--radius);
  padding: 0.2rem 0.55rem;
  font-size: 0.72rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.1s;
  flex-shrink: 0;
  margin-left: 3px;
}
.locate-btn:hover { border-color: var(--accent-dim); color: var(--accent); }

.ship-stats {
  display: flex;
  gap: 1.5rem;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.stat label {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-dim);
  font-weight: 600;
}

.stat span {
  font-size: 0.82rem;
  color: var(--text);
}

.mono { font-family: monospace; }

/* ── Error ──────────────────────────────────────────────────────────────── */
.hold-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(217, 58, 58, 0.08);
  border: 1px solid var(--red);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
  font-size: 0.82rem;
  color: var(--red);
}

.hold-error button {
  background: transparent;
  border: none;
  color: var(--red);
  cursor: pointer;
}

/* ── Trade auth notice ──────────────────────────────────────────────────── */
.trade-auth-notice {
  font-size: 0.8rem;
  color: var(--amber);
  background: rgba(232, 160, 32, 0.07);
  border: 1px solid rgba(232, 160, 32, 0.3);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
}

/* ── Empty state ────────────────────────────────────────────────────────── */
.hold-empty-state {
  color: var(--text-dim);
  font-size: 0.88rem;
  text-align: center;
  padding: 2rem 0;
}

.hold-empty-state p { margin: 0.2rem 0; }
.dim { color: var(--text-dim); font-size: 0.8rem; }

/* ── Cargo table ────────────────────────────────────────────────────────── */
.cargo-table-wrap {
  overflow-y: auto;
  overscroll-behavior: contain;
  flex: 1;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.cargo-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.cargo-table thead {
  position: sticky;
  top: 0;
  background: var(--bg-panel);
  z-index: 1;
}

.cargo-table th {
  padding: 0.4rem 0.7rem;
  text-align: left;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-dim);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.cargo-table th.num { text-align: right; }

.cargo-row {
  border-bottom: 1px solid rgba(42, 48, 80, 0.5);
  transition: background 0.1s;
}

.cargo-row:hover { background: var(--bg-item); }

.confirm-row { background: rgba(232, 160, 32, 0.06); }
.confirm-row:hover { background: rgba(232, 160, 32, 0.1); }

.cargo-table td {
  padding: 0.4rem 0.7rem;
  vertical-align: middle;
}

.cargo-table td.num { text-align: right; }

.good-name    { font-weight: 500; }
.source-world {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--text-dim);
  text-align: left;
  white-space: nowrap;
  position: relative;
  cursor: default;
}

.source-world[data-sector]::after {
  content: attr(data-sector);
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.2rem 0.5rem;
  font-size: 0.7rem;
  color: var(--text);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 10;
}

.source-world[data-sector]:hover::after {
  opacity: 1;
}

.pos { color: var(--green); }
.neg { color: var(--red); }

.confirm-text {
  font-size: 0.82rem;
  color: var(--text);
}

.action-cell { text-align: right; white-space: nowrap; }

.sell-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: var(--radius);
  padding: 0.2rem 0.55rem;
  font-size: 0.72rem;
  cursor: pointer;
  transition: all 0.1s;
}
.sell-btn:hover:not(:disabled) { border-color: var(--accent-dim); color: var(--accent); }
.sell-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.confirm-btn {
  background: var(--accent-dim);
  border: none;
  color: #fff;
  border-radius: var(--radius);
  padding: 0.2rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
}
.confirm-btn:hover:not(:disabled) { background: var(--accent); }
.confirm-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.cancel-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: var(--radius);
  padding: 0.2rem 0.55rem;
  font-size: 0.72rem;
  cursor: pointer;
}
.cancel-btn:hover { border-color: var(--text-dim); color: var(--text); }

/* ── Sale result flash ──────────────────────────────────────────────────── */
.result-flash {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  padding: 0.6rem 1.1rem;
  border-radius: var(--radius);
  font-size: 0.88rem;
  font-weight: 600;
  border: 1px solid;
  z-index: 100;
}

.flash-pos { background: rgba(76,175,114,.12); border-color: var(--green); color: var(--green); }
.flash-neg { background: rgba(217,58,58,.12);  border-color: var(--red);   color: var(--red); }

.flash-enter-active, .flash-leave-active { transition: opacity 0.3s, transform 0.3s; }
.flash-enter-from { opacity: 0; transform: translateY(8px); }
.flash-leave-to   { opacity: 0; transform: translateY(8px); }
</style>
