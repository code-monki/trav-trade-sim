<template>
  <div class="events-wrap">

    <div class="events-toolbar">
      <span class="events-count">
        {{ filtered.length }} event{{ filtered.length !== 1 ? 's' : '' }}
        <span v-if="sevFilter" class="filter-note">· {{ sevFilter }} only</span>
      </span>
      <div class="sev-filters">
        <button v-for="s in SEVERITY_OPTIONS" :key="s.key"
                :class="['sev-btn', s.key, { active: sevFilter === s.key }]"
                @click="sevFilter = sevFilter === s.key ? null : s.key">
          {{ s.label }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="events-placeholder">Loading events…</div>
    <div v-else-if="!tick.worldEventHistory.length" class="events-placeholder">
      No events recorded for this world yet.<br>
      <span class="hint">Events fire automatically as ticks advance.</span>
    </div>
    <div v-else-if="!filtered.length" class="events-placeholder">
      No {{ sevFilter }} events recorded.
    </div>

    <div v-else class="events-list">
      <div v-for="ev in filtered" :key="ev.id"
           :class="['event-row', ev.severity, { expired: isExpired(ev) }]">

        <div class="ev-left">
          <div :class="['sev-pip', ev.severity]" :title="ev.severity">
            {{ SEV_INITIAL[ev.severity] }}
          </div>
        </div>

        <div class="ev-body">
          <div class="ev-desc">{{ ev.description }}</div>
          <div class="ev-meta">
            <span class="ev-date mono">{{ formatImperialDate(ev.tick) }}</span>
            <span :class="['ev-scope', ev.scope]">{{ ev.scope }}</span>
            <span v-if="ev.buy_modifier_pct != null"
                  :class="['ev-effect', ev.buy_modifier_pct > 0 ? 'up' : 'down']">
              Buy {{ ev.buy_modifier_pct > 0 ? '+' : '' }}{{ ev.buy_modifier_pct }}%
            </span>
            <span v-if="ev.sell_modifier_pct != null"
                  :class="['ev-effect', ev.sell_modifier_pct > 0 ? 'up' : 'down']">
              Sell {{ ev.sell_modifier_pct > 0 ? '+' : '' }}{{ ev.sell_modifier_pct }}%
            </span>
            <span :class="['ev-status', isExpired(ev) ? 'expired' : 'active']">
              {{ isExpired(ev)
                  ? `expired ${formatImperialDate(ev.expires_tick)}`
                  : `active → ${formatImperialDate(ev.expires_tick)}` }}
            </span>
          </div>
        </div>

      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useTickStore } from '../stores/tick.js'
import { formatImperialDate } from '../lib/market-tick.js'

const props = defineProps({
  worldHex:   { type: String, required: true },
  sectorName: { type: String, required: true },
})

const tick    = useTickStore()
const loading = ref(false)
const sevFilter = ref(null)

const SEVERITY_OPTIONS = [
  { key: 'minor',  label: 'Minor'  },
  { key: 'major',  label: 'Major'  },
  { key: 'crisis', label: 'Crisis' },
]
const SEV_INITIAL = { minor: 'M', major: 'J', crisis: 'C' }

async function load() {
  loading.value = true
  await tick.loadWorldEventHistory(props.worldHex, props.sectorName)
  loading.value = false
}

onMounted(load)
watch(() => [props.worldHex, props.sectorName], load)

function isExpired(ev) {
  return ev.expires_tick !== null && ev.expires_tick <= tick.currentTick
}

const filtered = computed(() => {
  const list = tick.worldEventHistory
  if (!sevFilter.value) return list
  return list.filter(ev => ev.severity === sevFilter.value)
})
</script>

<style scoped>
.events-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  height: 100%;
  min-height: 0;
}

.events-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-shrink: 0;
}

.events-count {
  font-size: 0.75rem;
  color: var(--text-dim);
}

.filter-note {
  color: var(--accent);
  text-transform: capitalize;
}

.sev-filters {
  display: flex;
  gap: 0.4rem;
}

.sev-btn {
  font-size: 0.7rem;
  padding: 2px 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.15s;
}

.sev-btn.minor.active  { border-color: var(--accent-dim); color: var(--accent); background: rgba(90,120,200,0.12); }
.sev-btn.major.active  { border-color: var(--amber);      color: var(--amber);  background: rgba(232,160,32,0.1);  }
.sev-btn.crisis.active { border-color: var(--red);        color: var(--red);    background: rgba(217,58,58,0.1);   }

.events-placeholder {
  color: var(--text-dim);
  font-size: 0.85rem;
  text-align: center;
  padding: 2rem 0;
}

.hint {
  font-size: 0.75rem;
  opacity: 0.6;
}

/* List */
.events-list {
  overflow-y: auto;
  overscroll-behavior: contain;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.event-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-item);
  transition: opacity 0.15s;
}

.event-row.expired {
  opacity: 0.5;
}

/* Left severity pip */
.sev-pip {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 700;
  flex-shrink: 0;
  letter-spacing: 0;
}

.sev-pip.minor  { background: rgba(90,120,200,0.18); color: var(--accent);    border: 1px solid var(--accent-dim); }
.sev-pip.major  { background: rgba(232,160,32,0.15); color: var(--amber);     border: 1px solid var(--amber);      }
.sev-pip.crisis { background: rgba(217,58,58,0.15);  color: var(--red);       border: 1px solid var(--red);        }

/* Body */
.ev-body {
  flex: 1;
  min-width: 0;
}

.ev-desc {
  font-size: 0.82rem;
  color: var(--text);
  line-height: 1.35;
  margin-bottom: 0.3rem;
}

.ev-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.7rem;
}

.ev-date { color: var(--code); }

.ev-scope {
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}
.ev-scope.local     { background: rgba(90,120,200,0.12); color: var(--accent-dim); }
.ev-scope.subsector { background: rgba(232,160,32,0.12); color: var(--amber);      }

.ev-effect     { font-weight: 600; }
.ev-effect.up  { color: var(--red);   }
.ev-effect.down{ color: var(--green); }

.ev-status        { color: var(--text-dim); }
.ev-status.active { color: var(--green);    }

.mono { font-family: monospace; }
</style>
