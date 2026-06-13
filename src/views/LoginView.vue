<template>
  <div class="login-shell">
    <div class="login-card">
      <div class="login-header">
        <h1>Traveller Trade Simulator</h1>
        <p class="login-sub">Imperial Merchant's Exchange</p>
      </div>

      <!-- Mode tabs -->
      <div class="mode-tabs">
        <button :class="['tab', { active: mode === 'login' }]"   @click="setMode('login')">Sign In</button>
        <button :class="['tab', { active: mode === 'join' }]"    @click="setMode('join')">Join Campaign</button>
        <button :class="['tab', { active: mode === 'create' }]"  @click="setMode('create')">New Campaign</button>
        <button :class="['tab', { active: mode === 'reset' }]"   @click="setMode('reset')">Reset PIN</button>
      </div>

      <!-- Error banner -->
      <div v-if="auth.error" class="auth-error">
        {{ auth.error }}
        <button @click="auth.clearError()">✕</button>
      </div>

      <!-- ── Sign In ── -->
      <form v-if="mode === 'login'" @submit.prevent="doLogin" class="auth-form">
        <div class="field-row">
          <label>Campaign Code</label>
          <input v-model="form.code" type="text" placeholder="e.g. SPINWARD-42"
                 autocomplete="off" spellcheck="false" required />
        </div>
        <div class="field-row">
          <label>Character Name</label>
          <input v-model="form.characterName" type="text" placeholder="Your character's name"
                 autocomplete="off" required />
        </div>
        <div class="field-row">
          <label>PIN</label>
          <input v-model="form.pin" type="password" placeholder="Required"
                 autocomplete="current-password" required />
        </div>
        <button type="submit" class="submit-btn" :disabled="auth.loading">
          {{ auth.loading ? 'Verifying…' : 'Enter' }}
        </button>
      </form>

      <!-- ── Join Campaign ── -->
      <form v-else-if="mode === 'join'" @submit.prevent="doJoin" class="auth-form">
        <p class="form-hint">Join an existing campaign with a new character. Get the campaign code from your Referee.</p>
        <div class="field-row">
          <label>Campaign Code</label>
          <input v-model="form.code" type="text" placeholder="From your Referee"
                 autocomplete="off" spellcheck="false" required />
        </div>
        <div class="field-row">
          <label>Character Name</label>
          <input v-model="form.characterName" type="text" placeholder="Must be unique in this campaign"
                 autocomplete="off" required />
        </div>
        <div class="field-row">
          <label>PIN <span class="hint">(min 4 characters — cannot be changed)</span></label>
          <input v-model="form.pin" type="password" placeholder="Choose a PIN"
                 autocomplete="new-password" required />
        </div>
        <div class="field-row">
          <label>Confirm PIN</label>
          <input v-model="form.pinConfirm" type="password" placeholder="Repeat PIN"
                 autocomplete="new-password" required />
        </div>
        <button type="submit" class="submit-btn" :disabled="auth.loading">
          {{ auth.loading ? 'Registering…' : 'Join Campaign' }}
        </button>
      </form>

      <!-- ── New Campaign ── -->
      <form v-else-if="mode === 'create'" @submit.prevent="doCreate" class="auth-form">
        <p class="form-hint">Create a new campaign. You become the Referee. Share the code with your players.</p>
        <div class="field-row">
          <label>Campaign Name</label>
          <input v-model="form.label" type="text" placeholder="e.g. Spinward Marches Run"
                 autocomplete="off" required />
        </div>
        <div class="field-row">
          <label>Campaign Code <span class="hint">(share with players — uppercase, no spaces)</span></label>
          <input v-model="form.code" type="text" placeholder="e.g. SPINWARD-42"
                 autocomplete="off" spellcheck="false"
                 @input="form.code = form.code.toUpperCase().replace(/\s+/g,'-')"
                 required />
        </div>
        <div class="field-row">
          <label>Milieu</label>
          <select v-model="form.milieu">
            <option v-for="m in MILIEUS" :key="m.code" :value="m.code">{{ m.label }}</option>
          </select>
        </div>
        <div class="field-row">
          <label>Trade Rules</label>
          <select v-model="form.tradeRules">
            <option value="CT7">Classic Traveller Book 7</option>
            <option value="T5">Traveller 5th Edition</option>
          </select>
        </div>
        <div class="field-row">
          <label>Starting Date <span class="hint">(Imperial calendar — week is derived from day)</span></label>
          <div class="date-pair">
            <div class="date-field">
              <span class="date-label">Year</span>
              <input v-model.number="form.startYear" type="number" min="0" max="2500" step="1" />
            </div>
            <div class="date-field">
              <span class="date-label">Day (1–365)</span>
              <input v-model.number="form.startDay" type="number" min="1" max="365" step="1" />
            </div>
            <div class="date-field date-field--derived">
              <span class="date-label">Week</span>
              <span class="derived-value">{{ derivedStartWeek }}</span>
            </div>
          </div>
        </div>
        <div class="field-row">
          <label>Your Character Name (Referee)</label>
          <input v-model="form.characterName" type="text" placeholder="Referee character name"
                 autocomplete="off" required />
        </div>
        <div class="field-row">
          <label>PIN <span class="hint">(min 4 characters — cannot be changed)</span></label>
          <input v-model="form.pin" type="password" placeholder="Choose a PIN"
                 autocomplete="new-password" required />
        </div>
        <div class="field-row">
          <label>Confirm PIN</label>
          <input v-model="form.pinConfirm" type="password" placeholder="Repeat PIN"
                 autocomplete="new-password" required />
        </div>
        <button type="submit" class="submit-btn" :disabled="auth.loading">
          {{ auth.loading ? 'Creating…' : 'Create Campaign' }}
        </button>
      </form>

      <!-- ── Reset PIN ── -->
      <form v-else-if="mode === 'reset'" @submit.prevent="doReset" class="auth-form">
        <p class="form-hint">Reset a character's PIN using the campaign recovery code shown when the campaign was created.</p>
        <div class="field-row">
          <label>Campaign Code</label>
          <input v-model="form.code" type="text" placeholder="e.g. SPINWARD-42"
                 autocomplete="off" spellcheck="false" required />
        </div>
        <div class="field-row">
          <label>Character Name</label>
          <input v-model="form.characterName" type="text" placeholder="The character whose PIN to reset"
                 autocomplete="off" required />
        </div>
        <div class="field-row">
          <label>Recovery Code</label>
          <input v-model="form.recoveryCode" type="text" placeholder="From campaign creation"
                 autocomplete="off" spellcheck="false" required />
        </div>
        <div class="field-row">
          <label>New PIN <span class="hint">(min 4 characters)</span></label>
          <input v-model="form.pin" type="password" placeholder="Choose a new PIN"
                 autocomplete="new-password" required />
        </div>
        <div class="field-row">
          <label>Confirm New PIN</label>
          <input v-model="form.pinConfirm" type="password" placeholder="Repeat new PIN"
                 autocomplete="new-password" required />
        </div>
        <div v-if="resetSuccess" class="reset-success">
          PIN reset successfully. You can now sign in.
        </div>
        <button type="submit" class="submit-btn" :disabled="auth.loading || resetSuccess">
          {{ auth.loading ? 'Resetting…' : 'Reset PIN' }}
        </button>
      </form>
    </div>

  <RecoveryCodeDialog
    v-if="recoveryCode"
    :code="recoveryCode"
    @close="recoveryCode = null; router.push({ name: 'map' })"
  />

    <p class="login-footer">
      Non-commercial use only · Traveller is a registered trademark of Mongoose Publishing Ltd. · Copyright 1977–Present
    </p>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { MILIEUS } from '../lib/traveller-data.js'
