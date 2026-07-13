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
          <span v-if="ship.crewStateroomsUsed > 0" class="cap-detail">
            {{ ship.crewStateroomsUsed }} crew · {{ ship.stateroomsUsed - ship.crewStateroomsUsed }} passengers
          </span>
        </div>
        <div class="cap-stat">
          <label>Low Berths</label>
          <span>{{ ship.lowBerthsAvailable }} / {{ ship.lowBerthsTotal }} available</span>
        </div>
        <div class="cap-stat" v-if="tradeRules === 'MgT2022'">
          <label>Cargo Space</label>
          <span>{{ ship.cargoAvailable }} / {{ ship.cargoCapacity }}t free</span>
          <span v-if="ship.basicPassageTonsUsed > 0" class="cap-detail">
            {{ ship.basicPassageTonsUsed }}t reserved for Basic Passage
          </span>
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
            <label id="passage-type-label">Passage Type</label>
            <div class="type-btns" role="group" aria-labelledby="passage-type-label">
              <button
                v-for="t in passageTypes"
                :key="t"
                type="button"
                :class="['type-btn', { active: form.passageType === t }]"
                :aria-pressed="form.passageType === t"
                @click="form.passageType = t">
                {{ PASSAGE_TYPE_LABELS[t] }}
              </button>
            </div>
          </div>

          <div class="form-row two-col">
            <div>
              <label for="passenger-count-input">Passengers</label>
              <div class="stepper">
                <button type="button" aria-label="Decrease passenger count"
                        @click="decCount" :disabled="form.count <= 1">−</button>
                <input id="passenger-count-input" v-model.number="form.count" type="number" min="1"
                       :max="maxCount" class="count-input" />
                <button type="button" aria-label="Increase passenger count"
                        @click="incCount" :disabled="form.count >= maxCount">+</button>
              </div>
            </div>
            <div v-if="tradeRules === 'T5' || tradeRules === 'MgT2022'">
              <label for="passenger-parsecs-input">Parsecs</label>
              <input id="passenger-parsecs-input" v-model.number="form.parsecs" type="number" min="1" max="6"
                     class="parsec-input" />
            </div>
          </div>

          <p v-if="tradeRules === 'MgT2022'" class="traffic-note">
            {{ trafficLabel }}: {{ trafficAvailableForType }} available this tick
          </p>

          <div class="form-row">
            <label>Destination World</label>
            <WorldPicker
              v-model="destWorld"
              :sector-name="props.sectorName" />
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
import { ref, computed, watch } from 'vue'
import { useShipStore }  from '../stores/ship.js'
import { useAuthStore }  from '../stores/auth.js'
import { useTickStore }  from '../stores/tick.js'
import {
  PASSAGE_TYPES,
  PASSAGE_TYPES_MGT2022,
  PASSAGE_TYPE_LABELS,
  passengerFare,
  passageCapacityNeeded,
} from '../lib/passengers.js'
import { hexDistance }   from '../utils/hexDistance.js'
import WorldPicker       from './WorldPicker.vue'

const props = defineProps({
  world:      { type: Object, default: null },
  sectorName: { type: String, default: '' },
})

const ship = useShipStore()
const auth = useAuthStore()
const tick = useTickStore()

const tradeRules = computed(() => auth.campaign?.trade_rules ?? 'CT7')

const form = ref({
  passageType: 'high',
  count:        1,
  parsecs:      1,
})

const destWorld = ref({ hex: '', name: '', sector: '' })

// Auto-compute parsecs from hex distance when a world is picked (used for T5 fares)
watch(() => destWorld.value.hex, (hex) => {
  if (hex && props.world?.Hex) {
    const d = hexDistance(props.world.Hex, hex)
    if (d > 0) form.value.parsecs = d
  }
})

const formError  = ref('')
const successMsg = ref('')

const fareInfo = computed(() =>
  passengerFare(form.value.passageType, form.value.count, tradeRules.value, form.value.parsecs)
)

const passageTypes = computed(() =>
  tradeRules.value === 'MgT2022' ? PASSAGE_TYPES_MGT2022 : PASSAGE_TYPES
)

