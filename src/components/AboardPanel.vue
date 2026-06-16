<template>
  <div class="aboard-panel">
    <div v-if="!ship.hasShip" class="placeholder">
      No ship assigned — contact your referee
    </div>

    <template v-else>
      <!-- ── Passengers ─────────────────────────────────────────────── -->
      <div class="section-header">Passengers Aboard</div>

      <div class="capacity-row">
        <div class="cap-stat">
          <label>Staterooms</label>
          <span>{{ ship.stateroomsUsed }} / {{ ship.stateroomsTotal }} occupied</span>
        </div>
        <div class="cap-stat">
          <label>Low Berths</label>
          <span>{{ ship.lowBerthsUsed }} / {{ ship.lowBerthsTotal }} occupied</span>
        </div>
      </div>

      <div v-if="!ship.passengers.length" class="placeholder sub">
        No passengers aboard
      </div>

      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Type</th>
            <th class="center">Count</th>
            <th>Destination</th>
            <th class="right">Fare</th>
            <th>Boarded</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in ship.passengers" :key="p.id">
            <td>{{ PASSAGE_TYPE_LABELS[p.passage_type] }}</td>
            <td class="center">{{ p.count }}</td>
            <td>
              <span class="world-name">{{ p.dest_world_name || p.dest_world_hex }}</span>
              <span class="world-meta">{{ p.dest_sector }}</span>
            </td>
            <td class="right mono">Cr{{ p.fare_total.toLocaleString() }}</td>
            <td class="muted">Tick {{ p.embark_tick }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="total-label">Total booked revenue</td>
            <td class="right mono total-val">Cr{{ totalFare.toLocaleString() }}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <p class="hint">
        Passengers auto-deliver when the ship arrives at their destination.
        Referees can issue refunds from Campaign Management.
      </p>

      <!-- ── Divider ─────────────────────────────────────────────────── -->
      <div class="section-divider"></div>

      <!-- ── Mail Contracts ─────────────────────────────────────────── -->
      <div class="section-header">Mail Contracts</div>

      <div v-if="!ship.mailContracts.length" class="placeholder sub">
        No mail contracts in transit
      </div>

      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Origin</th>
            <th>Destination</th>
            <th class="center">Parsecs</th>
            <th class="right">Payment</th>
            <th>Accepted</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in ship.mailContracts" :key="m.id">
            <td>
              <span class="world-name">{{ m.origin_world_name || m.origin_world_hex }}</span>
              <span class="world-meta">{{ m.origin_sector }}</span>
            </td>
            <td>
              <span class="world-name">{{ m.dest_world_name || m.dest_world_hex }}</span>
              <span class="world-meta">{{ m.dest_sector }}</span>
            </td>
            <td class="center">{{ m.parsecs }}</td>
            <td class="right mono">Cr{{ m.payment.toLocaleString() }}</td>
            <td class="muted">Tick {{ m.accept_tick }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="total-label">Total pending payment</td>
            <td class="right mono total-val">Cr{{ totalPayment.toLocaleString() }}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <p class="hint">
        Mail contracts are automatically paid when the ship arrives at the destination world.
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useShipStore } from '../stores/ship.js'
import { PASSAGE_TYPE_LABELS } from '../lib/passengers.js'

const ship = useShipStore()

const totalFare    = computed(() => ship.passengers.reduce((s, p) => s + p.fare_total, 0))
const totalPayment = computed(() => ship.mailContracts.reduce((s, m) => s + m.payment, 0))
</script>

<style scoped>
.aboard-panel {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-header {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-dim);
  padding: 0.1rem 0.25rem;
}

.section-divider {
  border-top: 1px solid var(--border);
  margin: 0.25rem 0;
}

.capacity-row {
  display: flex;
  gap: 1.5rem;
  padding: 0.6rem 0.75rem;
  background: var(--bg-panel);
  border-radius: var(--radius);
  border: 1px solid var(--border);
}

.cap-stat { display: flex; flex-direction: column; gap: 0.2rem; }
.cap-stat label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); }
.cap-stat span  { font-size: 0.85rem; font-weight: 500; color: var(--text); }

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
}

.data-table td {
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--border-subtle, var(--border));
  color: var(--text);
  vertical-align: top;
}

.data-table tfoot td {
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
  border-bottom: none;
}

.world-name { display: block; }
.world-meta { display: block; font-size: 0.72rem; color: var(--text-dim); }

.center { text-align: center; }
.right  { text-align: right; }
.mono   { font-family: monospace; }
.muted  { color: var(--text-dim); }

.total-label { color: var(--text-dim); font-size: 0.72rem; text-align: right; }
.total-val   { font-weight: 600; color: var(--accent); font-family: monospace; }

.placeholder {
  color: var(--text-dim);
  font-size: 0.85rem;
  font-style: italic;
  padding: 1rem 0;
  text-align: center;
}
.placeholder.sub { padding: 0.5rem 0; }

.hint {
  font-size: 0.72rem;
  color: var(--text-dim);
  font-style: italic;
  margin: 0;
}
</style>