import RecoveryCodeDialog from '../components/RecoveryCodeDialog.vue'

const auth   = useAuthStore()
const router = useRouter()

const mode         = ref('login')
const recoveryCode = ref(null)   // shown once after campaign creation
const resetSuccess = ref(false)

const form = reactive({
  code:          '',
  label:         '',
  characterName: '',
  pin:           '',
  pinConfirm:    '',
  recoveryCode:  '',
  milieu:        'M1105',
  tradeRules:    'CT7',
  startYear:     1105,
  startDay:      1,
})

// Day 1–365 → week 1–48 (ceil so day 1–7 = week 1, day 8–14 = week 2, etc.)
const derivedStartWeek = computed(() =>
  Math.min(48, Math.max(1, Math.ceil((form.startDay || 1) / 7)))
)

function setMode(m) {
  mode.value    = m
  resetSuccess.value = false
  auth.clearError()
  form.pin        = ''
  form.pinConfirm = ''
  form.recoveryCode = ''
}

function pinsMatch() {
  if (form.pin !== form.pinConfirm) {
    auth.error = 'PINs do not match'
    return false
  }
  return true
}

async function doLogin() {
  const result = await auth.login({
    code:          form.code,
    characterName: form.characterName,
    pin:           form.pin,
  })
  if (result.ok) router.push({ name: 'map' })
}

