<template>
  <div class="orgs-panel">
    <div class="col-header">
      <h3>Organizations</h3>
      <button class="btn-primary btn-sm" @click="showNewOrg = !showNewOrg">
        {{ showNewOrg ? 'Cancel' : '+ Found Organization' }}
      </button>
    </div>

    <form v-if="showNewOrg" class="detail-form" @submit.prevent="submitNewOrg">
      <div class="form-row">
        <label>Name</label>
        <input v-model="newOrg.name" required placeholder="Spinward Traders' Guild" />
      </div>
      <div class="form-row two-col">
        <div>
          <label>Treasury (Cr)</label>
          <input v-model.number="newOrg.treasuryCredits" type="number" min="0" />
        </div>
        <div>
          <label>Dues Rate (Cr, flat)</label>
          <input v-model.number="newOrg.duesRate" type="number" min="0" placeholder="Optional" />
        </div>
      </div>
      <div class="form-row">
        <label>Notes</label>
        <input v-model="newOrg.notes" placeholder="Optional" />
      </div>
      <div class="form-actions">
        <button type="submit" class="btn-primary" :disabled="!newOrg.name.trim()">Found</button>
      </div>
      <p v-if="orgError" class="form-error">{{ orgError }}</p>
    </form>

    <div v-if="loading" class="placeholder">Loading…</div>
    <div v-else-if="!organizations.length" class="placeholder">No organizations yet</div>

    <div v-else class="org-list">
      <div v-for="o in organizations" :key="o.id" class="org-card">
        <div class="org-card-header" @click="toggleOrg(o.id)">
          <div class="org-identity">
            <span class="org-name">{{ o.name }}</span>
            <span class="org-badge">Cr{{ o.treasury_credits.toLocaleString() }}</span>
            <span v-if="o.dues_rate" class="org-badge">Dues Cr{{ o.dues_rate.toLocaleString() }}</span>
            <span v-if="o.is_officer || auth.isReferee" class="org-badge officer">Officer</span>
          </div>
          <span class="expand-icon">{{ expandedId === o.id ? '▲' : '▼' }}</span>
        </div>

        <div v-if="expandedId === o.id" class="org-detail">
          <p v-if="o.notes" class="org-notes">{{ o.notes }}</p>

          <template v-if="canManage(o)">
            <form class="detail-form" @submit.prevent="submitEditOrg(o)">
              <div class="form-row two-col">
                <div>
                  <label>Treasury (Cr)</label>
                  <input v-model.number="editFields[o.id].treasuryCredits" type="number" min="0" />
                </div>
                <div>
                  <label>Dues Rate (Cr, flat)</label>
                  <input v-model.number="editFields[o.id].duesRate" type="number" min="0" placeholder="None" />
                </div>
              </div>
              <div class="form-row">
                <label>Notes</label>
                <input v-model="editFields[o.id].notes" placeholder="Optional" />
              </div>
              <div class="form-actions">
                <button type="submit" class="btn-ghost btn-sm">Save</button>
                <button type="button" class="btn-danger btn-sm" @click="removeOrg(o)">Delete Organization</button>
              </div>
            </form>
          </template>

          <h4>Officers</h4>
          <ul v-if="officers[o.id]?.length" class="plain-list">
            <li v-for="off in officers[o.id]" :key="off.id">
              {{ off.character_name }}
              <button v-if="canManage(o)" class="btn-danger btn-xs" @click="removeOfficer(o, off)">Remove</button>
            </li>
          </ul>
          <div v-else class="placeholder sm">No officers</div>

          <form v-if="canManage(o)" class="add-row-form" @submit.prevent="addOfficer(o.id)">
            <select v-model="newOfficerPlayerId[o.id]">
              <option value="">— Select player —</option>
              <option v-for="p in campaignPlayers" :key="p.id" :value="p.id">{{ p.character_name }}</option>
            </select>
            <button type="submit" class="btn-ghost btn-sm" :disabled="!newOfficerPlayerId[o.id]">Add</button>
          </form>
          <p v-if="officerError[o.id]" class="form-error">{{ officerError[o.id] }}</p>

          <h4>Member Ships</h4>
          <ul v-if="members[o.id]?.length" class="plain-list">
            <li v-for="m in members[o.id]" :key="m.id">
              {{ m.ship_name }}<span v-if="m.owns_ship" class="org-badge">Owned</span>
              <button v-if="canManage(o)" class="btn-danger btn-xs" @click="removeMember(o, m)">Remove</button>
            </li>
          </ul>
          <div v-else class="placeholder sm">No ships in this organization</div>

          <form v-if="canManage(o) && ship.hasShip && !isMyShipMember(o)"
                class="add-row-form" @submit.prevent="addMyShip(o.id)">
            <span class="my-ship-label">{{ ship.ship.name }}</span>
            <label class="owns-check-label">
              <input type="checkbox" v-model="newMemberOwnsShip[o.id]" /> Owns assets
            </label>
            <button type="submit" class="btn-ghost btn-sm">Add My Ship</button>
          </form>
          <p v-if="memberError[o.id]" class="form-error">{{ memberError[o.id] }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useShipStore } from '../stores/ship.js'
