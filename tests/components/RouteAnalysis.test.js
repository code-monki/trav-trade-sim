import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { useMapStore } from '../../src/stores/map.js'
import RouteAnalysis from '../../src/components/RouteAnalysis.vue'
import { generateWorldSnapshot, ct7CargoLotSalePrice } from '../../src/lib/market-tick.js'

const ORIGIN = { Hex: '0101', UWP: 'A788899-9', Name: 'Origin', Remarks: 'Ag' }
const DEST_A = { Hex: '0102', UWP: 'A788899-9', Name: 'Near World', Remarks: 'Ri' }
// A source world with genuinely different codes/TL from DEST_A, so CT7's
// real per-lot mechanic (which depends on both) diverges from a
// self-referenced baseline (which would use DEST_A's own codes twice).
const SOURCE = { Hex: '0201', UWP: 'B300000-2', Name: 'Source World', Remarks: '' }

const CARGO_ITEM = {
  id: 'c1', trade_good_die: '11', trade_good_name: 'Textiles',
  purchase_price: 1000, purchased_tick: 1,
  purchase_world: SOURCE.Hex, purchase_sector: 'Test', tons: 5,
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
  const mapStore = useMapStore(pinia)
  mapStore.fetchWorldsForSector.mockResolvedValue([SOURCE])

  const wrapper = mount(RouteAnalysis, {
    props: { world: ORIGIN, sectorName: 'Test' },
    global: { plugins: [pinia] },
  })
  return { wrapper, mapStore }
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

describe('RouteAnalysis — CT7 uses the real per-lot source-vs-market mechanic', () => {
  it('shows Cr0 profit before the cargo lot\'s source world has resolved', () => {
    const { wrapper } = mountPanel({ tradeRules: 'CT7' })
    // Synchronous first render — sourceWorldCache is still empty, so
    // ct7CargoLotSalePrice returns null for this lot (no fallback to a
    // wrong self-referenced number).
    expect(profitForHex(wrapper, DEST_A.Hex)).toContain('0')
  })

  it('matches ct7CargoLotSalePrice using the lot\'s real purchase world once resolved', async () => {
    const { wrapper, mapStore } = mountPanel({ tradeRules: 'CT7' })
    await flushPromises()

    expect(mapStore.fetchWorldsForSector).toHaveBeenCalledWith('Test')

    const salePrice = ct7CargoLotSalePrice({
      campaignId: 'c1', marketWorld: DEST_A, sourceWorld: SOURCE,
      tick: 5, goodDie: '11', activeEvents: [], brokerSkill: 0,
    })
    const expectedProfit = (salePrice - CARGO_ITEM.purchase_price) * CARGO_ITEM.tons

    const cellText = profitForHex(wrapper, DEST_A.Hex)
    expect(cellText).toContain(Math.abs(expectedProfit).toLocaleString())
  })

  it('differs from a self-referenced baseline (proving the fix isn\'t a no-op)', async () => {
    const { wrapper } = mountPanel({ tradeRules: 'CT7' })
    await flushPromises()

    const realSalePrice = ct7CargoLotSalePrice({
      campaignId: 'c1', marketWorld: DEST_A, sourceWorld: SOURCE,
      tick: 5, goodDie: '11', activeEvents: [], brokerSkill: 0,
    })
    const selfReferencedSalePrice = ct7CargoLotSalePrice({
      campaignId: 'c1', marketWorld: DEST_A, sourceWorld: DEST_A,
      tick: 5, goodDie: '11', activeEvents: [], brokerSkill: 0,
    })
    expect(realSalePrice).not.toBe(selfReferencedSalePrice)

    const cellText = profitForHex(wrapper, DEST_A.Hex)
    const wrongProfit = (selfReferencedSalePrice - CARGO_ITEM.purchase_price) * CARGO_ITEM.tons
    expect(cellText).not.toContain(Math.abs(wrongProfit).toLocaleString())
  })
})
