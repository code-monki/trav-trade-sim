<template>
  <div class="world-picker">

    <!-- Dropdown mode -->
    <template v-if="!manualMode">
      <div class="filter-row">
        <!-- Subsector filter (only shown when names are available) -->
        <div v-if="hasSubsectors" class="form-row">
          <label>Subsector</label>
          <select v-model="selectedSS" @change="selectedHex = ''; emitClear()">
            <option value="">All subsectors</option>
            <option v-for="ss in subsectorOptions" :key="ss.index" :value="ss.index">
              {{ ss.index }} — {{ ss.name }}
            </option>
          </select>
        </div>
        <!-- Search filter -->
        <div class="form-row">
          <label>Search</label>
          <input
            v-model="searchQuery"
            placeholder="Name or hex…"
            autocomplete="off"
            @input="selectedHex = ''; emitClear()"
          />
        </div>
      </div>

      <div class="form-row">
        <label>World <span v-if="filteredWorlds.length" class="count">({{ filteredWorlds.length }})</span></label>
        <select v-model="selectedHex" @change="onPick">
          <option value="">— select world —</option>
          <option v-for="w in filteredWorlds" :key="w.Hex" :value="w.Hex">
            {{ w.Hex }} — {{ w.Name || '(unnamed)' }}
          </option>
        </select>
        <span v-if="filteredWorlds.length === 0 && (selectedSS || searchQuery)" class="no-match">
          No worlds match the current filter.
        </span>
      </div>

      <button type="button" class="mode-link" @click="switchManual">
        Enter manually (cross-sector)
      </button>
    </template>

    <!-- Manual mode -->
    <template v-else>
      <div class="form-row">
        <label>World Name (optional)</label>
        <input v-model="manualName" placeholder="World name" @input="emitManual" />
      </div>
      <div class="form-row two-col">
        <div>
          <label>Hex</label>
          <input v-model="manualHex" placeholder="e.g. 1910" maxlength="4" @input="emitManual" />
        </div>
        <div>
          <label>Sector</label>
          <input v-model="manualSector" :placeholder="sectorName || 'Sector name'" @input="emitManual" />
        </div>
      </div>
      <button v-if="hasWorlds" type="button" class="mode-link" @click="switchDropdown">
        Select from loaded worlds
      </button>
    </template>

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useMapStore } from '../stores/map.js'

const props = defineProps({
  modelValue: { type: Object, default: () => ({ hex: '', name: '', sector: '' }) },
  sectorName: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const map = useMapStore()

const manualMode   = ref(false)
const selectedSS   = ref('')
const selectedHex  = ref('')
const searchQuery  = ref('')
const manualHex    = ref('')
const manualSector = ref(props.sectorName)
const manualName   = ref('')

const hasWorlds     = computed(() => map.worlds.length > 0)
const hasSubsectors = computed(() => Object.keys(map.subsectorNames).length > 0)

// Sorted subsector options — only those present in the loaded world list
const subsectorOptions = computed(() => {
  const present = new Set(map.worlds.map(w => w.SS).filter(Boolean))
  return Object.entries(map.subsectorNames)
    .filter(([idx]) => present.has(idx))
    .map(([index, name]) => ({ index, name }))
    .sort((a, b) => a.index.localeCompare(b.index))
})

const filteredWorlds = computed(() => {
  const q  = searchQuery.value.trim().toLowerCase()
  const ss = selectedSS.value

  return map.worlds
    .filter(w => {
      if (ss && w.SS !== ss) return false
      if (q && !(
        (w.Name && w.Name.toLowerCase().includes(q)) ||
        w.Hex.includes(q)
      )) return false
      return true
    })
    .sort((a, b) => (a.Name || a.Hex).localeCompare(b.Name || b.Hex))
})

function onPick() {
  const w = map.worlds.find(w => w.Hex === selectedHex.value)
  if (!w) return emitClear()
  emit('update:modelValue', { hex: w.Hex, name: w.Name ?? '', sector: props.sectorName })
}

function emitClear() {
  emit('update:modelValue', { hex: '', name: '', sector: '' })
}

function emitManual() {
  emit('update:modelValue', {
    hex:    manualHex.value.trim(),
    name:   manualName.value.trim(),
    sector: manualSector.value.trim() || props.sectorName,
  })
}

function switchManual() {
  manualMode.value   = true
  manualSector.value = props.sectorName
  manualHex.value    = ''
  manualName.value   = ''
  emitClear()
}

function switchDropdown() {
  manualMode.value = false
  selectedSS.value  = ''
  selectedHex.value = ''
  searchQuery.value = ''
  emitClear()
}

// Reset when parent clears the form (e.g. after successful submit)
watch(() => props.modelValue?.hex, (hex) => {
  if (!hex) {
    selectedSS.value  = ''
    selectedHex.value = ''
    searchQuery.value = ''
    manualHex.value   = ''
    manualName.value  = ''
  }
})

// Fall back to manual if no worlds are loaded
watch(hasWorlds, (v) => { if (!v) manualMode.value = true }, { immediate: true })
</script>

<style scoped>
.world-picker { display: flex; flex-direction: column; gap: 0.5rem; }

.filter-row { display: flex; gap: 0.75rem; }
.filter-row .form-row { flex: 1; }

.form-row { display: flex; flex-direction: column; gap: 0.3rem; }
.form-row label {
  font-size: 0.72rem;
  color: var(--text-dim);
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
}

.form-row input,
.form-row select {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  padding: 0.35rem 0.6rem;
  font-size: 0.82rem;
  width: 100%;
}

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

.count {
  font-weight: 400;
  color: var(--text-dim);
  font-size: 0.68rem;
}

.no-match {
  font-size: 0.72rem;
  color: var(--text-dim);
  font-style: italic;
}

.mode-link {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 0.7rem;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-align: left;
}
.mode-link:hover { color: var(--accent); }
</style>
