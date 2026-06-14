<template>
  <!-- ── Header ──────────────────────────────────────────────────────────── -->
  <header class="ref-header">
    <button class="back-btn" @click="router.push({ name: 'map' })">← Map</button>
    <div class="header-title">
      <h1>Campaign Management</h1>
      <span class="header-sub">{{ auth.campaign?.label }} · {{ auth.campaign?.code }}</span>
    </div>
    <div class="header-meta">
      <span class="rules-badge">{{ auth.campaign?.trade_rules }}</span>
      <span class="tick-badge">Tick {{ tick.currentTick }}</span>
    </div>
  </header>

  <!-- ── Tab bar ─────────────────────────────────────────────────────────── -->
  <nav class="ref-tabs" role="tablist">
    <button v-for="t in TABS" :key="t.key"
            role="tab"
            :aria-selected="activeTab === t.key"
            :class="['rtab', { active: activeTab === t.key }]"
            @click="switchTab(t.key)">
      {{ t.label }}
    </button>
  </nav>

  <main class="ref-body">

    <!-- ════════════════════════════════════════════════════════════════════ -->
    <!-- SHIPS TAB                                                            -->
    <!-- ════════════════════════════════════════════════════════════════════ -->
    <section v-if="activeTab === 'ships'" class="tab-pane">
      <div class="ships-layout">

        <!-- Ship list -->
        <div class="ship-list-col">
          <div class="col-header">
            <h2>Ships</h2>
            <button class="btn-primary btn-sm" @click="openNewShip">+ New Ship</button>
          </div>

          <div v-if="referee.loading" class="placeholder">Loading…</div>
          <div v-else-if="!referee.ships.length" class="placeholder">No ships yet</div>
          <ul v-else class="ship-list">
            <li v-for="s in referee.ships" :key="s.id"
                :class="['ship-item', { active: selectedShipId === s.id }]"
                @click="selectShip(s.id)">
              <span class="ship-name">{{ s.name }}</span>
              <span class="ship-type">{{ s.hull_type || '—' }}</span>
              <span class="ship-crew-count">{{ s.crew.length }} crew</span>
            </li>
          </ul>
        </div>

        <!-- Ship detail / create form -->
        <div class="ship-detail-col">

          <!-- Create form -->
          <template v-if="showNewShipForm">
            <h2>New Ship</h2>
            <form class="detail-form" @submit.prevent="submitNewShip">
              <div class="form-row">
                <label>Name <span class="req">*</span></label>
                <input v-model="newShip.name" required placeholder="Free Trader Beowulf" />
              </div>
              <div class="form-row">
                <label>Hull Type</label>
                <input v-model="newShip.hullType" placeholder="Free Trader, Scout/Courier…" />
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Hull Tons</label>
                  <input v-model.number="newShip.hullTons" type="number" min="1" />
                </div>
                <div>
                  <label>Cargo Capacity (t)</label>
                  <input v-model.number="newShip.cargoCapacity" type="number" min="0" />
                </div>
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Starting Credits (Cr)</label>
                  <input v-model.number="newShip.credits" type="number" min="0" />
                </div>
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Jump Rating (J-1–J-6)</label>
                  <input v-model.number="newShip.jumpRating" type="number" min="1" max="6" placeholder="—" />
                </div>
                <div>
                  <label>Maneuver Drive (1–9)</label>
                  <input v-model.number="newShip.maneuverRating" type="number" min="1" max="9" placeholder="—" />
                </div>
              </div>
              <div class="form-actions">
                <button type="button" class="btn-ghost" @click="cancelNewShip">Cancel</button>
                <button type="submit" class="btn-primary" :disabled="!newShip.name.trim()">Create Ship</button>
              </div>
              <p v-if="shipError" class="form-error">{{ shipError }}</p>
            </form>
          </template>

          <!-- Ship detail + crew -->
          <template v-else-if="selectedShip">
            <div class="detail-header-row">
              <h2>{{ selectedShip.name }}</h2>
              <button class="btn-ghost btn-sm" @click="editingShip = !editingShip">
                {{ editingShip ? 'Cancel' : 'Edit' }}
              </button>
            </div>

            <!-- Inline edit form -->
            <form v-if="editingShip" class="detail-form" @submit.prevent="submitEditShip">
              <div class="form-row">
                <label>Hull Type</label>
                <input v-model="editShipFields.hullType" />
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Hull Tons</label>
                  <input v-model.number="editShipFields.hullTons" type="number" min="1" />
                </div>
                <div>
                  <label>Cargo Capacity (t)</label>
                  <input v-model.number="editShipFields.cargoCapacity" type="number" min="0" />
                </div>
              </div>
              <div class="form-row">
                <label>Credits (Cr)</label>
                <input v-model.number="editShipFields.credits" type="number" />
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Jump Rating (J-1–J-6)</label>
                  <input v-model.number="editShipFields.jumpRating" type="number" min="1" max="6" placeholder="—" />
                </div>
                <div>
                  <label>Maneuver Drive (1–9)</label>
                  <input v-model.number="editShipFields.maneuverRating" type="number" min="1" max="9" placeholder="—" />
                </div>
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Location Hex</label>
                  <input v-model="editShipFields.currentWorld" placeholder="e.g. 1910" maxlength="4" />
                </div>
                <div>
                  <label>Sector</label>
                  <input v-model="editShipFields.currentSector" placeholder="Spinward Marches" />
                </div>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn-primary">Save</button>
              </div>
            </form>

            <!-- Ship stats -->
            <div v-else class="stat-grid">
              <div class="stat"><label>Hull Type</label><span>{{ selectedShip.hull_type || '—' }}</span></div>
              <div class="stat"><label>Hull Tons</label><span>{{ selectedShip.hull_tons }}t</span></div>
              <div class="stat"><label>Cargo Capacity</label><span>{{ selectedShip.cargo_capacity }}t</span></div>
              <div class="stat"><label>Credits</label><span>Cr{{ selectedShip.credits.toLocaleString() }}</span></div>
              <div class="stat"><label>Jump Rating</label><span>{{ selectedShip.jump_rating ? 'J-' + selectedShip.jump_rating : '—' }}</span></div>
              <div class="stat"><label>Maneuver</label><span>{{ selectedShip.maneuver_drive_rating ? selectedShip.maneuver_drive_rating + 'G' : '—' }}</span></div>
              <div class="stat"><label>Location</label>
                <span>{{ selectedShip.current_world || '—' }}
                  <span v-if="selectedShip.current_sector"> · {{ selectedShip.current_sector }}</span>
                </span>
              </div>
            </div>

            <!-- Crew roster -->
            <div class="crew-section">
              <div class="col-header">
                <h3>Crew</h3>
                <button class="btn-ghost btn-sm" @click="showAddCrew = !showAddCrew">
                  {{ showAddCrew ? 'Cancel' : '+ Add Crew' }}
                </button>
              </div>

              <!-- Add crew form -->
              <form v-if="showAddCrew" class="crew-add-form" @submit.prevent="submitAddCrew">
                <select v-model="newCrewPlayerId" required>
                  <option value="">— Select player —</option>
                  <option v-for="p in unassignedPlayers" :key="p.id" :value="p.id">
                    {{ p.character_name }}
                  </option>
                </select>
                <select v-model="newCrewRole">
                  <option v-for="r in CREW_ROLES" :key="r" :value="r">{{ r }}</option>
                </select>
                <button type="submit" class="btn-primary btn-sm"
                        :disabled="!newCrewPlayerId">Add</button>
                <p v-if="crewError" class="form-error">{{ crewError }}</p>
              </form>

              <div v-if="!selectedShip.crew.length" class="placeholder sm">No crew assigned</div>
              <table v-else class="crew-table">
                <thead>
                  <tr>
                    <th>Character</th>
                    <th>Role</th>
                    <th class="center">Can Trade</th>
                    <th>Since Tick</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in selectedShip.crew" :key="c.id">
                    <td>{{ c.players?.character_name ?? '—' }}</td>
                    <td>
                      <select :value="c.role"
                              @change="changeCrewRole(c, $event.target.value)">
                        <option v-for="r in CREW_ROLES" :key="r" :value="r">{{ r }}</option>
                      </select>
                    </td>
                    <td class="center">
                      <input type="checkbox"
                             :checked="c.can_trade"
                             class="trade-check"
                             @change="referee.setCrewCanTrade(c, $event.target.checked)" />
                    </td>
                    <td>{{ c.joined_tick }}</td>
                    <td>
                      <button class="btn-danger btn-xs"
                              @click="confirmRemoveCrew(c)">Remove</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <div v-else class="placeholder">Select a ship or create a new one</div>
        </div>
      </div>
    </section>

    <!-- ════════════════════════════════════════════════════════════════════ -->
    <!-- PLAYERS TAB                                                          -->
    <!-- ════════════════════════════════════════════════════════════════════ -->
    <section v-if="activeTab === 'players'" class="tab-pane">
      <div v-if="referee.loading" class="placeholder">Loading…</div>
      <div v-else-if="!referee.players.length" class="placeholder">No players yet</div>

      <div v-else class="player-list">
        <div v-for="p in referee.players" :key="p.id" class="player-card">
          <div class="player-card-header" @click="togglePlayer(p.id)">
            <div class="player-identity">
              <span class="player-name">{{ p.character_name }}</span>
              <span class="role-badge" :class="p.role">{{ p.role }}</span>
              <span v-if="p.current_ship" class="ship-badge">{{ p.current_ship }}</span>
            </div>
            <span class="expand-icon">{{ expandedPlayerId === p.id ? '▲' : '▼' }}</span>
          </div>

          <div v-if="expandedPlayerId === p.id" class="player-skills">
            <h4>Skills</h4>
            <table v-if="p.skills.length" class="skills-table">
              <thead><tr><th>Skill</th><th>Level</th><th></th></tr></thead>
              <tbody>
                <tr v-for="s in p.skills" :key="s.id">
                  <td>{{ s.skill }}</td>
                  <td>
                    <input type="number" :value="s.level" min="0" max="10"
                           class="level-input"
                           @change="saveSkill(p, s.skill, +$event.target.value)" />
                  </td>
                  <td>
                    <button class="btn-danger btn-xs" @click="deleteSkill(p, s.id)">✕</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="placeholder sm">No skills recorded</div>

            <!-- Add skill row -->
            <form class="add-skill-form" @submit.prevent="addSkill(p)">
              <input v-model="newSkillName[p.id]" placeholder="Skill name" />
              <input v-model.number="newSkillLevel[p.id]" type="number" min="0" max="10"
                     placeholder="Lvl" class="level-input" />
              <button type="submit" class="btn-ghost btn-sm"
                      :disabled="!newSkillName[p.id]?.trim()">Add</button>
            </form>
            <p v-if="skillError[p.id]" class="form-error">{{ skillError[p.id] }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ════════════════════════════════════════════════════════════════════ -->
    <!-- EVENTS TAB                                                           -->
    <!-- ════════════════════════════════════════════════════════════════════ -->
    <section v-if="activeTab === 'events'" class="tab-pane">
      <div class="events-layout">

        <!-- Active events -->
        <div class="events-col">
          <h2>Active Events</h2>
          <div v-if="!activeEvents.length" class="placeholder">No active events</div>
          <div v-else class="event-list">
            <div v-for="ev in activeEvents" :key="ev.id" class="event-card"
                 :class="ev.severity">
              <div class="event-card-body">
                <span class="event-desc">{{ ev.description }}</span>
                <span class="event-meta">
                  {{ ev.scope === 'local' ? ev.world_hex : 'Subsector' }}
                  · {{ ev.effect_pct > 0 ? '+' : '' }}{{ ev.effect_pct }}%
                  · expires tick {{ ev.expires_tick }}
                </span>
              </div>
              <button class="btn-danger btn-xs"
                      @click="doExpireEvent(ev.id)">Expire</button>
            </div>
          </div>
        </div>

        <!-- Create event form -->
        <div class="events-col">
          <h2>Create Event</h2>
          <form class="detail-form" @submit.prevent="submitEvent">
            <div class="form-row">
              <label>Scope</label>
              <select v-model="newEvent.scope">
                <option value="local">Local (single world)</option>
                <option value="subsector">Subsector-wide</option>
              </select>
            </div>
            <div v-if="newEvent.scope === 'local'" class="form-row two-col">
              <div>
                <label>World Hex</label>
                <input v-model="newEvent.worldHex" placeholder="e.g. 1910" />
              </div>
              <div>
                <label>Sector</label>
                <input v-model="newEvent.sector" placeholder="e.g. Spinward Marches" />
              </div>
            </div>
            <div v-else class="form-row">
              <label>Sector</label>
              <input v-model="newEvent.sector" placeholder="e.g. Spinward Marches" />
            </div>
            <div class="form-row">
              <label>Description <span class="req">*</span></label>
              <input v-model="newEvent.description" required placeholder="What's happening?" />
            </div>
            <div class="form-row two-col">
              <div>
                <label>Buy modifier %</label>
                <input v-model.number="newEvent.buyModifierPct" type="number"
                       placeholder="+20 or -15" />
              </div>
              <div>
                <label>Sell modifier %</label>
                <input v-model.number="newEvent.sellModifierPct" type="number"
                       placeholder="+20 or -15" />
              </div>
            </div>
            <div class="form-row two-col">
              <div>
                <label>Duration (ticks)</label>
                <input v-model.number="newEvent.durationTicks" type="number" min="1" />
              </div>
            </div>
            <div class="form-row">
              <label>Trade Good Die</label>
              <input v-model="newEvent.tradeGoodDie" placeholder="e.g. 36 — leave blank for all" />
            </div>
            <div class="form-actions">
              <button type="submit" class="btn-primary"
                      :disabled="!newEvent.description.trim()">Create Event</button>
            </div>
            <p v-if="eventError" class="form-error">{{ eventError }}</p>
            <p v-if="eventSuccess" class="form-success">Event created.</p>
          </form>
        </div>
      </div>
    </section>

    <!-- ════════════════════════════════════════════════════════════════════ -->
    <!-- CAMPAIGN TAB                                                         -->
    <!-- ════════════════════════════════════════════════════════════════════ -->
    <section v-if="activeTab === 'campaign'" class="tab-pane">
      <div class="campaign-settings">
        <h2>Campaign Settings</h2>
        <div class="stat-grid wide">
          <div class="stat"><label>Campaign Code</label><span>{{ auth.campaign?.code }}</span></div>
          <div class="stat"><label>Label</label><span>{{ auth.campaign?.label }}</span></div>
          <div class="stat"><label>Milieu</label><span>{{ auth.campaign?.milieu }}</span></div>
          <div class="stat locked">
            <label>Trade Rules</label>
            <span>{{ auth.campaign?.trade_rules }}
              <span class="lock-note">locked at creation</span>
            </span>
          </div>
        </div>

        <div class="campaign-traveller-map">
          <h3>Traveller Map</h3>
          <p>View the sector map and world details on the official Traveller Map.</p>
          <a :href="travellerMapUrl" target="_blank" rel="noopener" class="btn-primary external-link">
            Open Traveller Map ↗
          </a>
        </div>

        <div class="campaign-security">
          <h3>Security</h3>
          <p>The recovery code lets you reset any character's PIN from the sign-in screen without database access.</p>
          <p class="security-warn">Generating a new code immediately invalidates the previous one.</p>
          <button class="btn-secondary" :disabled="regenLoading" @click="doRegenerate">
            {{ regenLoading ? 'Generating…' : 'Generate New Recovery Code' }}
          </button>
          <div v-if="regenError" class="regen-error">{{ regenError }}</div>
        </div>

        <div class="campaign-danger">
          <h3>Danger Zone</h3>
          <p>Permanently delete this campaign and all its data — ships, cargo, market history, players, and events. This action cannot be undone.</p>
          <template v-if="!showDeleteConfirm">
            <button class="btn-danger btn-delete" @click="openDeleteConfirm">Delete Campaign…</button>
          </template>
          <template v-else>
            <p class="delete-warn">Enter your Referee PIN to confirm deletion.</p>
            <div class="delete-form">
              <input v-model="deletePin"
                     type="password"
                     placeholder="Referee PIN"
                     autocomplete="current-password"
                     class="delete-pin-input"
                     @keydown.enter.prevent="doDeleteCampaign"
                     @keydown.escape.prevent="cancelDelete" />
              <button class="btn-danger"
                      :disabled="!deletePin.trim() || deleteLoading"
                      @click="doDeleteCampaign">
                {{ deleteLoading ? 'Deleting…' : 'Confirm Delete' }}
              </button>
              <button class="btn-ghost" @click="cancelDelete">Cancel</button>
            </div>
            <p v-if="deleteError" class="form-error">{{ deleteError }}</p>
          </template>
        </div>
      </div>
    </section>

  </main>

  <RecoveryCodeDialog
    v-if="newRecoveryCode"
    :code="newRecoveryCode"
    @close="newRecoveryCode = null"
  />
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useTickStore } from '../stores/tick.js'
import { useRefereeStore } from '../stores/referee.js'
import RecoveryCodeDialog from '../components/RecoveryCodeDialog.vue'

