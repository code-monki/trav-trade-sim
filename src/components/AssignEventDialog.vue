<template>
  <Teleport to="body">
    <div class="overlay">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="assign-title">
        <button class="close-btn" @click="$emit('close')" aria-label="Close">✕</button>
        <h2 id="assign-title" class="dialog-title">Assign Event to World</h2>

        <form class="detail-form" @submit.prevent="submit">
          <div class="form-row">
            <label>Event Definition</label>
            <select v-model="selectedDefinitionKey" @change="applyDefinitionSelection">
              <option value="">— pick a definition —</option>
              <optgroup label="Custom" v-if="referee.eventDefinitions.length">
                <option v-for="d in referee.eventDefinitions" :key="'custom:' + d.id" :value="'custom:' + d.id">
                  {{ d.description }}
                </option>
              </optgroup>
              <optgroup label="Built-in">
                <option v-for="(e, i) in EVENT_CATALOGUE" :key="'builtin:' + i" :value="'builtin:' + i">
                  {{ e.description }}
                </option>
              </optgroup>
            </select>
          </div>
          <div class="form-row">
            <label>Scope</label>
            <select v-model="newEvent.scope">
              <option value="local">Local (single world)</option>
              <option value="subsector">Subsector-wide</option>
            </select>
          </div>
          <div class="form-row">
            <label>Sector</label>
            <input v-model="sectorFilterQuery" placeholder="Filter sectors…" />
            <select v-model="newEvent.sector" @change="onAssignSectorChange">
              <option value="">— select a sector —</option>
              <option v-for="s in filteredAssignSectors" :key="s.name" :value="s.name">{{ s.name }}</option>
            </select>
          </div>
          <div v-if="newEvent.scope === 'local'" class="form-row">
            <label>World Hex</label>
            <select v-if="eventFormWorlds.length" v-model="newEvent.worldHex">
              <option value="">— select world —</option>
              <option v-for="w in eventFormWorlds" :key="w.Hex" :value="w.Hex">
                {{ w.Hex }} — {{ w.Name || '(unnamed)' }}
              </option>
            </select>
            <input v-else v-model="newEvent.worldHex" placeholder="e.g. 1910" />
            <span v-if="eventFormWorldsLoading" class="hint">Loading worlds…</span>
            <span v-if="eventFormWorldsError" class="hint">{{ eventFormWorldsError }} — enter the hex manually.</span>
          </div>
          <div class="form-row">
            <label>Description <span class="req">*</span></label>
            <input v-model="newEvent.description" required placeholder="What's happening?" />
          </div>
          <div class="form-row two-col">
            <div>
              <label>Buy modifier %</label>
              <input v-model.number="newEvent.buyModifierPct" type="number" placeholder="+20 or -15" />
            </div>
            <div>
              <label>Sell modifier %</label>
              <input v-model.number="newEvent.sellModifierPct" type="number" placeholder="+20 or -15" />
            </div>
          </div>
          <div class="form-row two-col">
            <div>
              <label>Duration (ticks)</label>
              <input v-model.number="newEvent.durationTicks" type="number" min="1" />
            </div>
          </div>
          <div class="form-row">
            <label>Trade Good Die</label>
            <input v-model="newEvent.tradeGoodDie" placeholder="e.g. 36 — leave blank for all" />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary"
                    :disabled="!newEvent.description.trim() || !newEvent.sector">Assign Event</button>
          </div>
          <p v-if="eventError" class="form-error">{{ eventError }}</p>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useTickStore } from '../stores/tick.js'
import { useRefereeStore } from '../stores/referee.js'
import { useMapStore } from '../stores/map.js'
import { EVENT_CATALOGUE } from '../lib/event-catalogue.js'

const props = defineProps({
  initialDefinitionKey: { type: String, default: '' },
})
const emit = defineEmits(['close', 'assigned'])

const auth    = useAuthStore()
const tick    = useTickStore()
const referee = useRefereeStore()
const map     = useMapStore()

const eventError = ref('')

