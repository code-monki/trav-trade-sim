<template>
  <div class="services-panel">
    <div v-if="!ship.hasShip" class="placeholder">
      No ship assigned — contact your referee
    </div>

    <template v-else>
      <!-- ── Fuel section ──────────────────────────────────────────────────── -->
      <section class="service-section">
        <h3>Fuel</h3>

        <div v-if="!starportClass || Object.keys(availableFuel).length === 0" class="no-service">
          <template v-if="!world">Select a world to see fuel availability</template>
          <template v-else>
            No commercial fuel available at Class {{ starportClass }} starport —
            wilderness refuelling or gas giant skimming only
          </template>
        </div>

        <template v-else>
          <div class="fuel-availability">
            <span v-if="availableFuel.refined"
                  class="fuel-badge refined">Refined Cr{{ availableFuel.refined.toLocaleString() }}/t</span>
            <span v-if="availableFuel.unrefined"
                  class="fuel-badge unrefined">Unrefined Cr{{ availableFuel.unrefined.toLocaleString() }}/t</span>
          </div>

          <div v-if="fuelCapacity > 0" class="fuel-status">
            <span class="fuel-status-label">Tank</span>
            <div class="fuel-bar-wrap">
              <div class="fuel-bar-fill" :style="{ width: fuelBarPct + '%' }"></div>
            </div>
            <span class="fuel-status-val">{{ fuelCurrent }}/{{ fuelCapacity }}t</span>
            <span v-if="tankSpace <= 0" class="fuel-full">FULL</span>
          </div>

          <form class="fuel-form" @submit.prevent="submitFuel">
            <div class="form-row two-col">
              <div>
                <label>Fuel Type</label>
                <div class="type-btns">
                  <button v-if="availableFuel.refined"
                          type="button"
                          :class="['type-btn', { active: fuelForm.fuelType === 'refined' }]"
                          @click="fuelForm.fuelType = 'refined'">Refined</button>
                  <button v-if="availableFuel.unrefined"
                          type="button"
                          :class="['type-btn', { active: fuelForm.fuelType === 'unrefined' }]"
                          @click="fuelForm.fuelType = 'unrefined'">Unrefined</button>
                </div>
              </div>
              <div>
                <label>Tons</label>
                <div class="stepper">
                  <button type="button" @click="decFuelTons" :disabled="fuelForm.tons <= 1">−</button>
                  <input v-model.number="fuelForm.tons" type="number" min="1"
                         :max="fuelCapacity > 0 && tankSpace > 0 ? tankSpace : undefined"
                         class="count-input" />
                  <button type="button" @click="incFuelTons" :disabled="fuelCapacity > 0 && tankSpace > 0 && fuelForm.tons >= tankSpace">+</button>
                </div>
              </div>
            </div>

            <div class="hint-row">
              <span class="hint">
                J-{{ ship.ship?.jump_rating ?? '?' }} jump needs {{ jumpNeeded }}t
                <template v-if="fuelCapacity > 0"> · {{ tankSpace }}t space available</template>
              </span>
              <button type="button" class="btn-ghost btn-xs" @click="fillForJump"
                      :disabled="!canFillForJump || ship.loading">
                Fill for jump
              </button>
            </div>

            <div class="fare-preview">
              <span class="fare-label">Cost</span>
              <span class="fare-amount">
                {{ fuelForm.tons }} t × Cr{{ pricePerTon.toLocaleString() }}
                = <strong>Cr{{ fuelTotal.toLocaleString() }}</strong>
              </span>
            </div>

            <p v-if="fuelError" class="form-error">{{ fuelError }}</p>

            <div class="form-actions">
              <button type="submit" class="btn-primary"
                      :disabled="!canBuyFuel || ship.loading">
                {{ ship.loading ? 'Purchasing…' : 'Purchase Fuel' }}
              </button>
            </div>
          </form>
        </template>

        <div v-if="fuelSuccess" class="success-flash">{{ fuelSuccess }}</div>
      </section>

      <!-- ── Mail contracts section ────────────────────────────────────────── -->
      <section class="service-section">
        <h3>Mail Contract</h3>

        <div v-if="tradeRules === 'MgT2022' && mailContainersAvailable <= 0" class="no-service">
          No mail offered at this starport this tick — check back next tick.
        </div>

        <form v-else class="mail-form" @submit.prevent="submitMail">
          <div class="form-row">
            <label>Destination World</label>
            <WorldPicker
              v-model="mailDest"
              :sector-name="props.sectorName" />
          </div>
          <div class="form-row" v-if="tradeRules === 'T5'">
            <label>Parsecs</label>
            <input v-model.number="mailParsecs" type="number" min="1" max="6" class="parsec-input" />
          </div>
          <p v-if="tradeRules === 'MgT2022'" class="traffic-note">
            {{ mailContainersAvailable }} container(s) offered this tick — take all or none, per MgT2022 rules
          </p>

          <div class="fare-preview">
            <span class="fare-label">Payment on delivery</span>
            <span class="fare-amount">
              <strong>Cr{{ mailPay.toLocaleString() }}</strong>
            </span>
          </div>

          <p v-if="mailError" class="form-error">{{ mailError }}</p>

          <div class="form-actions">
            <button type="submit" class="btn-primary"
                    :disabled="!canAcceptMail || ship.loading">
              {{ ship.loading ? 'Accepting…' : 'Accept Mail Contract' }}
            </button>
          </div>
        </form>

        <div v-if="mailSuccess" class="success-flash">{{ mailSuccess }}</div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useShipStore }  from '../stores/ship.js'
