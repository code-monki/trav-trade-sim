<template>
  <div v-if="sellableItems.length" class="sell-panel">
    <div class="sell-header">
      <span class="sell-title">Cargo in Hold</span>
      <span class="sell-hint">selling at {{ world?.Name || world?.Hex }}</span>
    </div>
    <div class="sell-rows">
      <div v-for="item in sellableItems" :key="item.id" class="sell-row">
        <span class="sell-good">{{ item.trade_good_name }}</span>
        <span class="sell-tons">{{ item.tons }}t</span>
        <span class="sell-buy-price">paid Cr {{ fmt(item.purchase_price) }}/t</span>
        <span class="sell-sep">›</span>
        <span class="sell-price" :class="item.salePrice != null ? '' : 'dim'">
          {{ item.salePrice != null ? `sell Cr ${fmt(item.salePrice)}/t` : 'no market data' }}
        </span>
        <span v-if="item.salePrice != null"
              class="sell-profit"
              :class="item.profit >= 0 ? 'pos' : 'neg'">
          {{ item.profit >= 0 ? '+' : '' }}Cr {{ fmt(Math.abs(item.profit)) }}
        </span>
        <button v-if="item.salePrice != null"
                class="sell-btn"
                :disabled="ship.loading"
                @click="doSell(item)">
          Sell
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useShipStore } from '../stores/ship.js'
import { useTickStore } from '../stores/tick.js'
import { useAuthStore } from '../stores/auth.js'

const props = defineProps({
  world:      { type: Object, required: true },
  sectorName: { type: String, required: true },
})

const ship = useShipStore()
const tick = useTickStore()
const auth = useAuthStore()

const sellableItems = computed(() =>
  ship.cargo.map(item => {
    const snap      = tick.worldSnapshots[item.trade_good_die]
    const salePrice = snap?.sale_price ?? null
    const profit    = salePrice != null ? (salePrice - item.purchase_price) * item.tons : null
    return { ...item, salePrice, profit }
  })
)

async function doSell(item) {
  await ship.sellCargo({
    campaignId:      auth.campaign.id,
    cargoItem:       item,
    sellPricePerTon: item.salePrice,
    marketWorldHex:  props.world.Hex,
    marketSector:    props.sectorName,
    tick:            tick.currentTick,
    tradeRules:      auth.campaign.trade_rules,
  })
}

function fmt(n) { return Math.round(n ?? 0).toLocaleString() }
</script>

<style scoped>
.sell-panel {
  flex-shrink: 0;
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.sell-header {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.3rem 0.75rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-panel);
}

.sell-title {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-dim);
}

.sell-hint {
  font-size: 0.7rem;
  color: var(--text-dim);
}

.sell-rows {
  display: flex;
  flex-direction: column;
}

.sell-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.35rem 0.75rem;
  border-bottom: 1px solid rgba(42, 48, 80, 0.4);
  font-size: 0.82rem;
}

.sell-row:last-child { border-bottom: none; }

.sell-good  { font-weight: 600; color: var(--text); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sell-tons  { font-family: monospace; color: var(--text-dim); white-space: nowrap; }
.sell-buy-price { color: var(--text-dim); font-size: 0.78rem; white-space: nowrap; }
.sell-sep   { color: var(--border); }
.sell-price { color: var(--text); font-size: 0.78rem; white-space: nowrap; }
.dim        { color: var(--text-dim); font-style: italic; }

.sell-profit {
  font-family: monospace;
  font-weight: 600;
  font-size: 0.82rem;
  white-space: nowrap;
  margin-left: auto;
}

.pos { color: var(--green); }
.neg { color: var(--red); }

.sell-btn {
  flex-shrink: 0;
  background: var(--accent-dim);
  border: none;
  color: #fff;
  border-radius: var(--radius);
  padding: 0.25rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.1s;
  white-space: nowrap;
}
.sell-btn:hover:not(:disabled) { background: var(--accent); }
.sell-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
