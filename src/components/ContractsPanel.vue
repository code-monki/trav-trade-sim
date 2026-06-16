<template>
  <div class="contracts-panel">
    <div v-if="!ship.hasShip" class="placeholder">
      No ship assigned — contact your referee
    </div>

    <template v-else>
      <div v-if="!ship.mailContracts.length" class="placeholder">
        No mail contracts in transit
      </div>

      <table v-else class="contracts-table">
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

const ship = useShipStore()

const totalPayment = computed(() =>
  ship.mailContracts.reduce((s, m) => s + m.payment, 0)
)
</script>

<style scoped>
.contracts-panel {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.contracts-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.contracts-table th {
  text-align: left;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  padding: 0.3rem 0.5rem;
  border-bottom: 1px solid var(--border);
}

.contracts-table td {
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--border-subtle, var(--border));
  color: var(--text);
  vertical-align: top;
}

.contracts-table tfoot td {
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

.hint {
  font-size: 0.72rem;
  color: var(--text-dim);
  font-style: italic;
  margin: 0;
}
</style>