const router = useRouter()
const auth   = useAuthStore()
const tick   = useTickStore()
const referee = useRefereeStore()

const TABS = [
  { key: 'ships',    label: 'Ships'    },
  { key: 'players',  label: 'Players'  },
  { key: 'events',   label: 'Events'   },
  { key: 'campaign', label: 'Campaign' },
]

const CREW_ROLES = ['captain', 'pilot', 'navigator', 'engineer', 'medic', 'steward', 'gunner', 'cargo-master', 'crew']

const activeTab = ref('ships')

function switchTab(key) {
  activeTab.value = key
  if (key === 'players') loadPlayers()
}

// ── Campaign tab state ───────────────────────────────────────────────────────

const newRecoveryCode  = ref(null)
const regenLoading     = ref(false)
const regenError       = ref('')
const showDeleteConfirm = ref(false)
const deletePin        = ref('')
const deleteLoading    = ref(false)
const deleteError      = ref('')

async function doRegenerate() {
  regenLoading.value = true
  regenError.value   = ''
  const result = await auth.regenerateRecoveryCode()
  regenLoading.value = false
  if (result.ok) newRecoveryCode.value = result.recoveryCode
  else regenError.value = result.error ?? 'Failed to regenerate'
}

function openDeleteConfirm() {
  showDeleteConfirm.value = true
  deletePin.value         = ''
  deleteError.value       = ''
}