import { useAuthStore }  from '../stores/auth.js'
import { useTickStore }  from '../stores/tick.js'
import {
  availableFuelTypes,
  jumpFuelTons,
  fuelCost,
  mailPayment,
} from '../lib/passengers.js'
import { starportFromUWP } from '../lib/trade-engine-ct7.js'
import { hexDistance }     from '../utils/hexDistance.js'
import WorldPicker         from './WorldPicker.vue'

const props = defineProps({
  world:      { type: Object, default: null },
  sectorName: { type: String, default: '' },
})

const ship = useShipStore()
const auth = useAuthStore()
const tick = useTickStore()

const tradeRules  = computed(() => auth.campaign?.trade_rules ?? 'CT7')
const starportClass = computed(() => props.world?.UWP ? starportFromUWP(props.world.UWP) : null)
const availableFuel = computed(() => availableFuelTypes(starportClass.value ?? ''))

// ── Fuel form ─────────────────────────────────────────────────────────────────

const firstAvailableType = computed(() => {
  if (availableFuel.value.refined)   return 'refined'
  if (availableFuel.value.unrefined) return 'unrefined'
  return 'refined'
})

const fuelForm = ref({ fuelType: 'refined', tons: 20 })
const fuelError   = ref('')
const fuelSuccess = ref('')

const pricePerTon = computed(() =>
  availableFuel.value[fuelForm.value.fuelType] ?? 0
)

const fuelTotal = computed(() => fuelCost(fuelForm.value.tons, pricePerTon.value))

const fuelCapacity = computed(() => ship.ship?.fuel_capacity ?? 0)
const fuelCurrent  = computed(() => ship.ship?.fuel_current  ?? 0)
const tankSpace    = computed(() => fuelCapacity.value > 0 ? fuelCapacity.value - fuelCurrent.value : Infinity)
const fuelBarPct   = computed(() => fuelCapacity.value > 0 ? Math.min(100, (fuelCurrent.value / fuelCapacity.value) * 100) : 0)

const jumpNeeded = computed(() =>
  jumpFuelTons(ship.ship?.hull_tons ?? 200, ship.ship?.jump_rating ?? 1)
)

const canBuyFuel = computed(() =>
  fuelForm.value.tons > 0 &&
  pricePerTon.value > 0 &&
  (ship.ship?.credits ?? 0) >= fuelTotal.value &&
  (fuelCapacity.value === 0 || fuelForm.value.tons <= tankSpace.value)
)

// Amount "Fill for jump" would buy — needed tons, capped by remaining tank space.
const fillForJumpTons = computed(() =>
  fuelCapacity.value > 0 ? Math.min(jumpNeeded.value, tankSpace.value) : jumpNeeded.value
)

const canFillForJump = computed(() =>
  tankSpace.value > 0 &&
  pricePerTon.value > 0 &&
  fillForJumpTons.value > 0 &&
  (ship.ship?.credits ?? 0) >= fuelCost(fillForJumpTons.value, pricePerTon.value)
)

// One click: set tons to the jump-need amount and purchase immediately —
// refills the tank and deducts credits in one action.
async function fillForJump() {
  fuelForm.value.tons = fillForJumpTons.value
  await submitFuel()
}

async function submitFuel() {
  fuelError.value   = ''
  fuelSuccess.value = ''

  if (!props.world) { fuelError.value = 'No world selected'; return }

  const result = await ship.purchaseFuel({
    campaignId:   auth.campaign.id,
    playerId:     auth.player.id,
    fuelType:     fuelForm.value.fuelType,
    tons:         fuelForm.value.tons,
    pricePerTon:  pricePerTon.value,
    worldHex:     props.world.Hex,
    sector:       props.sectorName,
    tick:         tick.currentTick,
  })

  if (!result.ok) { fuelError.value = result.error; return }

  fuelSuccess.value = `Purchased ${fuelForm.value.tons}t ${fuelForm.value.fuelType} fuel — Cr${result.totalCost.toLocaleString()} debited`
  setTimeout(() => { fuelSuccess.value = '' }, 3500)
}

