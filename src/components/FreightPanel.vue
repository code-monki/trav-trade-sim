<template>
  <div class="freight-panel">
    <!-- No ship -->
    <div v-if="!ship.hasShip" class="placeholder">
      No ship assigned — contact your referee
    </div>

    <template v-else>
      <!-- Capacity summary -->
      <div class="capacity-row">
        <div class="cap-stat">
          <label>Cargo Space</label>
          <span>{{ ship.cargoAvailable }} / {{ ship.cargoCapacity }}t free</span>
        </div>
        <div class="cap-stat">
          <label>Credits</label>
          <span>Cr{{ (ship.ship?.credits ?? 0).toLocaleString() }}</span>
        </div>
      </div>

      <!-- Booking form -->
      <section class="booking-section">
        <h3>Book Freight</h3>

        <form class="booking-form" @submit.prevent="submitBooking">
          <div class="form-row">
            <label>Destination World</label>
            <WorldPicker
              v-model="destWorld"
              :sector-name="props.sectorName" />
          </div>

          <p v-if="!destinationChosen" class="placeholder-note">
            Pick a destination to see freight traffic for this route.
          </p>
          <p v-else-if="trafficLoading" class="placeholder-note">
            Rolling freight traffic for this route…
          </p>
          <template v-else>
            <div class="form-row">
              <label id="lot-size-label">Lot Size</label>
              <div class="type-btns" role="group" aria-labelledby="lot-size-label">
                <button
                  v-for="l in LOT_SIZES"
                  :key="l"
                  type="button"
                  :class="['type-btn', { active: form.lotSize === l }]"
                  :aria-pressed="form.lotSize === l"
                  @click="form.lotSize = l">
                  {{ LOT_SIZE_LABELS[l] }}
                </button>
              </div>
            </div>

            <!-- MgT2022: a lot's tonnage is rolled, not chosen, and rate scales with distance -->
            <template v-if="tradeRules === 'MgT2022'">
              <div class="form-row two-col">
                <div>
                  <label>Lot Tonnage</label>
                  <div class="lot-tonnage">{{ lotTons }}t</div>
                </div>
                <div>
                  <label for="freight-parsecs-input">Parsecs</label>
                  <input id="freight-parsecs-input" v-model.number="form.parsecs" type="number" min="1" max="6"
                         class="parsec-input" />
                </div>
              </div>
              <p class="hint">
                A {{ LOT_SIZE_LABELS[form.lotSize] }} lot is {{ MGT2022_FREIGHT_LOT_SIZE_DICE[form.lotSize] }} tons,
                rolled once per lot size/tick — lots can't be split or resized.
              </p>
              <p class="traffic-note">
                {{ trafficAvailable }} {{ LOT_SIZE_LABELS[form.lotSize] }} lot(s) available this tick
              </p>
            </template>

            <!-- CT7: Major/Minor/Incidental are continuous tonnage pools, not
                 discrete lots — book any amount up to what's available. -->
            <template v-else>
              <p class="traffic-note">
                {{ trafficAvailable }}t of {{ LOT_SIZE_LABELS[form.lotSize] }} cargo available this tick
              </p>
              <div class="form-row">
                <label for="freight-tons-input">Tons to Book</label>
                <div class="stepper">
                  <button type="button" aria-label="Decrease tonnage"
                          @click="decTons" :disabled="ct7Tons <= 1">−</button>
                  <input id="freight-tons-input" v-model.number="ct7Tons" type="number" min="1"
                         :max="ct7MaxTons" class="count-input" />
                  <button type="button" aria-label="Increase tonnage"
                          @click="incTons" :disabled="ct7Tons >= ct7MaxTons">+</button>
                </div>
              </div>
            </template>

            <!-- Charge preview -->
            <div class="fare-preview" v-if="effectiveTons > 0">
              <span class="fare-label">Charge</span>
              <span class="fare-amount">
                {{ effectiveTons }}t × Cr{{ ratePerTon.toLocaleString() }}/t
                = <strong>Cr{{ charge.toLocaleString() }}</strong>
              </span>
            </div>

            <p v-if="tradeRules === 'MgT2022'" class="hint">
              Due by tick {{ dueTick }} — late delivery incurs a penalty (1D+4)×10% deducted from the charge.
            </p>

            <p v-if="formError" class="form-error">{{ formError }}</p>

            <div class="form-actions">
              <button type="submit" class="btn-primary"
                      :disabled="!canBook || ship.loading">
                {{ ship.loading ? 'Booking…' : 'Book Freight' }}
              </button>
            </div>
          </template>
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
import { useMapStore }   from '../stores/map.js'
import { freightRate, freightCharge } from '../lib/trade-engine-mgt2022.js'
import { rollQty, ct7FreightCharge, CT7_FREIGHT_RATE_PER_TON } from '../lib/trade-engine-ct7.js'
import { makeRng } from '../lib/market-tick.js'
import { MGT2022_FREIGHT_LOT_SIZE_DICE } from '../lib/traveller-data-mgt2022.js'
import { hexDistance }   from '../utils/hexDistance.js'
import WorldPicker       from './WorldPicker.vue'

