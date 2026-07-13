<template>
  <Teleport to="body">
    <div v-if="modelValue" class="overlay" @mousedown.self="close">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="buy-dialog-title">

        <div class="dialog-header">
          <h3 id="buy-dialog-title">Buy Cargo</h3>
          <button class="close-btn" @click="close" aria-label="Close">✕</button>
        </div>

        <div class="dialog-body">
          <div class="good-summary">
            <span class="good-name">{{ good.trade_good_name }}</span>
            <span class="good-die mono">{{ good.trade_good_die }}</span>
          </div>

          <div class="price-row">
            <div class="price-item">
              <label>Purchase Price</label>
              <span class="price-val">Cr {{ fmt(good.purchase_price) }}/t</span>
            </div>
            <div class="price-item">
              <label>Available</label>
              <span class="price-val">{{ good.qty_available.toLocaleString() }} t</span>
            </div>
            <div class="price-item">
              <label>Hold Free</label>
              <span class="price-val">{{ cargoAvailable }} t</span>
            </div>
            <div class="price-item">
              <label>Ship Credits</label>
              <span class="price-val">Cr {{ fmt(credits) }}</span>
            </div>
          </div>

          <div class="input-row">
            <label for="buy-tons">Tons to buy</label>
            <div class="tons-input-wrap">
              <button class="step-btn" @click="decTons" :disabled="tons <= 1">−</button>
              <input
                id="buy-tons"
                type="number"
                v-model.number="tons"
                :min="1"
                :max="maxTons"
                class="tons-input"
              />
              <button class="step-btn" @click="incTons" :disabled="tons >= maxTons">+</button>
              <button class="max-btn" @click="tons = maxTons" :disabled="tons === maxTons">Max</button>
            </div>
          </div>

          <div class="cost-summary" :class="{ 'cost-warn': totalCost > credits }">
            <span class="cost-label">Total cost</span>
            <span class="cost-val">Cr {{ fmt(totalCost) }}</span>
          </div>

          <div v-if="maxTons === 0" class="buy-block-msg">
            <span v-if="credits < good.purchase_price">Insufficient credits to buy even 1 ton.</span>
            <span v-else-if="cargoAvailable === 0">Hold is full — no cargo space available.</span>
            <span v-else>Nothing available to buy at this world.</span>
          </div>
        </div>

        <div class="dialog-footer">
          <button class="cancel-btn" @click="close">Cancel</button>
          <button
            class="confirm-btn"
            :disabled="maxTons === 0 || tons < 1 || tons > maxTons || loading"
            @click="confirm"
          >
            {{ loading ? 'Buying…' : `Buy ${tons} t` }}
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue:     { type: Boolean, required: true },
  good:           { type: Object,  required: true },  // market_snapshots row
  cargoAvailable: { type: Number,  required: true },
  credits:        { type: Number,  default: 0 },
  loading:        { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const tons = ref(1)

const maxTons = computed(() =>
  Math.min(
    props.good.qty_available,
    props.cargoAvailable,
    Math.floor((props.credits ?? 0) / props.good.purchase_price),
  )
)

const totalCost = computed(() => props.good.purchase_price * tons.value)

// Clamp tons whenever the dialog opens or maxTons changes
watch(() => props.modelValue, (open) => {
  if (open) tons.value = Math.min(1, maxTons.value)
})
watch(maxTons, (max) => {
  if (tons.value > max) tons.value = Math.max(1, max)
})

function incTons() { if (tons.value < maxTons.value) tons.value++ }
function decTons() { if (tons.value > 1)            tons.value-- }

function close()   { emit('update:modelValue', false) }
function confirm() { emit('confirm', { tons: tons.value }); close() }

function fmt(n) { return (n ?? 0).toLocaleString() }
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.dialog {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: min(420px, 90vw);
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.1rem 0.75rem;
  border-bottom: 1px solid var(--border);
}

.dialog-header h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-size: 1rem;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius);
}
.close-btn:hover { color: var(--text); background: var(--bg-item); }

.dialog-body {
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.good-summary {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}

.good-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}

.good-die {
  font-size: 0.75rem;
  color: var(--text-dim);
}

.mono { font-family: monospace; }

.price-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem 1.2rem;
}

.price-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.price-item label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-dim);
  font-weight: 600;
}

.price-val {
  font-size: 0.88rem;
  color: var(--text);
  font-family: monospace;
}

.input-row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.input-row > label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-dim);
}

.tons-input-wrap {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.step-btn {
  background: var(--bg-item);
  border: 1px solid var(--border);
  color: var(--text);
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.step-btn:hover:not(:disabled) { background: var(--bg-selected); }
.step-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.tons-input {
  width: 5rem;
  background: var(--bg-item);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: var(--radius);
  padding: 0.3rem 0.5rem;
  font-size: 0.9rem;
  text-align: center;
  outline: none;
}
.tons-input:focus { border-color: var(--accent-dim); }

.max-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: var(--radius);
  padding: 0.25rem 0.55rem;
  font-size: 0.72rem;
  cursor: pointer;
}
.max-btn:hover:not(:disabled) { border-color: var(--accent-dim); color: var(--accent); }
.max-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.cost-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
}

.cost-summary.cost-warn { border-color: var(--red); }

.cost-label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-dim);
}

.cost-val {
  font-family: monospace;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
}

.buy-block-msg {
  font-size: 0.8rem;
  color: var(--amber);
  text-align: center;
  padding: 0.25rem 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  padding: 0.75rem 1.1rem 0.9rem;
  border-top: 1px solid var(--border);
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: var(--radius);
  padding: 0.4rem 0.9rem;
  font-size: 0.82rem;
  cursor: pointer;
}
.cancel-btn:hover { border-color: var(--text-dim); color: var(--text); }

.confirm-btn {
  background: var(--accent-dim);
  border: none;
  color: var(--accent-text);
  border-radius: var(--radius);
  padding: 0.4rem 1.1rem;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}
.confirm-btn:hover:not(:disabled) { background: var(--accent); }
.confirm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