function cancelDelete() {
  showDeleteConfirm.value = false
  deletePin.value         = ''
  deleteError.value       = ''
}

async function doDeleteCampaign() {
  if (!deletePin.value.trim()) return
  deleteLoading.value = true
  deleteError.value   = ''
  const result = await auth.deleteCampaign({ pin: deletePin.value })
  deleteLoading.value = false
  if (result.ok) {
    router.push({ name: 'login' })
  } else {
    deleteError.value = result.error ?? 'Deletion failed'
    deletePin.value   = ''
  }
}

// ── Ships tab state ──────────────────────────────────────────────────────────

const selectedShipId  = ref(null)
const showNewShipForm = ref(false)
const editingShip     = ref(false)
const showAddCrew     = ref(false)
const shipError       = ref('')
const crewError       = ref('')

const newCrewPlayerId = ref('')
const newCrewRole     = ref('crew')

const newShip = ref({ name: '', hullType: '', hullTons: 200, cargoCapacity: 80, credits: 0, jumpRating: null, maneuverRating: null })
const editShipFields = ref({})

const selectedShip = computed(() => referee.ships.find(s => s.id === selectedShipId.value) ?? null)

const unassignedPlayers = computed(() => {
  const assignedIds = new Set(referee.ships.flatMap(s => s.crew.map(c => c.players?.id)))
  return referee.players.filter(p => !assignedIds.has(p.id))
})

