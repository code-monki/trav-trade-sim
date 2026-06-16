<template>
  <div class="passengers-panel">
    <!-- No ship -->
    <div v-if="!ship.hasShip" class="placeholder">
      No ship assigned — contact your referee
    </div>

    <template v-else>
      <!-- Capacity summary -->
      <div class="capacity-row">
        <div class="cap-stat">
          <label>Staterooms</label>
          <span>{{ ship.stateroomsAvailable }} / {{ ship.stateroomsTotal }} available</span>
        </div>
        <div class="cap-stat">
          <label>Low Berths</label>
          <span>{{ ship.lowBerthsAvailable }} / {{ ship.lowBerthsTotal }} available</span>
        </div>
        <div class="cap-stat">
          <label>Credits</label>
          <span>Cr{{ (ship.ship?.credits ?? 0).toLocaleString() }}</span>
        </div>
      </div>

      <!-- Booking form -->
      <section class="booking-section">
        <h3>Book Passengers</h3>

        <form class="booking-form" @submit.prevent="submitBooking">
          <div class="form-row">
            <label>Passage Type</label>
            <div class="type-btns">
              <button
                v-for="t in PASSAGE_TYPES"
                :key="t"
                type="button"
                :class="['type-btn', { active: form.passageType === t }]"
                @click="form.passageType = t">
                {{ PASSAGE_TYPE_LABELS[t] }}
              </button>
            </div>
          </div>

          <div class="form-row two-col">
            <div>
              <label>Passengers</label>
              <div class="stepper">
                <button type="button" @click="decCount" :disabled="form.count <= 1">−</button>
                <input v-model.number="form.count" type="number" min="1"
                       :max="maxCount" class="count-input" />
                <button type="button" @click="incCount" :disabled="form.count >= maxCount">+</button>
              </div>
            </div>
            <div v-if="tradeRules === 'T5'">
              <label>Parsecs</label>
              <input v-model.number="form.parsecs" type="number" min="1" max="6"
                     class="parsec-input" />
            </div>
          </div>

          <div class="form-row">
            <label>Destination World</label>
            <input v-model="form.destWorldName" placeholder="World name (optional)" class="dest-input" />
          </div>
          <div class="form-row two-col">
            <div>
              <label>Hex</label>
              <input v-model="form.destWorldHex" placeholder="e.g. 1910" maxlength="4" />
            </div>
            <div>
              <label>Sector</label>
              <input v-model="form.destSector" placeholder="Spinward Marches" />
            </div>
          </div>

          <!-- Fare preview -->
          <div class="fare-preview" v-if="form.count > 0">
            <span class="fare-label">Fare</span>
            <span class="fare-amount">
              Cr{{ fareInfo.farePerHead.toLocaleString() }} × {{ form.count }}
              = <strong>Cr{{ fareInfo.fareTotal.toLocaleString() }}</strong>
            </span>
          </div>

          <p v-if="formError" class="form-error">{{ formError }}</p>

          <div class="form-actions">
            <button type="submit" class="btn-primary"
                    :disabled="!canBook || ship.loading">
              {{ ship.loading ? 'Booking…' : 'Book Passage' }}
            </button>
          </div>
        </form>
      </section>

      <!-- Success flash -->
      <div v-if="successMsg" class="success-flash">{{ successMsg }}</div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useShipStore }  from '../stores/ship.js'
import { useAuthStore }  from '../stores/auth.js'
import { useTickStore }  from '../stores/tick.js'
import {
  PASSAGE_TYPES,
  PASSAGE_TYPE_LABELS,
  passengerFare,
  passageCapacityNeeded,
} from '../lib/passengers.js'

const props = defineProps({
  world:      { type: Object, default: null },
  sectorName: { type: String, default: '' },
})

const ship = useShipStore()
const auth = useAuthStore()
const tick = useTickStore()

const tradeRules = computed(() => auth.campaign?.trade_rules ?? 'CT7')

const form = ref({
  passageType:  'high',
  count:         1,
  parsecs:       1,
  destWorldName: '',
  destWorldHex:  '',
  destSector:    '',
})

const formError  = ref('')
const successMsg = ref('')

const fareInfo = computed(() =>
  passengerFare(form.value.passageType, form.value.count, tradeRules.value, form.value.parsecs)
)

