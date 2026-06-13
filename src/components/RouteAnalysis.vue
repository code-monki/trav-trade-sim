<template>
  <div class="route-analysis">

    <div v-if="!ship.hasShip" class="ra-state">
      <p>No ship assigned.</p>
      <p class="dim">Ask your referee to assign you to a vessel.</p>
    </div>

    <div v-else-if="!jumpRating" class="ra-notice">
      Jump rating not configured — ask your referee to set it on the ship.
    </div>

    <div v-else-if="!map.worlds.length" class="ra-state">
      <p class="dim">Load a sector to see reachable worlds.</p>
    </div>

    <template v-else>

      <div class="ra-header">
        <span class="ra-origin">
          Jump-{{ jumpRating }} from <strong>{{ world?.Name || world?.Hex }}</strong>
        </span>
        <span class="ra-count">{{ projections.length }} worlds in range</span>
      </div>

      <div v-if="!ship.cargo.length" class="ra-notice">
        Hold is empty — profit projections will appear once you have cargo.
      </div>

      <div v-if="!projections.length" class="ra-state">
        <p class="dim">No worlds within jump range.</p>
      </div>

      <div v-else class="ra-table-wrap">
        <table class="ra-table">
          <thead>
            <tr>
              <th>World</th>
              <th>Hex</th>
              <th class="num">Jump</th>
              <th>Port</th>
              <th v-if="ship.cargo.length" class="num">Projected Profit</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="w in projections" :key="w.hex" class="ra-row"
                :class="{ 'top-row': ship.cargo.length && w.totalProfit === maxProfit && maxProfit > 0 }">
              <td class="w-name">{{ w.name }}</td>
              <td class="w-hex">{{ w.hex }}</td>
              <td class="num">{{ w.dist }}</td>
              <td class="w-port">{{ w.starport }}</td>
              <td v-if="ship.cargo.length" class="num profit-cell" :class="w.totalProfit >= 0 ? 'pos' : 'neg'">
                {{ w.totalProfit >= 0 ? '+' : '' }}Cr {{ fmt(w.totalProfit) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="ra-disclaimer">
        Projected prices assume no market events at destination. Actual prices are set on arrival.
      </p>

    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useShipStore } from '../stores/ship.js'
import { useMapStore  } from '../stores/map.js'
import { useTickStore } from '../stores/tick.js'
import { useAuthStore } from '../stores/auth.js'
import { hexDistance  } from '../utils/hexDistance.js'
import { generateWorldSnapshot } from '../lib/market-tick.js'

const props = defineProps({
  world:      { type: Object, default: null },
  sectorName: { type: String, default: '' },
})

const ship = useShipStore()
const map  = useMapStore()
const tick = useTickStore()
const auth = useAuthStore()

const jumpRating = computed(() => ship.ship?.jump_rating ?? 0)

const projections = computed(() => {
  if (!props.world?.Hex || !jumpRating.value || !map.worlds.length) return []

  const hasCargo = ship.cargo.length > 0
  const results = []

  for (const w of map.worlds) {
    const dist = hexDistance(props.world.Hex, w.Hex)
    if (dist === 0 || dist > jumpRating.value) continue

    let totalProfit = 0
    if (hasCargo) {
      const snapshots = generateWorldSnapshot({
        world:        w,
        sectorName:   props.sectorName,
        campaignId:   auth.campaign?.id ?? 'route-analysis',
        tick:         tick.currentTick,
        activeEvents: [],
      })
      const snapByDie = {}
      for (const s of snapshots) snapByDie[s.trade_good_die] = s
      totalProfit = ship.cargo.reduce((sum, item) => {
        const snap = snapByDie[item.trade_good_die]
        return snap ? sum + (snap.sale_price - item.purchase_price) * item.tons : sum
      }, 0)
    }

    results.push({
      name:        w.Name || w.Hex,
      hex:         w.Hex,
      dist,
      starport:    (w.UWP || '?')[0],
      totalProfit,
    })
  }

  return hasCargo
    ? results.sort((a, b) => b.totalProfit - a.totalProfit)
    : results.sort((a, b) => a.dist - b.dist || a.name.localeCompare(b.name))
})

const maxProfit = computed(() =>
  projections.value.reduce((m, w) => Math.max(m, w.totalProfit), -Infinity)
)

function fmt(n) { return Math.abs(n ?? 0).toLocaleString() }
</script>

<style scoped>
.route-analysis {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  height: 100%;
  overflow: hidden;
}

/* ── State / notice ─────────────────────────────────────────────────────── */
.ra-state {
  color: var(--text-dim);
  font-size: 0.88rem;
  text-align: center;
  padding: 2rem 0;
}
.ra-state p { margin: 0.2rem 0; }
.dim { color: var(--text-dim); font-size: 0.8rem; }

.ra-notice {
  font-size: 0.8rem;
  color: var(--amber);
  background: rgba(232, 160, 32, 0.07);
  border: 1px solid rgba(232, 160, 32, 0.3);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.ra-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.45rem 0.75rem;
  flex-shrink: 0;
}

.ra-origin {
  font-size: 0.82rem;
  color: var(--text);
}

.ra-count {
  font-size: 0.72rem;
  color: var(--text-dim);
  font-family: monospace;
}

/* ── Table ──────────────────────────────────────────────────────────────── */
.ra-table-wrap {
  overflow-y: auto;
  flex: 1;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.ra-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.ra-table thead {
  position: sticky;
  top: 0;
  background: var(--bg-panel);
  z-index: 1;
}

.ra-table th {
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
.ra-table th.num { text-align: right; }

.ra-row {
  border-bottom: 1px solid rgba(42, 48, 80, 0.5);
  transition: background 0.1s;
}
.ra-row:hover { background: var(--bg-item); }

.top-row { background: rgba(76, 175, 114, 0.06); }
.top-row:hover { background: rgba(76, 175, 114, 0.1); }

.ra-table td {
  padding: 0.4rem 0.7rem;
  vertical-align: middle;
}
.ra-table td.num { text-align: right; }

.w-name { font-weight: 500; }
.w-hex  { font-family: monospace; font-size: 0.78rem; color: var(--text-dim); }
.w-port { font-family: monospace; font-size: 0.78rem; }

.profit-cell { font-family: monospace; font-weight: 600; }
.pos { color: var(--green); }
.neg { color: var(--red); }

/* ── Disclaimer ─────────────────────────────────────────────────────────── */
.ra-disclaimer {
  font-size: 0.72rem;
  color: var(--text-dim);
  margin: 0;
  flex-shrink: 0;
  font-style: italic;
}
</style>