function selectShip(id) {
  selectedShipId.value = id
  showNewShipForm.value = false
  editingShip.value     = false
  showAddCrew.value     = false
  shipError.value       = ''
  crewError.value       = ''
  if (editShipFields.value && selectedShip.value) {
    const s = selectedShip.value
    editShipFields.value = {
      hullType:       s.hull_type             ?? '',
      hullTons:       s.hull_tons             ?? 200,
      cargoCapacity:  s.cargo_capacity        ?? 80,
      credits:        s.credits               ?? 0,
      jumpRating:     s.jump_rating           ?? null,
      maneuverRating: s.maneuver_drive_rating ?? null,
      currentWorld:   s.current_world         ?? '',
      currentSector:  s.current_sector        ?? '',
    }
  }
}

function openNewShip() {
  showNewShipForm.value = true
  selectedShipId.value  = null
  shipError.value       = ''
  newShip.value = { name: '', hullType: '', hullTons: 200, cargoCapacity: 80, credits: 0, jumpRating: null, maneuverRating: null }
}

function cancelNewShip() {
  showNewShipForm.value = false
  shipError.value       = ''
}

async function submitNewShip() {
  shipError.value = ''
  try {
    const created = await referee.createShip(auth.campaign.id, newShip.value)
    showNewShipForm.value = false
    selectShip(created.id)
  } catch (e) {
    shipError.value = e.message
  }
}