const trafficLabel = computed(() => `${PASSAGE_TYPE_LABELS[form.value.passageType]} traffic`)

// MgT2022 only — the current tick's rolled availability for the selected
// tier (see traffic-tick.js). Always Infinity for CT7/T5 (unlimited, as today).
const trafficAvailableForType = computed(() => {
  if (tradeRules.value !== 'MgT2022' || !tick.trafficAvailability) return '∞'
  const key = { high: 'high_passages', middle: 'middle_passages', basic: 'basic_passages', low: 'low_passages' }[form.value.passageType]
  return tick.trafficAvailability[key] ?? 0
})

const trafficCapForType = computed(() => {
  if (tradeRules.value !== 'MgT2022' || !tick.trafficAvailability) return Infinity
  const key = { high: 'high_passages', middle: 'middle_passages', basic: 'basic_passages', low: 'low_passages' }[form.value.passageType]
  return tick.trafficAvailability[key] ?? 0
})

const maxCount = computed(() => {
  const { stateroomsNeeded, lowBerthsNeeded, cargoTonsNeeded } = passageCapacityNeeded(form.value.passageType, 1)
  let cap = 0
  if (stateroomsNeeded) cap = ship.stateroomsAvailable
  else if (lowBerthsNeeded) cap = ship.lowBerthsAvailable
  else if (cargoTonsNeeded) cap = Math.floor(ship.cargoAvailable / cargoTonsNeeded)
  return Math.max(0, Math.min(cap, trafficCapForType.value))
})

const canBook = computed(() => {
  if (!ship.hasShip) return false
  if (form.value.count < 1) return false
  if (!destWorld.value.hex.trim()) return false
  if (!destWorld.value.sector.trim()) return false
  const { stateroomsNeeded, lowBerthsNeeded, cargoTonsNeeded } = passageCapacityNeeded(form.value.passageType, form.value.count)
  if (stateroomsNeeded > ship.stateroomsAvailable) return false
  if (lowBerthsNeeded  > ship.lowBerthsAvailable)  return false
  if (cargoTonsNeeded  > ship.cargoAvailable)       return false
  if (form.value.count > trafficCapForType.value)  return false
  return true
})

async function submitBooking() {
  formError.value  = ''
  successMsg.value = ''

  const { stateroomsNeeded, lowBerthsNeeded, cargoTonsNeeded } = passageCapacityNeeded(
    form.value.passageType, form.value.count)

  if (stateroomsNeeded > ship.stateroomsAvailable) {
    formError.value = `Insufficient staterooms (need ${stateroomsNeeded}, have ${ship.stateroomsAvailable})`
    return
  }
  if (lowBerthsNeeded > ship.lowBerthsAvailable) {
    formError.value = `Insufficient low berths (need ${lowBerthsNeeded}, have ${ship.lowBerthsAvailable})`
    return
  }
  if (cargoTonsNeeded > ship.cargoAvailable) {
    formError.value = `Insufficient cargo space for Basic Passage (need ${cargoTonsNeeded}t, have ${ship.cargoAvailable}t)`
    return
  }
  if (form.value.count > trafficCapForType.value) {
    formError.value = `Only ${trafficCapForType.value} ${PASSAGE_TYPE_LABELS[form.value.passageType]} passenger(s) available this tick`
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
    destWorldHex:     destWorld.value.hex,
    destSector:       destWorld.value.sector,
    destWorldName:    destWorld.value.name,
    farePerHead,
    fareTotal,
    tick:             tick.currentTick,
  })

  if (!result.ok) {
    formError.value = result.error
    return
  }

  successMsg.value = `Booked ${form.value.count}× ${PASSAGE_TYPE_LABELS[form.value.passageType]} — Cr${fareTotal.toLocaleString()} collected`
  form.value.count   = 1
  form.value.parsecs = 1
  destWorld.value    = { hex: '', name: '', sector: '' }
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
.cap-detail     { font-size: 0.72rem !important; font-weight: 400 !important; color: var(--text-dim) !important; }

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

.traffic-note { font-size: 0.72rem; color: var(--text-dim); margin: 0; }

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
