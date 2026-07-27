import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import RouteAnalysis from '../../src/components/RouteAnalysis.vue'
import { generateWorldSnapshot } from '../../src/lib/market-tick.js'

const ORIGIN = { Hex: '0101', UWP: 'A788899-9', Name: 'Origin', Remarks: 'Ag' }
const DEST_A = { Hex: '0102', UWP: 'A788899-9', Name: 'Near World', Remarks: 'Ri' }

const CARGO_ITEM = {
  id: 'c1', trade_good_die: '11', trade_good_name: 'Textiles',
  purchase_price: 1000, purchased_tick: 1,
  purchase_world: ORIGIN.Hex, purchase_sector: 'Test', tons: 5,
}

function mountPanel({ tradeRules = 'MgT2022', cargo = [CARGO_ITEM], jumpRating = 2 } = {}) {
  const pinia = createTestingPinia({
    initialState: {
      auth: { campaign: { id: 'c1', trade_rules: tradeRules } },
      ship: {
        ship: { current_world: ORIGIN.Hex, current_sector: 'Test', jump_rating: jumpRating },
        cargo,
      },
      map:  { worlds: [ORIGIN, DEST_A] },
      tick: { currentTick: 5, brokerSkill: 0 },
    },
    stubActions: true,
    createSpy: vi.fn,
  })

  const wrapper = mount(RouteAnalysis, {
    props: { world: ORIGIN, sectorName: 'Test' },
    global: { plugins: [pinia] },
  })
  return { wrapper }
}

function profitForHex(wrapper, hex) {
  const row = wrapper.findAll('.ra-row').find(r => r.find('.w-hex').text() === hex)
  return row?.find('.profit-cell').text() ?? null
}

describe('RouteAnalysis — profit projection uses the campaign\'s real trade_rules', () => {
  it('MgT2022: matches generateWorldSnapshot with tradeRules explicitly set (not silently defaulting to CT7)', () => {
    const { wrapper } = mountPanel({ tradeRules: 'MgT2022' })

    const snapshots = generateWorldSnapshot({
      world: DEST_A, sectorName: 'Test', campaignId: 'c1', tick: 5, activeEvents: [], tradeRules: 'MgT2022',
    })
    const snap = snapshots.find(s => s.trade_good_die === '11')
    const expectedProfit = (snap.sale_price - CARGO_ITEM.purchase_price) * CARGO_ITEM.tons

    const cellText = profitForHex(wrapper, DEST_A.Hex)
    expect(cellText).toContain(Math.abs(expectedProfit).toLocaleString())
  })
})

describe('RouteAnalysis — CT7 shares the same tradeRules-aware projection path', () => {
  it('matches generateWorldSnapshot with tradeRules explicitly set to CT7', () => {
    // Book 2's search composition is sparse (1D6 lots/week) — pick
    // whichever die this tick's baseline actually rolled rather than
    // assuming a fixed one is present, then cargo a lot of that good.
    const baseline = generateWorldSnapshot({
      world: DEST_A, sectorName: 'Test', campaignId: 'c1', tick: 5, activeEvents: [], tradeRules: 'CT7',
    })
    expect(baseline.length).toBeGreaterThan(0)
    const good = baseline[0]

    const cargoItem = {
      id: 'c1', trade_good_die: good.trade_good_die, trade_good_name: good.trade_good_name,
      purchase_price: 1000, purchased_tick: 1,
      purchase_world: ORIGIN.Hex, purchase_sector: 'Test', tons: 5,
    }
    const { wrapper } = mountPanel({ tradeRules: 'CT7', cargo: [cargoItem] })

    const expectedProfit = (good.sale_price - cargoItem.purchase_price) * cargoItem.tons

    const cellText = profitForHex(wrapper, DEST_A.Hex)
    expect(cellText).toContain(Math.abs(expectedProfit).toLocaleString())
  })
})