async function submitEditShip() {
  try {
    await referee.updateShip(selectedShipId.value, {
      hull_type:             editShipFields.value.hullType        || null,
      hull_tons:             editShipFields.value.hullTons,
      cargo_capacity:        editShipFields.value.cargoCapacity,
      credits:               editShipFields.value.credits,
      jump_rating:           editShipFields.value.jumpRating       || null,
      maneuver_drive_rating: editShipFields.value.maneuverRating   || null,
      current_world:         editShipFields.value.currentWorld     || null,
      current_sector:        editShipFields.value.currentSector    || null,
    })
    editingShip.value = false
  } catch (e) {
    shipError.value = e.message
  }
}

async function submitAddCrew() {
  crewError.value = ''
  try {
    await referee.assignCrew(
      auth.campaign.id,
      selectedShipId.value,
      newCrewPlayerId.value,
      newCrewRole.value,
      tick.currentTick,
    )
    showAddCrew.value   = false
    newCrewPlayerId.value = ''
    newCrewRole.value     = 'crew'
  } catch (e) {
    crewError.value = e.message
  }
}

async function changeCrewRole(crewRow, newRole) {
  const updates = { role: newRole }
  if (newRole === 'captain') updates.can_trade = true
  const { supabase } = await import('../lib/supabase.js')
  await supabase.from('crew').update(updates).eq('id', crewRow.id)
  crewRow.role = newRole
  if (updates.can_trade !== undefined) crewRow.can_trade = updates.can_trade
}

