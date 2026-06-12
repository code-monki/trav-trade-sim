<template>
  <Teleport to="body">
    <div v-if="modelValue" class="overlay" @mousedown.self="close">
      <div class="dialog" role="dialog" aria-modal="true"
           aria-labelledby="help-dialog-title" ref="dialogEl">

        <div class="dialog-header" id="help-dialog-title">
          <div class="help-tabs">
            <button v-for="t in TABS" :key="t.key"
                    :class="['htab', { active: activeTab === t.key }]"
                    @click="activeTab = t.key">
              {{ t.label }}
            </button>
          </div>
          <button class="close-btn" @click="close" aria-label="Close">✕</button>
        </div>

        <!-- ── User Manual ───────────────────────────────────────────────── -->
        <div v-if="activeTab === 'manual'" class="dialog-body">

          <section class="help-section">
            <h3>Overview</h3>
            <p>
              Traveller Trade Simulator is a speculative trade dashboard for Classic
              Traveller campaigns. The Referee advances the in-game clock one
              jump-week at a time; commodity prices shift with each tick based on
              world trade codes, market events, and seeded randomness. Players
              identify profitable trade routes and track price history across the
              Third Imperium.
            </p>
          </section>

          <section class="help-section">
            <h3>Campaigns</h3>
            <p>
              Create a campaign from the login screen to receive a shareable
              campaign code. Other players join with that code and a character name.
              All accounts require a PIN — there is no password recovery, so keep it
              safe. The character who creates the campaign is automatically assigned
              the Referee role.
            </p>
          </section>

          <section class="help-section">
            <h3>Navigating the Galaxy</h3>
            <p>
              Select a sector from the dropdown to load its worlds. Click any world
              in the list to open its detail panel. Use the filter box to search by
              world name or hex coordinate. Worlds with a red or amber travel zone
              are highlighted accordingly.
            </p>
          </section>

          <section class="help-section">
            <h3>Overview Tab</h3>
            <p>
              Displays the world's Universal World Profile (UWP), system data,
              trade codes, jump routes, and T5 extensions where available.
            </p>
          </section>

          <section class="help-section">
            <h3>Market Tab</h3>
            <p>
              Shows current buy and sell prices for all 36 Classic Traveller trade
              goods. Price colours indicate deviation from the CT7 base price — green
              means below base (buyer's market), red means above (seller's market).
            </p>
            <p>
              Click any row to open a price chart for that good. Drag the resize
              handle between the table and chart to adjust the panel split. Goods
              affected by an active market event are flagged with a ▲ or ▼ symbol
              in the Event column.
            </p>
            <p>
              Market data is generated lazily: prices are only recorded for a world
              when its Market tab is open during a tick advance. On the first visit
              to a world, prices are backfilled for the entire current year so charts
              have immediate context.
            </p>
            <table class="col-table">
              <thead>
                <tr><th>Column</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Good</strong></td>
                  <td>Trade good name from the CT Book 2 trade table.</td>
                </tr>
                <tr>
                  <td><strong>Die</strong></td>
                  <td>The d66 roll that generates this good's row (e.g. 11–66). Used as a unique key for the good across all data.</td>
                </tr>
                <tr>
                  <td><strong>Buy (Cr/t)</strong></td>
                  <td>Purchase price in Credits per ton at this world this tick. Derived from world trade codes, starport class, and tech level per CT7 rules.</td>
                </tr>
                <tr>
                  <td><strong>Sell (Cr/t)</strong></td>
                  <td>Sale price in Credits per ton — what you would receive selling these goods here this tick.</td>
                </tr>
                <tr>
                  <td><strong>Spread</strong></td>
                  <td>Sell minus Buy per ton. Positive spread indicates a profitable round-trip on a single world; negative means buy-high-sell-low conditions.</td>
                </tr>
                <tr>
                  <td><strong>Qty (t)</strong></td>
                  <td>Available quantity in tons this tick, rolled per CT Book 2. This amount <em>expires</em> at the end of the tick — unpurchased stock does not carry over. A fresh quantity is rolled next tick.</td>
                </tr>
                <tr>
                  <td><strong>Event</strong></td>
                  <td>▲ if an active market event is pushing prices up; ▼ for down. See the Events tab for details.</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section class="help-section">
            <h3>Price Charts</h3>
            <p>Three time frames are available via the tabs above the chart:</p>
            <ul>
              <li><strong>Weekly</strong> — one data point per tick (jump-week); line chart of purchase price.</li>
              <li><strong>Monthly</strong> — one candlestick per Imperial month (4 ticks).</li>
              <li><strong>Annual</strong> — one candlestick per Imperial year (48 ticks).</li>
            </ul>
            <p>
              Event markers appear on the chart at the tick when each event fired.
              Blue circles are Minor events, amber squares are Major, red arrows
              are Crisis. The label shows the price effect percentage.
            </p>
          </section>

          <section class="help-section">
            <h3>Events Tab</h3>
            <p>
              Shows the full event history for the selected world — both local
              events and subsector-wide events. Severity is shown as a coloured
              badge: blue (Minor), amber (Major), red (Crisis). Each entry shows
              the Imperial date, scope, price effect, and whether the event is
              still active or has expired.
            </p>
            <p>
              Use the filter buttons to narrow the list by severity. Event history
              is retained for the current year plus one prior year; older records
              are compacted automatically during the annual rollup.
            </p>
          </section>

          <section class="help-section">
            <h3>Advancing the Tick (Referee only)</h3>
            <p>
              Click <strong>Advance Tick</strong> in the header, or press
              <kbd>T</kbd>, to move time forward one jump-week. Prices update,
              market events may fire automatically, and monthly or annual OHLC
              rollups trigger at the appropriate tick counts. Only the Referee
              can advance the tick.
            </p>
          </section>

          <section class="help-section">
            <h3>Imperial Calendar</h3>
            <p>
              Time is displayed in Imperial format: <code>DDD-YYYY</code>
              (day of year – year). 1 tick = 1 jump-week (7 days).
              There are 4 ticks per Imperial month and 48 ticks per Imperial year.
              The Referee selects the campaign's starting year when creating the
              campaign; the default is 1105 (the classic Third Imperium milieu).
            </p>
          </section>

        </div>

        <!-- ── Keyboard Shortcuts ────────────────────────────────────────── -->
        <div v-if="activeTab === 'shortcuts'" class="dialog-body shortcuts-body">
          <table class="shortcuts-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in SHORTCUTS" :key="s.key">
                <td><kbd>{{ s.key }}</kbd></td>
                <td>{{ s.action }}</td>
              </tr>
            </tbody>
          </table>
          <p class="shortcuts-note">
            Keyboard shortcuts are inactive while an input field has focus.
          </p>
        </div>

        <div class="dialog-footer">
          <button class="btn-primary" @click="close">Close</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useFocusTrap } from '../composables/useFocusTrap.js'