import { api } from '../lib/api.js'

const auth = useAuthStore()
const ship = useShipStore()

const organizations   = ref([])
const loading         = ref(false)
const showNewOrg      = ref(false)
const orgError        = ref('')
const campaignPlayers = ref([])

const NEW_ORG_DEFAULTS = { name: '', treasuryCredits: 0, duesRate: null, notes: '' }
const newOrg = ref({ ...NEW_ORG_DEFAULTS })

const expandedId        = ref(null)
const editFields         = ref({})   // { [orgId]: { treasuryCredits, duesRate, notes } }
const officers           = ref({})   // { [orgId]: [...] }
const members            = ref({})   // { [orgId]: [...] }
const newOfficerPlayerId = ref({})   // { [orgId]: playerId }
const newMemberOwnsShip  = ref({})   // { [orgId]: bool }
const officerError       = ref({})   // { [orgId]: string }
const memberError        = ref({})   // { [orgId]: string }

function canManage(o) {
  return o.is_officer || auth.isReferee
}

function isMyShipMember(o) {
  if (!ship.hasShip) return false
  return (members.value[o.id] ?? []).some(m => m.ship_id === ship.ship.id)
}

async function loadOrganizations() {
  loading.value = true
  const { data, error: err } = await api.get('/api/organizations')
  if (!err) organizations.value = data ?? []
  loading.value = false
}

async function loadPlayers() {
  const { data } = await api.get('/api/organizations/campaign-players')
  campaignPlayers.value = data ?? []
}

async function submitNewOrg() {
  orgError.value = ''
  const { data, error: err } = await api.post('/api/organizations', {
    name:             newOrg.value.name.trim(),
    treasury_credits: newOrg.value.treasuryCredits ?? 0,
    dues_rate:        newOrg.value.duesRate ?? null,
    notes:            newOrg.value.notes || null,
  })
  if (err) { orgError.value = err; return }
  organizations.value = [...organizations.value, data].sort((a, b) => a.name.localeCompare(b.name))
  showNewOrg.value = false
  newOrg.value = { ...NEW_ORG_DEFAULTS }
}

async function toggleOrg(orgId) {
  if (expandedId.value === orgId) { expandedId.value = null; return }
  expandedId.value = orgId
  const o = organizations.value.find(x => x.id === orgId)
  editFields.value[orgId] = { treasuryCredits: o.treasury_credits, duesRate: o.dues_rate, notes: o.notes }
  await Promise.all([loadOfficers(orgId), loadMembers(orgId)])
}

async function loadOfficers(orgId) {
  const { data, error: err } = await api.get(`/api/organizations/${orgId}/officers`)
  if (err) { officerError.value[orgId] = err; return }
  officers.value[orgId] = data ?? []
}

async function loadMembers(orgId) {
  const { data, error: err } = await api.get(`/api/organizations/${orgId}/members`)
  if (err) { memberError.value[orgId] = err; return }
  members.value[orgId] = data ?? []
}

async function submitEditOrg(o) {
  orgError.value = ''
  const fields = editFields.value[o.id]
  const { data, error: err } = await api.patch(`/api/organizations/${o.id}`, {
    treasury_credits: fields.treasuryCredits,
    dues_rate:        fields.duesRate,
    notes:            fields.notes,
  })
  if (err) { orgError.value = err; return }
  organizations.value = organizations.value.map(x => x.id === o.id ? { ...x, ...data } : x)
}

async function removeOrg(o) {
  if (!confirm(`Delete organization "${o.name}"?`)) return
  const { error: err } = await api.delete(`/api/organizations/${o.id}`)
  if (err) { orgError.value = err; return }
  organizations.value = organizations.value.filter(x => x.id !== o.id)
  if (expandedId.value === o.id) expandedId.value = null
}