const props = defineProps({
  world:      { type: Object, default: null },
  sectorName: { type: String, default: '' },
})

const ship = useShipStore()
const auth = useAuthStore()
const tick = useTickStore()
const map  = useMapStore()

const tradeRules = computed(() => auth.campaign?.trade_rules ?? 'CT7')

const LOT_SIZES = ['major', 'minor', 'incidental']
const LOT_SIZE_LABELS = { major: 'Major', minor: 'Minor', incidental: 'Incidental' }
const LOT_COLUMN = { major: 'major_freight_lots', minor: 'minor_freight_lots', incidental: 'incidental_freight_lots' }

const form = ref({ lotSize: 'major', parsecs: 1 })
const destWorld = ref({ hex: '', name: '', sector: '' })
const destinationChosen = computed(() => destWorld.value.hex.trim().length > 0)
const trafficLoading     = ref(false)

watch(() => destWorld.value.hex, (hex) => {
  if (hex && props.world?.Hex) {
    const d = hexDistance(props.world.Hex, hex)
    if (d > 0) form.value.parsecs = d
  }
})

// No ambient "how much freight is waiting" number independent of a
// destination — MgT2022 applies population/starport DMs from *both*
// worlds plus a distance penalty; CT7 applies population/zone/TL DMs from
// the destination world (Book 7's own "Cargo Available" table) — so
// traffic is rolled fresh whenever the destination or distance changes.
watch(
  () => [destWorld.value.hex, destWorld.value.sector, form.value.parsecs],
  async ([hex, sector, parsecs]) => {
    if (!hex || !sector) { tick.trafficAvailability = null; return }
    trafficLoading.value = true
    try {
      const worlds  = await map.fetchWorldsForSector(sector)
      const destObj = worlds.find(w => w.Hex === hex) ?? null
      if (!destObj) { tick.trafficAvailability = null; return }
      await tick.ensureTrafficSnapshot(props.world, props.sectorName, destObj, sector, parsecs)
    } finally {
      trafficLoading.value = false
    }
  },
  { immediate: true },
)

const formError  = ref('')
const successMsg = ref('')

function d6(rng) { return Math.floor(rng() * 6) + 1 }

// MgT2022: a lot's tonnage is rolled, not chosen — "Major = 1Dx10, Minor =
// 1Dx5, Incidental = 1D" — and can't be split or resized once booked.
// Seeded so the same lot size/tick/ship/world always shows the same
// tonnage rather than re-rolling on every render.
const lotTons = computed(() => {
  if (!ship.hasShip || !props.world?.Hex) return 0
  const rng = makeRng(`${auth.campaign?.id}:${props.world.Hex}:${ship.ship.id}:freight-lot:${form.value.lotSize}:${tick.currentTick}:v1`)
  return rollQty(MGT2022_FREIGHT_LOT_SIZE_DICE[form.value.lotSize], [d6(rng)])
})

// This tick's rolled traffic pool for the selected tier — a LOT count for
// MgT2022, or TONS for CT7 (Book 7's Major/Minor/Incidental are continuous
// tonnage pools, not discrete lots).
const trafficAvailable = computed(() => tick.trafficAvailability?.[LOT_COLUMN[form.value.lotSize]] ?? 0)

// CT7: player chooses how much to book, up to whichever is smaller — the
// pool remaining this tick, or the ship's own free hold space.
const ct7Tons    = ref(1)
const ct7MaxTons = computed(() => Math.max(0, Math.min(trafficAvailable.value, ship.cargoAvailable)))
watch(ct7MaxTons, (max) => { if (ct7Tons.value > max) ct7Tons.value = Math.max(1, max) })
watch(() => form.value.lotSize, () => { ct7Tons.value = Math.max(1, Math.min(ct7Tons.value, ct7MaxTons.value)) })
function incTons() { if (ct7Tons.value < ct7MaxTons.value) ct7Tons.value++ }
function decTons() { if (ct7Tons.value > 1) ct7Tons.value-- }