const props = defineProps({ modelValue: { type: Boolean, required: true } })
const emit  = defineEmits(['update:modelValue'])

const activeTab = ref('manual')
const dialogEl  = ref(null)

const { activate, deactivate } = useFocusTrap(dialogEl)
watch(() => props.modelValue, v => v ? nextTick(activate) : deactivate())

const TABS = [
  { key: 'manual',    label: 'User Manual'         },
  { key: 'shortcuts', label: 'Keyboard Shortcuts'  },
]

const SHORTCUTS = [
  { key: '?',   action: 'Open Help' },
  { key: 'O',   action: 'Switch to Overview tab' },
  { key: 'M',   action: 'Switch to Market tab' },
  { key: 'E',   action: 'Switch to Events tab' },
  { key: 'T',   action: 'Advance Tick (Referee only)' },
  { key: 'Esc', action: 'Close dialog' },
]

function close() { emit('update:modelValue', false) }

function onKey(e) { if (e.key === 'Escape') close() }
onMounted(()   => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
}

.dialog {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) * 2);
  width: min(640px, 92vw);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(0,0,0,0.5);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.help-tabs {
  display: flex;
  gap: 0.25rem;
}

.htab {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-dim);
  font-size: 0.8rem;
  padding: 0.28rem 0.85rem;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.1s;
}
.htab:hover { color: var(--text); border-color: var(--border); }
.htab.active {
  background: var(--bg-selected);
  border-color: var(--accent-dim);
  color: var(--accent);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius);
  transition: color 0.15s;
}
.close-btn:hover { color: var(--text); }

/* Body */
.dialog-body {
  padding: 1.1rem 1.25rem;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.help-section {
  padding-bottom: 1rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid rgba(42,48,80,0.6);
}
.help-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }

.help-section h3 {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  margin: 0 0 0.5rem;
}

.help-section p {
  font-size: 0.83rem;
  color: var(--text);
  line-height: 1.6;
  margin: 0 0 0.5rem;
}
.help-section p:last-child { margin-bottom: 0; }

.help-section ul {
  margin: 0.35rem 0 0.5rem 1.1rem;
  padding: 0;
}
.help-section li {
  font-size: 0.83rem;
  color: var(--text);
  line-height: 1.6;
  margin-bottom: 0.2rem;
}

code {
  font-family: monospace;
  background: var(--bg-item);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.85em;
  color: var(--code);
}

/* Column definitions table (Market Tab) */
.col-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  margin-top: 0.75rem;
}
.col-table th {
  text-align: left;
  padding: 0.35rem 0.6rem;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-dim);
  border-bottom: 1px solid var(--border);
}
.col-table td {
  padding: 0.45rem 0.6rem;
  color: var(--text);
  border-bottom: 1px solid rgba(42,48,80,0.3);
  vertical-align: top;
}
.col-table td:first-child {
  white-space: nowrap;
  color: var(--accent);
  width: 9rem;
}
.col-table tr:last-child td { border-bottom: none; }

/* Shortcuts tab */
.shortcuts-body { gap: 1rem; }

.shortcuts-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.83rem;
}

.shortcuts-table th {
  text-align: left;
  padding: 0.4rem 0.75rem;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-dim);
  border-bottom: 1px solid var(--border);
}

.shortcuts-table td {
  padding: 0.55rem 0.75rem;
  color: var(--text);
  border-bottom: 1px solid rgba(42,48,80,0.4);
}

kbd {
  display: inline-block;
  font-family: monospace;
  font-size: 0.82rem;
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 7px;
  color: var(--code);
  min-width: 2rem;
  text-align: center;
}

.shortcuts-note {
  font-size: 0.75rem;
  color: var(--text-dim);
  margin: 0;
}

/* Footer */
.dialog-footer {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.btn-primary {
  background: var(--accent-dim);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  padding: 0.35rem 1.1rem;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-primary:hover { background: var(--accent); }
</style>