const newEvent = ref({
  scope: 'local', worldHex: '', sector: '', description: '',
  buyModifierPct: null, sellModifierPct: null, durationTicks: 4, tradeGoodDie: '',
})

const selectedDefinitionKey  = ref('')
const sectorFilterQuery      = ref('')
const eventFormWorlds        = ref([])
const eventFormWorldsLoading = ref(false)
const eventFormWorldsError   = ref('')

if (!map.sectors.length) map.loadSectors()

const filteredAssignSectors = computed(() => {
  const q = sectorFilterQuery.value.trim().toLowerCase()
  if (!q) return map.sectors
  return map.sectors.filter(s => s.name.toLowerCase().includes(q))
})

function applyDefinitionSelection() {
  if (!selectedDefinitionKey.value) return
  const [kind, key] = selectedDefinitionKey.value.split(':')

  if (kind === 'custom') {
    const def = referee.eventDefinitions.find(d => d.id === key)
    if (!def) return
    newEvent.value = {
      ...newEvent.value,
      description:     def.description,
      scope:            def.scope,
      buyModifierPct:   def.buy_modifier_pct,
      sellModifierPct:  def.sell_modifier_pct,
      durationTicks:    def.duration_ticks,
      tradeGoodDie:     def.trade_good_die || '',
    }
  } else if (kind === 'builtin') {
    const def = EVENT_CATALOGUE[Number(key)]
    if (!def) return
    newEvent.value = {
      ...newEvent.value,
      description:     def.description,
      scope:           'local',
      buyModifierPct:  def.buyModifierPct  ?? null,
      sellModifierPct: def.sellModifierPct ?? null,
      durationTicks:   def.durationTicks   ?? 4,
    }
  }
}

if (props.initialDefinitionKey) {
  selectedDefinitionKey.value = props.initialDefinitionKey
  applyDefinitionSelection()
}

async function onAssignSectorChange() {
  newEvent.value.worldHex     = ''
  eventFormWorlds.value       = []
  eventFormWorldsError.value  = ''
  if (!newEvent.value.sector) return

  eventFormWorldsLoading.value = true
  try {
    eventFormWorlds.value = await map.fetchWorldsForSector(newEvent.value.sector)
  } catch (e) {
    eventFormWorldsError.value = `Couldn't load worlds for this sector (${e.message})`
  } finally {
    eventFormWorldsLoading.value = false
  }
}

async function submit() {
  eventError.value = ''
  try {
    const created = await referee.createEvent(auth.campaign.id, {
      ...newEvent.value,
      currentTick: tick.currentTick,
    })
    // Live-update both local lists immediately (mirrors doExpireEvent in
    // RefereeView.vue) rather than waiting on a reload.
    if (tick.activeEvents && created) {
      tick.activeEvents = [created, ...tick.activeEvents]
    }
    if (tick.allEvents && created) {
      tick.allEvents = [created, ...tick.allEvents]
    }
    emit('assigned', created)
    emit('close')
  } catch (e) {
    eventError.value = e.message
  }
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}

.dialog {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 2rem;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  position: relative;
  overflow-y: auto;
}

.dialog-title { font-size: 1.1rem; margin: 0; }

.close-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius);
}
.close-btn:hover { color: var(--text); background: var(--bg-item); }

.detail-form { display: flex; flex-direction: column; gap: 0.75rem; }

.form-row { display: flex; flex-direction: column; gap: 0.3rem; }
.form-row label {
  font-size: 0.75rem;
  color: var(--text-dim);
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
}
.form-row input, .form-row select {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  padding: 0.35rem 0.6rem;
  font-size: 0.82rem;
  width: 100%;
}

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

.req { color: var(--red, #e05); }

.hint { font-size: 0.72rem; color: var(--text-dim); }

.form-actions { display: flex; gap: 0.5rem; }

.btn-primary {
  background: var(--accent-dim);
  color: var(--accent-text);
  border: none;
  border-radius: var(--radius);
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-primary:hover:not(:disabled) { background: var(--accent); }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

.form-error { font-size: 0.78rem; color: var(--red, #e05); margin: 0; }
</style>
