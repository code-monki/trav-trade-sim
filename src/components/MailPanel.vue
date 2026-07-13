<template>
  <div class="mail-panel">
    <!-- No ship -->
    <div v-if="!ship.hasShip" class="placeholder">
      No ship assigned — contact your referee
    </div>

    <template v-else>
      <section class="booking-section">
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
            <label for="mail-parsecs-input">Parsecs</label>
            <input id="mail-parsecs-input" v-model.number="mailParsecs" type="number" min="1" max="6" class="parsec-input" />
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
      </section>

      <div v-if="mailSuccess" class="success-flash">{{ mailSuccess }}</div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useShipStore }  from '../stores/ship.js'
import { useAuthStore }  from '../stores/auth.js'
import { useTickStore }  from '../stores/tick.js'
import { mailPayment }   from '../lib/passengers.js'
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
.mail-panel {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.booking-section h3 { font-size: 0.85rem; margin-bottom: 0.75rem; color: var(--text-dim); }

.no-service {
  font-size: 0.82rem;
  color: var(--text-dim);
  font-style: italic;
}

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