async function addOfficer(orgId) {
  officerError.value[orgId] = ''
  const { data, error: err } = await api.post(`/api/organizations/${orgId}/officers`, {
    player_id: newOfficerPlayerId.value[orgId],
  })
  if (err) { officerError.value[orgId] = err; return }
  officers.value[orgId] = [...(officers.value[orgId] ?? []), data]
  newOfficerPlayerId.value[orgId] = ''
}

async function removeOfficer(o, off) {
  if (!confirm(`Remove ${off.character_name} as an officer of this organization?`)) return
  const { error: err } = await api.delete(`/api/organizations/${o.id}/officers/${off.player_id}`)
  if (err) { officerError.value[o.id] = err; return }
  officers.value[o.id] = officers.value[o.id].filter(x => x.id !== off.id)
}

async function addMyShip(orgId) {
  memberError.value[orgId] = ''
  const { data, error: err } = await api.post(`/api/organizations/${orgId}/members`, {
    ship_id:   ship.ship.id,
    owns_ship: !!newMemberOwnsShip.value[orgId],
  })
  if (err) { memberError.value[orgId] = err; return }
  members.value[orgId] = [...(members.value[orgId] ?? []), data]
  newMemberOwnsShip.value[orgId] = false
}

async function removeMember(o, m) {
  if (!confirm(`Remove ${m.ship_name} from this organization?`)) return
  const { error: err } = await api.delete(`/api/organizations/${o.id}/members/${m.id}`)
  if (err) { memberError.value[o.id] = err; return }
  members.value[o.id] = members.value[o.id].filter(x => x.id !== m.id)
}

onMounted(async () => {
  await Promise.all([loadOrganizations(), loadPlayers()])
})
</script>

<style scoped>
.orgs-panel {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.col-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.col-header h3 { margin: 0; font-size: 0.95rem; }

.org-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.org-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-panel);
  overflow: hidden;
}

.org-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
}
.org-card-header:hover { background: var(--bg-hover); }

.org-identity {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.org-name { font-weight: 600; font-size: 0.88rem; }

.org-badge {
  font-size: 0.68rem;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--bg-hover);
  color: var(--text-dim);
  white-space: nowrap;
}
.org-badge.officer { background: rgba(52,211,153,0.15); color: #34d399; }

.expand-icon { color: var(--text-dim); font-size: 0.7rem; }

.org-detail {
  padding: 0.6rem 0.75rem 0.75rem;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.org-notes { font-size: 0.82rem; color: var(--text-dim); margin: 0; }

.org-detail h4 {
  margin: 0.4rem 0 0.1rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}

.plain-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.plain-list li {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
}

.add-row-form {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}
.add-row-form select {
  flex: 1;
  padding: 0.25rem 0.4rem;
  background: var(--bg-input, var(--bg-panel));
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.8rem;
}

.my-ship-label { font-size: 0.82rem; }

.owns-check-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.78rem;
  color: var(--text-dim);
  white-space: nowrap;
}

.detail-form {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.form-row label {
  display: block;
  font-size: 0.72rem;
  color: var(--text-dim);
  margin-bottom: 0.15rem;
}
.form-row input {
  width: 100%;
  padding: 0.3rem 0.5rem;
  background: var(--bg-input, var(--bg-panel));
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.82rem;
  box-sizing: border-box;
}
.form-row.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
.form-actions {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.2rem;
}

.btn-primary, .btn-ghost, .btn-danger {
  border-radius: var(--radius);
  cursor: pointer;
  font-weight: 600;
  border: 1px solid transparent;
}
.btn-primary { background: var(--accent-dim); color: #fff; padding: 0.3rem 0.8rem; font-size: 0.8rem; }
.btn-primary:hover:not(:disabled) { background: var(--accent); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-sm { padding: 0.25rem 0.6rem; font-size: 0.78rem; }
.btn-xs { padding: 0.1rem 0.4rem; font-size: 0.68rem; }
.btn-ghost { background: transparent; border-color: var(--border); color: var(--text); }
.btn-ghost:hover { background: var(--bg-hover); }
.btn-danger { background: transparent; border-color: var(--red, #f87171); color: var(--red, #f87171); }
.btn-danger:hover { background: rgba(248,113,113,0.1); }

.form-error {
  font-size: 0.78rem;
  color: var(--red, #f87171);
  margin: 0.2rem 0 0;
}

.placeholder {
  color: var(--text-dim);
  font-size: 0.85rem;
  font-style: italic;
  padding: 1.5rem 0;
  text-align: center;
}
.placeholder.sm { padding: 0.4rem 0; font-size: 0.78rem; }
</style>