async function doJoin() {
  if (!pinsMatch()) return
  const result = await auth.joinCampaign({
    code:          form.code,
    characterName: form.characterName,
    pin:           form.pin,
  })
  if (result.ok) router.push({ name: 'map' })
}

async function doCreate() {
  if (!pinsMatch()) return
  const result = await auth.createCampaign({
    label:         form.label,
    code:          form.code,
    milieu:        form.milieu,
    tradeRules:    form.tradeRules,
    startYear:     form.startYear,
    startWeek:     derivedStartWeek.value,
    characterName: form.characterName,
    pin:           form.pin,
  })
  if (result.ok) {
    recoveryCode.value = result.recoveryCode
    // Navigation happens after the referee dismisses the recovery code dialog
  }
}

async function doReset() {
  if (!pinsMatch()) return
  const result = await auth.resetPin({
    code:          form.code,
    characterName: form.characterName,
    recoveryCode:  form.recoveryCode,
    newPin:        form.pin,
  })
  if (result.ok) {
    resetSuccess.value = true
    form.pin        = ''
    form.pinConfirm = ''
    form.recoveryCode = ''
  }
}
</script>

<style scoped>
.login-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem;
  background: var(--bg);
}

.login-card {
  width: 100%;
  max-width: 440px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 2rem;
  margin-top: auto;
  margin-bottom: auto;
}

.login-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.login-header h1 {
  font-size: 1.3rem;
  color: var(--accent);
  letter-spacing: 0.04em;
}

.login-sub {
  font-size: 0.8rem;
  color: var(--text-dim);
  margin-top: 0.3rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mode-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1.25rem;
}

.tab {
  flex: 1;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 0.78rem;
  padding: 0.45rem 0.5rem;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.15s;
}

.tab:hover { border-color: var(--accent-dim); color: var(--text); }
.tab.active { background: var(--bg-selected); border-color: var(--accent-dim); color: var(--accent); }

.auth-error {
  background: #3a1a1a;
  border: 1px solid var(--red);
  color: #f5a0a0;
  border-radius: var(--radius);
  padding: 0.6rem 1rem;
  font-size: 0.83rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
}

.auth-error button {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1rem;
  flex-shrink: 0;
}

.auth-form { display: flex; flex-direction: column; gap: 0.85rem; }

.form-hint {
  font-size: 0.78rem;
  color: var(--text-dim);
  line-height: 1.5;
}

.field-row { display: flex; flex-direction: column; gap: 0.3rem; }

.date-pair {
  display: flex;
  gap: 0.75rem;
}
.date-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}
.date-label {
  font-size: 0.65rem;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.date-field--derived { flex: 0 0 4rem; }
.derived-value {
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.5rem 0.7rem;
  font-size: 0.88rem;
  color: var(--text-dim);
  text-align: center;
}

.field-row label {
  font-size: 0.72rem;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.field-row .hint {
  text-transform: none;
  letter-spacing: 0;
  font-size: 0.68rem;
}

.field-row input,
.field-row select {
  background: var(--bg-item);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.5rem 0.7rem;
  font-size: 0.88rem;
  width: 100%;
  outline: none;
}

.field-row input:focus,
.field-row select:focus { border-color: var(--accent-dim); }

.submit-btn {
  background: var(--accent-dim);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  padding: 0.65rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: 0.04em;
  margin-top: 0.25rem;
  transition: background 0.15s;
}

.submit-btn:hover:not(:disabled) { background: var(--accent); }
.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.reset-success {
  background: rgba(76, 175, 114, 0.1);
  border: 1px solid var(--green);
  color: var(--green);
  border-radius: var(--radius);
  padding: 0.6rem 0.85rem;
  font-size: 0.82rem;
}

.login-footer {
  margin-top: 1.5rem;
  font-size: 0.68rem;
  color: var(--text-dim);
  text-align: center;
  letter-spacing: 0.04em;
}
</style>