async function confirmRemoveCrew(c) {
  const name = c.players?.character_name ?? 'this crew member'
  if (!confirm(`Remove ${name} from ${selectedShip.value?.name}?`)) return
  try {
    await referee.removeCrew(c.id, tick.currentTick)
  } catch (e) {
    crewError.value = e.message
  }
}

// ── Players tab state ────────────────────────────────────────────────────────

const expandedPlayerId = ref(null)
const newSkillName     = ref({})
const newSkillLevel    = ref({})
const skillError       = ref({})

function togglePlayer(id) {
  expandedPlayerId.value = expandedPlayerId.value === id ? null : id
}

async function loadPlayers() {
  await referee.loadPlayers(auth.campaign.id)
}

async function saveSkill(player, skillName, level) {
  skillError.value[player.id] = ''
  try {
    await referee.upsertSkill(auth.campaign.id, player.id, skillName, level)
  } catch (e) {
    skillError.value[player.id] = e.message
  }
}

async function addSkill(player) {
  const name  = newSkillName.value[player.id]?.trim()
  const level = newSkillLevel.value[player.id] ?? 0
  if (!name) return
  skillError.value[player.id] = ''
  try {
    await referee.upsertSkill(auth.campaign.id, player.id, name, level)
    newSkillName.value[player.id]  = ''
    newSkillLevel.value[player.id] = 0
  } catch (e) {
    skillError.value[player.id] = e.message
  }
}

async function deleteSkill(player, skillId) {
  skillError.value[player.id] = ''
  try {
    await referee.removeSkill(player.id, skillId)
  } catch (e) {
    skillError.value[player.id] = e.message
  }
}

// ── Events tab state ─────────────────────────────────────────────────────────

const eventError   = ref('')
const eventSuccess = ref(false)

const newEvent = ref({
  scope: 'local', worldHex: '', sector: '', description: '',
  buyModifierPct: null, sellModifierPct: null, durationTicks: 4, tradeGoodDie: '',
})

const activeEvents = computed(() => tick.activeEvents ?? [])

async function doExpireEvent(eventId) {
  try {
    await referee.expireEvent(eventId, tick.currentTick)
    // Remove from tick store's local list immediately
    if (tick.activeEvents) {
      tick.activeEvents = tick.activeEvents.filter(e => e.id !== eventId)
    }
  } catch (e) {
    eventError.value = e.message
  }
}

async function submitEvent() {
  eventError.value   = ''
  eventSuccess.value = false
  try {
    await referee.createEvent(auth.campaign.id, {
      ...newEvent.value,
      currentTick: tick.currentTick,
    })
    eventSuccess.value = true
    newEvent.value = {
      scope: 'local', worldHex: '', sector: '', description: '',
      buyModifierPct: null, sellModifierPct: null, durationTicks: 4, tradeGoodDie: '',
    }
    setTimeout(() => { eventSuccess.value = false }, 3000)
  } catch (e) {
    eventError.value = e.message
  }
}

// ── Campaign tab ─────────────────────────────────────────────────────────────

const travellerMapUrl = computed(() => {
  const milieu = auth.campaign?.milieu ?? 'M1105'
  return `https://travellermap.com/?milieu=${milieu}`
})

// ── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  if (!auth.isReferee) { router.push({ name: 'map' }); return }
  await referee.loadShips(auth.campaign.id)
  await referee.loadPlayers(auth.campaign.id)
})
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────────────────────────────── */

.ref-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 1.25rem;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
  min-height: 56px;
}

.back-btn {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-dim);
  font-size: 0.82rem;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;
}
.back-btn:hover { color: var(--text); border-color: var(--accent-dim); }

.header-title { flex: 1; }
.header-title h1 { font-size: 1rem; font-weight: 600; margin: 0; }
.header-sub { font-size: 0.78rem; color: var(--text-dim); }

.header-meta { display: flex; gap: 0.5rem; align-items: center; }
.rules-badge, .tick-badge {
  font-size: 0.72rem;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  color: var(--text-dim);
  background: var(--bg-item);
}