const maxCount = computed(() => {
  const { stateroomsNeeded, lowBerthsNeeded } = passageCapacityNeeded(form.value.passageType, 1)
  if (stateroomsNeeded) return ship.stateroomsAvailable
  if (lowBerthsNeeded)  return ship.lowBerthsAvailable
  return 0
})

const canBook = computed(() => {
  if (!ship.hasShip) return false
  if (form.value.count < 1) return false
  if (!form.value.destWorldHex.trim()) return false
  if (!form.value.destSector.trim()) return false
  const { stateroomsNeeded, lowBerthsNeeded } = passageCapacityNeeded(form.value.passageType, form.value.count)
  if (stateroomsNeeded > ship.stateroomsAvailable) return false
  if (lowBerthsNeeded  > ship.lowBerthsAvailable)  return false
  return true
})

async function submitBooking() {
  formError.value  = ''
  successMsg.value = ''

  const { stateroomsNeeded, lowBerthsNeeded } = passageCapacityNeeded(
    form.value.passageType, form.value.count)

  if (stateroomsNeeded > ship.stateroomsAvailable) {
    formError.value = `Insufficient staterooms (need ${stateroomsNeeded}, have ${ship.stateroomsAvailable})`
    return
  }
  if (lowBerthsNeeded > ship.lowBerthsAvailable) {
    formError.value = `Insufficient low berths (need ${lowBerthsNeeded}, have ${ship.lowBerthsAvailable})`
    return
  }

  const { farePerHead, fareTotal } = fareInfo.value

  const result = await ship.bookPassengers({
    campaignId:       auth.campaign.id,
    playerId:         auth.player.id,
    passageType:      form.value.passageType,
    count:            form.value.count,
    embarkWorldHex:   props.world?.Hex ?? '',
    embarkSector:     props.sectorName,
    embarkWorldName:  props.world?.Name ?? '',
    destWorldHex:     form.value.destWorldHex.trim(),
    destSector:       form.value.destSector.trim(),
    destWorldName:    form.value.destWorldName.trim(),
    farePerHead,
    fareTotal,
    tick:             tick.currentTick,
  })

  if (!result.ok) {
    formError.value = result.error
    return
  }

  successMsg.value = `Booked ${form.value.count}× ${PASSAGE_TYPE_LABELS[form.value.passageType]} — Cr${fareTotal.toLocaleString()} collected`
  form.value.count        = 1
  form.value.destWorldName = ''
  form.value.destWorldHex  = ''
  form.value.destSector    = ''
  setTimeout(() => { successMsg.value = '' }, 3500)
}

function incCount() { if (form.value.count < maxCount.value) form.value.count++ }
function decCount() { if (form.value.count > 1) form.value.count-- }
</script>

<style scoped>
.passengers-panel {
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

.booking-section h3 { font-size: 0.85rem; margin-bottom: 0.75rem; color: var(--text-dim); }

.booking-form { display: flex; flex-direction: column; gap: 0.75rem; }

.form-row { display: flex; flex-direction: column; gap: 0.3rem; }
.form-row label { font-size: 0.72rem; color: var(--text-dim); }
.form-row input {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  padding: 0.35rem 0.6rem;
  font-size: 0.82rem;
}

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

.type-btns { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.type-btn {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-dim);
  font-size: 0.78rem;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  transition: all 0.1s;
}
.type-btn.active {
  background: var(--bg-selected);
  border-color: var(--accent-dim);
  color: var(--accent);
}

.stepper { display: flex; align-items: center; gap: 0.25rem; }
.stepper button {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  width: 28px; height: 28px;
  font-size: 1rem; cursor: pointer;
}
.stepper button:disabled { opacity: 0.35; cursor: not-allowed; }
.count-input  { width: 52px; text-align: center; }
.parsec-input { width: 60px; }
.dest-input   { width: 100%; }

.fare-preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 0.82rem;
}
.fare-label  { color: var(--text-dim); }
.fare-amount { color: var(--text); }
.fare-amount strong { color: var(--accent); }

.form-actions { display: flex; justify-content: flex-end; }

.form-error {
  font-size: 0.78rem;
  color: var(--red, #e05);
  margin: 0;
}

.success-flash {
  padding: 0.5rem 0.75rem;
  background: var(--bg-panel);
  border: 1px solid var(--accent-dim);
  border-radius: var(--radius);
  color: var(--accent);
  font-size: 0.82rem;
}
</style>
