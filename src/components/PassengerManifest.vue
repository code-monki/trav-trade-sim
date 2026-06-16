<template>
  <div class="manifest-panel">
    <div v-if="!ship.hasShip" class="placeholder">
      No ship assigned — contact your referee
    </div>

    <template v-else>
      <!-- Capacity summary -->
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

      <!-- In-transit passengers -->
      <div v-if="!ship.passengers.length" class="placeholder">
        No passengers aboard
      </div>

      <table v-else class="manifest-table">
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
              <span class="dest-name">{{ p.dest_world_name || p.dest_world_hex }}</span>
              <span class="dest-meta">{{ p.dest_sector }}</span>
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
        Passengers are automatically delivered when the ship arrives at their destination.
        Referees can issue refunds from Campaign Management.
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useShipStore } from '../stores/ship.js'
import { PASSAGE_TYPE_LABELS } from '../lib/passengers.js'

const ship = useShipStore()

const totalFare = computed(() =>
  ship.passengers.reduce((s, p) => s + p.fare_total, 0)
)
</script>

<style scoped>
.manifest-panel {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

.manifest-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.manifest-table th {
  text-align: left;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  padding: 0.3rem 0.5rem;
  border-bottom: 1px solid var(--border);
}

.manifest-table td {
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--border-subtle, var(--border));
  color: var(--text);
  vertical-align: top;
}

.manifest-table tfoot td {
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
  border-bottom: none;
}

.dest-name { display: block; }
.dest-meta { display: block; font-size: 0.72rem; color: var(--text-dim); }

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

.hint {
  font-size: 0.72rem;
  color: var(--text-dim);
  font-style: italic;
  margin: 0;
}
</style>