.ref-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg-panel);
  padding: 0 1.25rem;
}

.rtab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-dim);
  font-size: 0.83rem;
  padding: 0.6rem 1rem;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.rtab:hover   { color: var(--text); }
.rtab.active  { color: var(--accent); border-bottom-color: var(--accent); }

.ref-body { flex: 1; overflow-y: auto; }

.tab-pane {
  padding: 1.25rem;
  max-width: 1100px;
}

/* ── Ships tab ───────────────────────────────────────────────────────────── */

.ships-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 1.5rem;
  align-items: start;
}

.col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.col-header h2, .col-header h3 { margin: 0; font-size: 0.95rem; }

.ship-list { list-style: none; margin: 0; padding: 0; }
.ship-item {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.1s;
}
.ship-item:hover  { background: var(--bg-item); }
.ship-item.active { background: var(--bg-item); border-left: 2px solid var(--accent); }

.ship-name  { font-size: 0.88rem; font-weight: 500; }
.ship-type  { font-size: 0.75rem; color: var(--text-dim); }
.ship-crew-count { font-size: 0.72rem; color: var(--accent-dim); }

.ship-detail-col { min-width: 0; }
.detail-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.detail-header-row h2 { margin: 0; font-size: 1rem; }

/* ── Forms ───────────────────────────────────────────────────────────────── */

.detail-form { display: flex; flex-direction: column; gap: 0.75rem; max-width: 480px; }

.form-row { display: flex; flex-direction: column; gap: 0.3rem; }
.form-row label { font-size: 0.75rem; color: var(--text-dim); }
.form-row input, .form-row select {
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.85rem;
  padding: 0.4rem 0.6rem;
}
.form-row.two-col { flex-direction: row; gap: 1rem; }
.form-row.two-col > div { flex: 1; display: flex; flex-direction: column; gap: 0.3rem; }
.form-row.two-col label { font-size: 0.75rem; color: var(--text-dim); }

.form-actions { display: flex; gap: 0.5rem; margin-top: 0.25rem; }
.req { color: var(--red); }
.form-error   { font-size: 0.78rem; color: var(--red);   margin: 0; }
.form-success { font-size: 0.78rem; color: var(--green); margin: 0; }

/* ── Stat grid ───────────────────────────────────────────────────────────── */

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.stat-grid.wide { grid-template-columns: repeat(2, 1fr); }

.stat {
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
}
.stat label { display: block; font-size: 0.72rem; color: var(--text-dim); margin-bottom: 0.2rem; }
.stat span  { font-size: 0.88rem; }
.stat.locked span { color: var(--text-dim); }
.lock-note { font-size: 0.7rem; color: var(--text-dim); margin-left: 0.4rem; }

/* ── Crew ────────────────────────────────────────────────────────────────── */

.crew-section { margin-top: 1.5rem; }
.crew-section h3 { font-size: 0.9rem; }

.crew-add-form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}
.crew-add-form select, .crew-add-form input {
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.83rem;
  padding: 0.35rem 0.6rem;
}

.crew-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.83rem;
}
.crew-table th {
  text-align: left;
  font-size: 0.72rem;
  color: var(--text-dim);
  padding: 0.3rem 0.5rem;
  border-bottom: 1px solid var(--border);
}
.crew-table td {
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--border);
}
.crew-table select {
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.8rem;
  padding: 0.2rem 0.4rem;
}

.crew-table .center { text-align: center; }

.trade-check {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
  accent-color: var(--accent);
}

/* ── Players tab ─────────────────────────────────────────────────────────── */

.player-list { display: flex; flex-direction: column; gap: 0.5rem; max-width: 700px; }

.player-card {
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.player-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.9rem;
  cursor: pointer;
  transition: background 0.1s;
}
.player-card-header:hover { background: var(--bg-panel); }

.player-identity { display: flex; align-items: center; gap: 0.5rem; }
.player-name { font-size: 0.88rem; font-weight: 500; }

.role-badge {
  font-size: 0.68rem;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  border: 1px solid var(--border);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.role-badge.referee { color: var(--accent); border-color: var(--accent-dim); }
.role-badge.player  { color: var(--text-dim); }

.ship-badge {
  font-size: 0.72rem;
  color: var(--text-dim);
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: 3px;
}

.expand-icon { font-size: 0.7rem; color: var(--text-dim); }

.player-skills {
  padding: 0.75rem 0.9rem;
  border-top: 1px solid var(--border);
}
.player-skills h4 { font-size: 0.78rem; color: var(--text-dim); margin: 0 0 0.5rem; }

.skills-table { width: 100%; border-collapse: collapse; font-size: 0.83rem; margin-bottom: 0.75rem; }
.skills-table th {
  text-align: left;
  font-size: 0.72rem;
  color: var(--text-dim);
  padding: 0.25rem 0.4rem;
  border-bottom: 1px solid var(--border);
}
.skills-table td { padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--border); }

