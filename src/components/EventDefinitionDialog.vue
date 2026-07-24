<template>
  <Teleport to="body">
    <div class="overlay">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="def-title">
        <button class="close-btn" @click="$emit('close')" aria-label="Close">✕</button>
        <h2 id="def-title" class="dialog-title">{{ editing ? 'Edit Definition' : 'New Definition' }}</h2>

        <form class="detail-form" @submit.prevent="submit">
          <div class="form-row">
            <label>Description <span class="req">*</span></label>
            <input v-model="defForm.description" required placeholder="What's happening?" />
          </div>
          <div class="form-row two-col">
            <div>
              <label>Scope</label>
              <select v-model="defForm.scope">
                <option value="local">Local (single world)</option>
                <option value="subsector">Subsector-wide</option>
              </select>
            </div>
            <div>
              <label>Severity</label>
              <select v-model="defForm.severity">
                <option value="minor">Minor</option>
                <option value="major">Major</option>
                <option value="crisis">Crisis</option>
              </select>
            </div>
          </div>
          <div class="form-row two-col">
            <div>
              <label>Buy modifier %</label>
              <input v-model.number="defForm.buyModifierPct" type="number" placeholder="+20 or -15" />
            </div>
            <div>
              <label>Sell modifier %</label>
              <input v-model.number="defForm.sellModifierPct" type="number" placeholder="+20 or -15" />
            </div>
          </div>
          <div class="form-row two-col">
            <div>
              <label>Duration (ticks)</label>
              <input v-model.number="defForm.durationTicks" type="number" min="1" />
            </div>
            <div>
              <label>Trade Good Die</label>
              <input v-model="defForm.tradeGoodDie" placeholder="Leave blank for all" />
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary" :disabled="!defForm.description.trim()">
              {{ editing ? 'Save Definition' : 'Add Definition' }}
            </button>
          </div>
          <p v-if="defError" class="form-error">{{ defError }}</p>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useRefereeStore } from '../stores/referee.js'

const props = defineProps({
  editing: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

const auth    = useAuthStore()
const referee = useRefereeStore()

const defError = ref('')

const defForm = ref(props.editing ? {
  description:     props.editing.description,
  scope:            props.editing.scope,
  severity:         props.editing.severity,
  buyModifierPct:   props.editing.buy_modifier_pct,
  sellModifierPct:  props.editing.sell_modifier_pct,
  durationTicks:    props.editing.duration_ticks,
  tradeGoodDie:     props.editing.trade_good_die || '',
} : {
  description: '', scope: 'local', severity: 'minor',
  buyModifierPct: null, sellModifierPct: null, durationTicks: 4, tradeGoodDie: '',
})

async function submit() {
  defError.value = ''
  try {
    if (props.editing) {
      await referee.updateEventDefinition(props.editing.id, {
        description:       defForm.value.description.trim(),
        scope:              defForm.value.scope,
        severity:           defForm.value.severity,
        buy_modifier_pct:   defForm.value.buyModifierPct  ?? null,
        sell_modifier_pct:  defForm.value.sellModifierPct ?? null,
        duration_ticks:     defForm.value.durationTicks   ?? 4,
        trade_good_die:     defForm.value.tradeGoodDie    || null,
      })
    } else {
      await referee.createEventDefinition(auth.campaign.id, defForm.value)
    }
    emit('saved')
    emit('close')
  } catch (e) {
    defError.value = e.message
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
.form-row label { font-size: 0.75rem; color: var(--text-dim); }
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