function incFuelTons() {
  if (tankSpace.value !== Infinity && fuelForm.value.tons >= tankSpace.value) return
  fuelForm.value.tons++
}
function decFuelTons() { if (fuelForm.value.tons > 1) fuelForm.value.tons-- }

// ── Mail form ─────────────────────────────────────────────────────────────────

const mailDest    = ref({ hex: '', name: '', sector: '' })
const mailParsecs = ref(1)
const mailError   = ref('')
const mailSuccess = ref('')

// Auto-compute parsecs when a world is picked (T5 fares are per-parsec)
watch(() => mailDest.value.hex, (hex) => {
  if (hex && props.world?.Hex) {
    const d = hexDistance(props.world.Hex, hex)
    if (d > 0) mailParsecs.value = d
  }
})

// MgT2022 only — this tick's rolled mail container count (see traffic-tick.js).
// Always null (unlimited) for CT7/T5.
const mailContainersAvailable = computed(() => tick.trafficAvailability?.mail_containers ?? 0)

const mailPay = computed(() =>
  mailPayment(tradeRules.value, mailParsecs.value, mailContainersAvailable.value)
)

const canAcceptMail = computed(() => {
  if (mailDest.value.hex.trim().length === 0) return false
  if (mailDest.value.sector.trim().length === 0) return false
  if (tradeRules.value === 'MgT2022') return mailContainersAvailable.value > 0
  return true
})

async function submitMail() {
  mailError.value   = ''
  mailSuccess.value = ''

  if (!props.world) { mailError.value = 'No world selected'; return }

  const result = await ship.acceptMailContract({
    campaignId:       auth.campaign.id,
    playerId:         auth.player.id,
    originWorldHex:   props.world.Hex,
    originSector:     props.sectorName,
    originWorldName:  props.world.Name ?? '',
    destWorldHex:     mailDest.value.hex,
    destSector:       mailDest.value.sector,
    destWorldName:    mailDest.value.name,
    parsecs:          mailParsecs.value,
    payment:          mailPay.value,
    tick:             tick.currentTick,
  })

  if (!result.ok) { mailError.value = result.error; return }

  mailSuccess.value = `Mail contract accepted — Cr${mailPay.value.toLocaleString()} on delivery`
  mailDest.value    = { hex: '', name: '', sector: '' }
  mailParsecs.value = 1
  setTimeout(() => { mailSuccess.value = '' }, 3500)
}
</script>

<style scoped>
.services-panel {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.service-section { display: flex; flex-direction: column; gap: 0.75rem; }
.service-section h3 { font-size: 0.85rem; color: var(--text-dim); margin: 0; }

.no-service {
  font-size: 0.82rem;
  color: var(--text-dim);
  font-style: italic;
}

.fuel-availability { display: flex; gap: 0.5rem; }

.fuel-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  margin-bottom: 0.1rem;
}
.fuel-status-label { color: var(--text-dim); min-width: 2.5rem; }
.fuel-status-val   { color: var(--text); font-family: monospace; min-width: 4rem; }
.fuel-full { color: var(--accent); font-size: 0.7rem; font-weight: 700; }
.fuel-bar-wrap {
  flex: 1;
  height: 6px;
  background: var(--bg-item, var(--border));
  border-radius: 3px;
  overflow: hidden;
}
.fuel-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.3s ease;
}
.fuel-badge {
  font-size: 0.72rem;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius);
  font-weight: 600;
}
.fuel-badge.refined   { background: var(--bg-selected); color: var(--accent); border: 1px solid var(--accent-dim); }
.fuel-badge.unrefined { background: var(--bg-panel);    color: var(--text-dim); border: 1px solid var(--border); }

.fuel-form,
.mail-form { display: flex; flex-direction: column; gap: 0.65rem; }

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

.type-btns { display: flex; gap: 0.4rem; }
.type-btn {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-dim);
  font-size: 0.78rem;
  padding: 0.3rem 0.65rem;
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

.hint-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.hint { font-size: 0.72rem; color: var(--text-dim); }

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

.placeholder {
  color: var(--text-dim);
  font-size: 0.85rem;
  font-style: italic;
  padding: 1rem 0;
  text-align: center;
}
</style>