.level-input {
  width: 52px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.83rem;
  padding: 0.2rem 0.4rem;
  text-align: center;
}

.add-skill-form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
}
.add-skill-form input {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.83rem;
  padding: 0.3rem 0.5rem;
}
.add-skill-form input:first-child { flex: 1; }

/* ── Events tab ──────────────────────────────────────────────────────────── */

.events-layout {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 1.5rem;
  align-items: start;
}

.events-col h2 { font-size: 0.95rem; margin: 0 0 0.75rem; }

.event-list { display: flex; flex-direction: column; gap: 0.5rem; }
.event-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.6rem 0.75rem;
  gap: 0.75rem;
}
.event-card.crisis { border-left: 3px solid var(--red); }
.event-card.major  { border-left: 3px solid var(--amber, #f59e0b); }
.event-card.minor  { border-left: 3px solid var(--border); }

.event-card-body { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
.event-desc { font-size: 0.83rem; }
.event-meta { font-size: 0.72rem; color: var(--text-dim); }

/* ── Campaign tab ────────────────────────────────────────────────────────── */

.campaign-settings { max-width: 560px; }
.campaign-settings h2 { font-size: 0.95rem; margin: 0 0 1rem; }

.campaign-traveller-map {
  margin-top: 1.5rem;
  padding: 1rem;
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.campaign-traveller-map h3 { margin: 0 0 0.4rem; font-size: 0.88rem; }
.campaign-traveller-map p  { font-size: 0.83rem; color: var(--text-dim); margin: 0 0 0.75rem; }

.external-link { text-decoration: none; display: inline-block; }

.campaign-security {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
}
.campaign-security h3 { margin: 0 0 0.4rem; font-size: 0.88rem; }
.campaign-security p  { font-size: 0.83rem; color: var(--text-dim); margin: 0 0 0.5rem; }

.security-warn {
  font-size: 0.78rem;
  color: var(--amber);
  margin-bottom: 0.75rem !important;
}

.regen-error {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--red);
}

.campaign-danger {
  margin-top: 1.5rem;
  padding: 1rem;
  border: 1px solid var(--red);
  border-radius: var(--radius);
  background: rgba(217, 58, 58, 0.04);
}
.campaign-danger h3 {
  margin: 0 0 0.4rem;
  font-size: 0.88rem;
  color: var(--red);
}
.campaign-danger p {
  font-size: 0.83rem;
  color: var(--text-dim);
  margin: 0 0 0.75rem;
}

.btn-delete {
  font-size: 0.83rem;
  padding: 0.4rem 0.9rem;
}

.delete-warn {
  color: var(--red) !important;
  font-size: 0.82rem !important;
  margin-bottom: 0.5rem !important;
}

.delete-form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.delete-pin-input {
  background: var(--bg-item);
  border: 1px solid var(--red);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.85rem;
  padding: 0.4rem 0.6rem;
  width: 160px;
  outline: none;
}
.delete-pin-input:focus { border-color: var(--red); box-shadow: 0 0 0 2px rgba(217,58,58,0.2); }

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: var(--radius);
  padding: 0.4rem 0.9rem;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-secondary:hover:not(:disabled) { border-color: var(--accent-dim); color: var(--accent); }
.btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Shared buttons ──────────────────────────────────────────────────────── */

.btn-primary {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  font-size: 0.83rem;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-primary:hover    { opacity: 0.88; }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.83rem;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  transition: background 0.1s;
}
.btn-ghost:hover { background: var(--bg-item); }

.btn-danger {
  background: transparent;
  border: 1px solid var(--red);
  border-radius: var(--radius);
  color: var(--red);
  cursor: pointer;
  transition: background 0.1s;
}
.btn-danger:hover { background: rgba(217,58,58,0.1); }

.btn-sm  { font-size: 0.78rem; padding: 0.3rem 0.65rem; }
.btn-xs  { font-size: 0.72rem; padding: 0.15rem 0.45rem; }

.placeholder    { color: var(--text-dim); font-size: 0.83rem; padding: 1rem 0; }
.placeholder.sm { padding: 0.4rem 0; }
.placeholder.large { font-size: 1rem; padding: 3rem 0; text-align: center; }
</style>