const effectiveTons = computed(() => tradeRules.value === 'MgT2022' ? lotTons.value : ct7Tons.value)

// MgT2022's rate depends only on distance, not lot size; CT7's is a flat
// Cr1,000/ton regardless of distance or lot size (Book 7's Ship Revenues table).
const ratePerTon = computed(() =>
  tradeRules.value === 'MgT2022' ? freightRate(form.value.parsecs) : CT7_FREIGHT_RATE_PER_TON
)
const charge = computed(() =>
  tradeRules.value === 'MgT2022' ? freightCharge(lotTons.value, form.value.parsecs) : ct7FreightCharge(ct7Tons.value)
)
// CT7 has no due-tick/late-delivery-penalty mechanic in Book 7's text.
const dueTick = computed(() => tick.currentTick + form.value.parsecs)

const canBook = computed(() => {
  if (!ship.hasShip) return false
  if (effectiveTons.value < 1) return false
  if (effectiveTons.value > ship.cargoAvailable) return false
  if (!destWorld.value.hex.trim()) return false
  if (!destWorld.value.sector.trim()) return false
  if (tradeRules.value === 'MgT2022') {
    if (trafficAvailable.value <= 0) return false
  } else if (effectiveTons.value > trafficAvailable.value) {
    return false
  }
  return true
})

async function submitBooking() {
  formError.value  = ''
  successMsg.value = ''

  if (effectiveTons.value > ship.cargoAvailable) {
    formError.value = `Insufficient cargo space (need ${effectiveTons.value}t, have ${ship.cargoAvailable}t)`
    return
  }
  if (tradeRules.value === 'MgT2022' && trafficAvailable.value <= 0) {
    formError.value = `No ${LOT_SIZE_LABELS[form.value.lotSize]} freight lots available this tick`
    return
  }
  if (tradeRules.value !== 'MgT2022' && effectiveTons.value > trafficAvailable.value) {
    formError.value = `Only ${trafficAvailable.value}t of ${LOT_SIZE_LABELS[form.value.lotSize]} cargo available this tick`
    return
  }

  const isMgT2022 = tradeRules.value === 'MgT2022'
  const result = await ship.bookFreight({
    campaignId:       auth.campaign.id,
    playerId:         auth.player.id,
    originWorldHex:   props.world?.Hex ?? '',
    originSector:     props.sectorName,
    originWorldName:  props.world?.Name ?? '',
    destWorldHex:     destWorld.value.hex,
    destSector:       destWorld.value.sector,
    destWorldName:    destWorld.value.name,
    parsecs:          isMgT2022 ? form.value.parsecs : null,
    freightTons:      effectiveTons.value,
    freightLotSize:   form.value.lotSize,
    ratePerTon:       ratePerTon.value,
    charge:           charge.value,
    dueTick:          isMgT2022 ? dueTick.value : null,
    tick:             tick.currentTick,
    trafficConsumed:  isMgT2022 ? undefined : effectiveTons.value,
  })

  if (!result.ok) {
    formError.value = result.error
    return
  }

  successMsg.value = `Booked ${effectiveTons.value}t ${LOT_SIZE_LABELS[form.value.lotSize]} freight — Cr${charge.value.toLocaleString()} collected`
  form.value.parsecs = 1
  ct7Tons.value      = 1
  destWorld.value    = { hex: '', name: '', sector: '' }
  setTimeout(() => { successMsg.value = '' }, 3500)
}
</script>

<style scoped>
.freight-panel {
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

.lot-tonnage {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  padding: 0.35rem 0.6rem;
  font-size: 0.82rem;
  width: fit-content;
}
.parsec-input { width: 60px; }

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
.count-input { width: 52px; text-align: center; }

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
.hint { font-size: 0.72rem; color: var(--text-dim); font-style: italic; margin: 0; }
.placeholder-note { font-size: 0.82rem; color: var(--text-dim); font-style: italic; margin: 0; }

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

.placeholder {
  color: var(--text-dim);
  font-size: 0.85rem;
  font-style: italic;
  padding: 1rem 0;
  text-align: center;
}
</style>
