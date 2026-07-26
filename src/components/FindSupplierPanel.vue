<template>
  <div class="find-supplier-panel">
    <p class="placeholder">
      No trade contacts at this starport yet this month.
    </p>
    <p v-if="attempts > 0" class="hint">
      Previous attempts this month: {{ attempts }} (DM&minus;{{ attempts }} on the next roll)
    </p>
    <div class="form-actions">
      <button type="button" class="btn-primary" :disabled="loading" @click="onAttempt">
        {{ loading ? 'Searching…' : 'Find a Supplier' }}
      </button>
    </div>
    <p v-if="lastResult === 'fail'" class="form-error">
      No luck this time — try again, or wait for a new month.
    </p>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useTickStore } from '../stores/tick.js'
import { starportFromUWP } from '../lib/trade-engine-ct7.js'
import { starportBrokerDM } from '../lib/trade-engine-mgt2022.js'

const props = defineProps({
  world:      { type: Object, required: true },
  sectorName: { type: String, required: true },
})

const tick = useTickStore()

const loading    = ref(false)
const lastResult = ref(null) // null | 'fail'

const attempts = computed(() => tick.supplierAttempts)

const starportDM = computed(() => starportBrokerDM(starportFromUWP(props.world?.UWP ?? '')))

async function onAttempt() {
  loading.value = true
  lastResult.value = null
  const result = await tick.attemptFindSupplier(props.world.Hex, props.sectorName, {
    skillLevel: tick.brokerSkill,
    starportDM: starportDM.value,
  })
  loading.value = false
  if (!result.success) lastResult.value = 'fail'
}

// tick.brokerSkill is loaded by MapView's world-selection watcher (shared
// with Phase 4's per-player pricing, same skill/same source) — but load it
// here too in case this panel mounts before that watcher fires.
onMounted(tick.loadBrokerSkill)
watch(() => props.world?.Hex, tick.loadBrokerSkill)
</script>

<style scoped>
.find-supplier-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 2rem 1rem;
  text-align: center;
}

.placeholder {
  color: var(--text-dim);
  font-size: 0.85rem;
  font-style: italic;
  margin: 0;
}

.hint { font-size: 0.72rem; color: var(--text-dim); font-style: italic; margin: 0; }

.form-actions { display: flex; justify-content: center; }

.form-error {
  font-size: 0.78rem;
  color: var(--red, #e05);
  margin: 0;
}
</style>
