<template>
  <Teleport to="body">
    <div v-if="modelValue" class="overlay" @mousedown.self="close">
      <div class="dialog" role="dialog" aria-modal="true"
           aria-labelledby="char-dialog-title" ref="dialogEl">

        <div class="dialog-header">
          <div>
            <h3 id="char-dialog-title">{{ auth.player?.character_name }}</h3>
            <span class="header-sub">{{ auth.campaign?.code }} · {{ auth.campaign?.trade_rules }}</span>
          </div>
          <button class="close-btn" @click="close" aria-label="Close">✕</button>
        </div>

        <div class="dialog-body">

          <!-- Skills section -->
          <div class="section-header">
            <h4>Skills</h4>
          </div>

          <div v-if="loading" class="placeholder">Loading…</div>

          <template v-else>
            <table v-if="skills.length" class="skills-table">
              <thead>
                <tr><th>Skill</th><th>Level</th><th></th></tr>
              </thead>
              <tbody>
                <tr v-for="s in skills" :key="s.id">
                  <td>{{ s.skill }}</td>
                  <td>
                    <input type="number" :value="s.level" min="0" max="10"
                           class="level-input"
                           @change="saveSkill(s.skill, +$event.target.value)" />
                  </td>
                  <td>
                    <button class="remove-btn" @click="removeSkill(s)" aria-label="Remove skill">✕</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-else class="placeholder">No skills recorded yet.</p>

            <!-- Add skill form -->
            <form class="add-form" @submit.prevent="addSkill">
              <input v-model="newName" placeholder="Skill name" class="skill-input" />
              <input v-model.number="newLevel" type="number" min="0" max="10"
                     placeholder="Lvl" class="level-input" />
              <button type="submit" class="add-btn" :disabled="!newName.trim() || saving">
                {{ saving ? '…' : 'Add' }}
              </button>
            </form>

            <p v-if="error" class="form-error">{{ error }}</p>
          </template>

        </div>

        <div class="dialog-footer">
          <button class="close-primary" @click="close">Done</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { supabase }     from '../lib/supabase.js'
import { useFocusTrap } from '../composables/useFocusTrap.js'

const props = defineProps({ modelValue: { type: Boolean, required: true } })
const emit  = defineEmits(['update:modelValue'])

const auth     = useAuthStore()
const dialogEl = ref(null)

const skills   = ref([])
const loading  = ref(false)
const saving   = ref(false)
const error    = ref('')
const newName  = ref('')
const newLevel = ref(0)

const { activate, deactivate } = useFocusTrap(dialogEl)

watch(() => props.modelValue, async (open) => {
  if (open) {
    await nextTick()
    activate()
    await loadSkills()
  } else {
    deactivate()
  }
})

async function loadSkills() {
  loading.value = true
  error.value   = ''
  const { data, error: err } = await supabase
    .from('player_skills')
    .select('id, skill, level')
    .eq('campaign_id', auth.campaign.id)
    .eq('player_id', auth.player.id)
    .order('skill')
  loading.value = false
  if (err) { error.value = err.message; return }
  skills.value = data ?? []
}

async function saveSkill(skillName, level) {
  error.value = ''
  const { data, error: err } = await supabase
    .from('player_skills')
    .upsert(
      { campaign_id: auth.campaign.id, player_id: auth.player.id, skill: skillName, level },
      { onConflict: 'player_id,skill' }
    )
    .select('id, skill, level')
    .single()
  if (err) { error.value = err.message; return }
  skills.value = skills.value.map(s => s.skill === skillName ? data : s)
}

async function addSkill() {
  const name = newName.value.trim()
  if (!name) return
  saving.value = true
  error.value  = ''
  const { data, error: err } = await supabase
    .from('player_skills')
    .upsert(
      { campaign_id: auth.campaign.id, player_id: auth.player.id, skill: name, level: newLevel.value ?? 0 },
      { onConflict: 'player_id,skill' }
    )
    .select('id, skill, level')
    .single()
  saving.value = false
  if (err) { error.value = err.message; return }
  const existing = skills.value.find(s => s.skill === name)
  skills.value = existing
    ? skills.value.map(s => s.skill === name ? data : s)
    : [...skills.value, data].sort((a, b) => a.skill.localeCompare(b.skill))
  newName.value  = ''
  newLevel.value = 0
}

async function removeSkill(s) {
  error.value = ''
  const { error: err } = await supabase
    .from('player_skills')
    .delete()
    .eq('id', s.id)
  if (err) { error.value = err.message; return }
  skills.value = skills.value.filter(sk => sk.id !== s.id)
}

function close() { emit('update:modelValue', false) }

function onKey(e) { if (e.key === 'Escape') close() }
onMounted(()   => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.dialog {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: min(400px, 90vw);
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}

.dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0.9rem 1.1rem 0.75rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.dialog-header h3 {
  margin: 0 0 0.15rem;
  font-size: 0.95rem;
  font-weight: 600;
}

.header-sub {
  font-size: 0.72rem;
  color: var(--text-dim);
  font-family: monospace;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-size: 1rem;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius);
  flex-shrink: 0;
}
.close-btn:hover { color: var(--text); background: var(--bg-item); }

.dialog-body {
  padding: 1rem 1.1rem;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-header h4 {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
}

.placeholder {
  font-size: 0.82rem;
  color: var(--text-dim);
}

/* Skills table */
.skills-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.83rem;
}

.skills-table th {
  text-align: left;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-dim);
  padding: 0.25rem 0.4rem;
  border-bottom: 1px solid var(--border);
}

.skills-table td {
  padding: 0.35rem 0.4rem;
  border-bottom: 1px solid rgba(42,48,80,0.4);
  vertical-align: middle;
}

.skills-table tr:last-child td { border-bottom: none; }

.level-input {
  width: 52px;
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.83rem;
  padding: 0.2rem 0.4rem;
  text-align: center;
  outline: none;
}
.level-input:focus { border-color: var(--accent-dim); }

.remove-btn {
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-size: 0.78rem;
  cursor: pointer;
  padding: 2px 5px;
  border-radius: var(--radius);
}
.remove-btn:hover { color: var(--red); }

/* Add form */
.add-form {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  padding-top: 0.25rem;
  border-top: 1px solid var(--border);
}

.skill-input {
  flex: 1;
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.83rem;
  padding: 0.3rem 0.5rem;
  outline: none;
}
.skill-input:focus { border-color: var(--accent-dim); }

.add-btn {
  background: var(--accent-dim);
  border: none;
  color: #fff;
  border-radius: var(--radius);
  padding: 0.3rem 0.7rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.add-btn:hover:not(:disabled) { background: var(--accent); }
.add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.form-error {
  font-size: 0.78rem;
  color: var(--red);
  margin: 0;
}

/* Footer */
.dialog-footer {
  padding: 0.75rem 1.1rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.close-primary {
  background: var(--accent-dim);
  border: none;
  color: #fff;
  border-radius: var(--radius);
  padding: 0.35rem 1.1rem;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}
.close-primary:hover { background: var(--accent); }
</style>
